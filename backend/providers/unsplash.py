"""Unsplash API provider — fetches and transforms photo/collection data for the ETL.

Owns both the HTTP calls to the Unsplash API and the pagination/enrichment
logic the ETL needs. There's only one photo source, so this stays one
module instead of a provider interface with a single implementation.
"""

import logging
from collections.abc import Generator
from typing import Any

import requests

from config import DEFAULT_EXIF_VALUES, DEFAULT_USER_NAME, ETL_STRICT_VALIDATION, FETCH_MODE

logger = logging.getLogger(__name__)

# Minimal canonical photo shape keys the ETL relies on. Additional keys are
# fine, but these must be present for a photo to be synced.
REQUIRED_PHOTO_KEYS = [
    'id',
    'url_regular',
    'url_raw',
    'title',
    'created_at',
    'updated_at',
]


def validate_photo_structure(photo: dict, required_keys: list[str] | None = None) -> bool:
    """Lightweight runtime validation for provider photo dicts.

    Returns True when the photo contains the minimal required keys. This is
    intentionally permissive (no heavy type checking) so it can be
    implemented without a third-party schema dependency. Callers should log
    or raise if strict validation is needed.
    """
    if required_keys is None:
        required_keys = REQUIRED_PHOTO_KEYS

    if not isinstance(photo, dict):
        return False

    return all(k in photo for k in required_keys)


class UnsplashProvider:
    """Fetches photos and collections from the Unsplash API for the ETL.

    Supports a fetch mode controlled by `FETCH_MODE` ('batch' or
    'details'). 'batch' yields photos via the paginated listing endpoint.
    'details' fetches the full `/photos/{id}` payload for every photo so we
    capture tags/EXIF/location for ETL.
    """

    def __init__(
        self,
        access_key: str | None = None,
        username: str | None = None,
        fetch_mode: str | None = None,
    ):
        self.access_key = access_key
        self.username = username
        self.fetch_mode = fetch_mode or FETCH_MODE
        self.base_url = 'https://api.unsplash.com'
        self.headers = {'Authorization': f'Client-ID {self.access_key}'} if self.access_key else {}

        # Stateless by design. The ETL runs once per day and downstream
        # systems own any caching/rate-limiting concerns.

    # ----- Public ETL interface -----

    def get_collections(self) -> Generator[dict[str, Any], None, None]:
        """Yield collections for the configured user."""
        logger.info(f'Fetching collections for user "{self.username}" from Unsplash')

        try:
            collections = self._fetch_user_collections()
            yield from collections
        except Exception as e:
            logger.error(f'Error fetching collections: {e}')

    def get_photos_in_collection(self, collection_id: str) -> Generator[dict[str, Any], None, None]:
        """Yield all photos in a collection, paginating through the listing endpoint."""
        logger.info(f'Fetching photos for collection "{collection_id}" from Unsplash')
        page = 1
        per_page = 30
        while True:
            try:
                photos, has_more = self._fetch_collection_photos(
                    collection_id=collection_id, page=page, per_page=per_page
                )
                if not photos:
                    break

                yield from self._validated(photos)

                if not has_more:
                    break
                page += 1
            except Exception as e:
                logger.error(
                    f'Error fetching photos for collection {collection_id} (page {page}): {e}'
                )
                break

    def get_user_photos(self, username: str) -> Generator[dict[str, Any], None, None]:
        """Yield all photos for a user, in `batch` or `details` fetch mode."""
        logger.info(
            f'Fetching all photos for user "{username}" from Unsplash (mode={self.fetch_mode})'
        )

        if self.fetch_mode == 'details':
            logger.info('Using "details" fetch mode — fetching full details for all photos')
            yield from self._detailed_user_photo_generator()
            return

        page = 1
        per_page = 30
        while True:
            try:
                photos, has_more = self._fetch_latest_user_photos(page=page, per_page=per_page)
                if not photos:
                    break

                yield from self._validated(photos)

                if not has_more:
                    break
                page += 1
            except Exception as e:
                logger.error(f'Error fetching photos for user {username} (page {page}): {e}')
                break

    def enrich_photo_with_details(self, photo: dict, force_enrich: bool = False) -> dict:
        """Fetch and merge full photo details (EXIF, location) into a photo dict.

        Call this explicitly for photos that need detailed metadata. Returns the
        enriched photo dict (modifies in-place and returns for convenience).

        Args:
            photo: Photo dict from listing APIs (must have 'id' key)
            force_enrich: If True, always fetch details even if EXIF is present.
                         Use during --full-load to refresh all metadata.
        """
        exif = photo.get('exif', {})
        has_real_exif = any(
            exif.get(key) and exif.get(key) not in (DEFAULT_EXIF_VALUES.get(key), None)
            for key in DEFAULT_EXIF_VALUES
        )

        if force_enrich or not has_real_exif:
            try:
                photo_id = photo.get('id')
                if photo_id:
                    logger.info(f'Enriching photo {photo_id} with detailed metadata')
                    details = self._fetch_photo_details(photo_id)
                    if details:
                        photo.update(
                            {
                                'exif': details.get('exif', {}),
                                'location': details.get('location') or photo.get('location'),
                            }
                        )
            except Exception as e:
                logger.warning(f'Failed to enrich photo {photo.get("id")} with details: {e}')
        return photo

    # ----- Validation helper -----

    def _validated(self, photos: list[dict[str, Any]]) -> Generator[dict[str, Any], None, None]:
        for photo in photos:
            if not validate_photo_structure(photo):
                msg = f'Invalid photo shape from Unsplash provider (missing required keys): {photo.get("id", "<no-id>")}'
                if ETL_STRICT_VALIDATION:
                    logger.error(msg)
                    raise ValueError(msg)
                logger.warning(msg + ' — skipping')
                continue
            yield photo

    # ----- Detail-mode merging -----

    def _build_urls(self, photo: dict[str, Any]) -> dict[str, str]:
        """Normalize URLs whether coming from transformed or raw payloads."""
        urls = photo.get('urls') or {}
        return {
            'raw': urls.get('raw') or photo.get('url_raw'),
            'full': urls.get('full') or photo.get('url_full'),
            'regular': urls.get('regular') or photo.get('url_regular'),
            'small': urls.get('small') or photo.get('url_small'),
            'thumb': urls.get('thumb') or photo.get('url_thumb'),
        }

    def _merge_listing_and_details(
        self, listing: dict[str, Any], details: dict[str, Any]
    ) -> dict[str, Any]:
        """Merge lightweight listing data with detailed payload.

        - Preserve views/downloads/likes from listing when details omit them
        - Ensure URLs exist in Unsplash-style nested `urls` format
        - Prefer detailed fields while keeping listing fallbacks
        """

        merged = {**details} if details else {}

        merged.setdefault('id', listing.get('id'))
        merged.setdefault('created_at', listing.get('created_at'))
        merged.setdefault('updated_at', listing.get('updated_at'))

        stats = merged.get('statistics') or {}
        if listing.get('views') is not None:
            stats.setdefault('views', {'total': listing.get('views')})
        if listing.get('downloads') is not None:
            stats.setdefault('downloads', {'total': listing.get('downloads')})
        if stats:
            merged['statistics'] = stats

        if 'likes' not in merged and listing.get('likes') is not None:
            merged['likes'] = listing.get('likes')

        if not merged.get('urls'):
            merged['urls'] = self._build_urls(listing)

        merged.setdefault('user', listing.get('user'))
        merged.setdefault('links', listing.get('links'))

        return merged

    def _detailed_user_photo_generator(self) -> Generator[dict[str, Any], None, None]:
        """Yield all user photos with full detail payloads (tags/EXIF/location)."""
        page = 1
        per_page = 30

        while True:
            try:
                photos, has_more = self._fetch_latest_user_photos(page=page, per_page=per_page)
                if not photos:
                    break

                for photo in photos:
                    photo_id = photo.get('id')
                    if not photo_id:
                        continue

                    details = self._fetch_photo_details(photo_id) or {}
                    merged = self._merge_listing_and_details(photo, details)

                    try:
                        transformed = self._transform_photo_data([merged])[0]
                    except Exception as e:
                        logger.warning(
                            f'Failed to transform detailed photo {photo_id}, using raw payload: {e}'
                        )
                        transformed = merged

                    if not validate_photo_structure(transformed):
                        msg = f'Invalid photo shape from Unsplash provider (missing required keys): {photo_id}'
                        if ETL_STRICT_VALIDATION:
                            logger.error(msg)
                            raise ValueError(msg)
                        logger.warning(msg + ' — skipping')
                        continue

                    yield transformed

                if not has_more:
                    break
                page += 1
            except Exception as e:
                logger.error(f'Error fetching detailed photos for user (page {page}): {e}')
                break

    # ----- Unsplash HTTP calls -----

    def _transform_photo_data(self, photos: list[dict]) -> list[dict]:
        """Transform photo data from API response to our canonical format.

        Note: This does NOT fetch additional details - use enrich_photo_with_details
        for that. This keeps listing fast and allows the ETL to decide what to enrich.
        """
        photo_data = []
        for photo in photos:
            statistics = photo.get('statistics', {})
            views = statistics.get('views', {}).get('total', 0) if statistics else 0
            downloads = statistics.get('downloads', {}).get('total', 0) if statistics else 0

            photo_data.append(
                {
                    'id': photo['id'],
                    'url': photo.get('urls', {}).get('full', ''),
                    'url_full': photo.get('urls', {}).get('full', ''),
                    'url_raw': photo.get('urls', {}).get('raw', ''),
                    'url_regular': photo.get('urls', {}).get('regular', ''),
                    'url_small': photo.get('urls', {}).get('small', ''),
                    'url_thumb': photo.get('urls', {}).get('thumb', ''),
                    'title': photo.get('alt_description') or 'Untitled',
                    'description': photo.get('description', ''),
                    'alt_description': photo.get('alt_description', ''),
                    'views': views,
                    'downloads': downloads,
                    'width': photo.get('width', 1),
                    'height': photo.get('height', 1),
                    'created_at': photo.get('created_at', ''),
                    'updated_at': photo.get('updated_at', ''),
                    'color': photo.get('color', '#000000'),
                    'blur_hash': photo.get('blur_hash', ''),
                    'exif': {
                        'make': photo.get('exif', {}).get('make') or DEFAULT_EXIF_VALUES['make'],
                        'model': photo.get('exif', {}).get('model') or DEFAULT_EXIF_VALUES['model'],
                        'exposure_time': photo.get('exif', {}).get('exposure_time')
                        or DEFAULT_EXIF_VALUES['exposure_time'],
                        'aperture': photo.get('exif', {}).get('aperture')
                        or DEFAULT_EXIF_VALUES['aperture'],
                        'focal_length': photo.get('exif', {}).get('focal_length')
                        or DEFAULT_EXIF_VALUES['focal_length'],
                        'iso': photo.get('exif', {}).get('iso') or DEFAULT_EXIF_VALUES['iso'],
                    },
                    'location': {
                        'name': photo.get('location', {}).get('name')
                        if photo.get('location')
                        else None,
                        'city': photo.get('location', {}).get('city')
                        if photo.get('location')
                        else None,
                        'country': photo.get('location', {}).get('country')
                        if photo.get('location')
                        else None,
                        'position': photo.get('location', {}).get('position')
                        if photo.get('location')
                        else None,
                    },
                    'tags': [tag.get('title', '') for tag in photo.get('tags', [])],
                    'user': {
                        'name': photo.get('user', {}).get('name') or DEFAULT_USER_NAME,
                        'username': photo.get('user', {}).get('username', ''),
                        'portfolio_url': photo.get('user', {}).get('portfolio_url', ''),
                        'profile_url': (
                            f'https://unsplash.com/@{photo.get("user", {}).get("username", "")}'
                            if photo.get('user', {}).get('username')
                            else ''
                        ),
                    },
                    'links': {
                        'html': photo.get('links', {}).get('html', ''),
                        'download': photo.get('links', {}).get('download', ''),
                        'download_location': photo.get('links', {}).get('download_location', ''),
                    },
                }
            )
        return photo_data

    def _fetch_user_collections(self) -> list[dict]:
        if not self.access_key or not self.username:
            logger.warning('No Unsplash API key - cannot fetch collections')
            return []

        logger.info(f'Fetching collections for user: {self.username}')
        try:
            response = requests.get(
                f'{self.base_url}/users/{self.username}/collections',
                headers=self.headers,
                timeout=10,
            )
            response.raise_for_status()
            collections = response.json()
            collection_data = []
            for i, c in enumerate(collections):
                cover = c.get('cover_photo') or {}
                urls = cover.get('urls') or {}
                collection_data.append(
                    {
                        'id': c.get('id'),
                        'title': c.get('title'),
                        'description': c.get('description', ''),
                        'total_photos': c.get('total_photos', 0),
                        'cover_photo': {
                            'url': urls.get('regular', ''),
                            'url_raw': urls.get('raw', ''),
                            'url_small': urls.get('small', ''),
                            'color': cover.get('color', '#ccc'),
                        },
                        'published_at': c.get('published_at', ''),
                        'updated_at': c.get('updated_at', ''),
                        'featured': i < 2,
                    }
                )
            return collection_data
        except Exception as e:
            logger.error(f'Error fetching collections: {e}', exc_info=True)
            return []

    def _fetch_latest_user_photos(
        self, page: int = 1, per_page: int = 30, order_by: str = 'popular'
    ) -> tuple[list[dict], bool]:
        """Fetch a single page of user photos and return (photos, has_more)."""
        if not self.access_key or not self.username:
            logger.warning('No Unsplash API key - cannot fetch latest photos')
            return [], False

        logger.info(f'Fetching user photos (order: {order_by}), page {page}')
        try:
            response = requests.get(
                f'{self.base_url}/users/{self.username}/photos',
                headers=self.headers,
                params={'page': page, 'per_page': per_page, 'order_by': order_by, 'stats': 'true'},
                timeout=10,
            )
            response.raise_for_status()
            photos = response.json()
            photo_data = self._transform_photo_data(photos)
            link_header = response.headers.get('Link', '')
            has_more = 'rel="next"' in link_header
            if not link_header:
                has_more = len(photos) == per_page
            return photo_data, has_more
        except Exception as e:
            logger.error(f'Error fetching latest photos: {e}', exc_info=True)
            return [], False

    def _fetch_collection_photos(
        self, collection_id: str, page: int = 1, per_page: int = 30
    ) -> tuple[list[dict], bool]:
        """Fetch a single page of photos from a collection and return (photos, has_more)."""
        if not self.access_key:
            logger.warning('No Unsplash API key - cannot fetch collection photos')
            return [], False

        logger.info(f'Fetching collection {collection_id}, page {page}')
        try:
            response = requests.get(
                f'{self.base_url}/collections/{collection_id}/photos',
                headers=self.headers,
                params={'page': page, 'per_page': per_page, 'order_by': 'latest'},
                timeout=10,
            )
            response.raise_for_status()
            photos = response.json()
            photo_data = self._transform_photo_data(photos)
            link_header = response.headers.get('Link', '')
            has_more = 'rel="next"' in link_header
            if not link_header:
                has_more = len(photos) == per_page
            return photo_data, has_more
        except Exception as e:
            logger.error(f'Error fetching collection photos: {e}', exc_info=True)
            return [], False

    def _fetch_photo_details(self, photo_id: str) -> dict:
        if not self.access_key:
            logger.warning('No Unsplash API key - cannot fetch photo details')
            return {}

        logger.info(f'Fetching details for photo {photo_id} from Unsplash API')
        url = f'{self.base_url}/photos/{photo_id}'
        try:
            response = requests.get(url, headers=self.headers, timeout=10)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f'Error fetching photo details: {e}', exc_info=True)
            return {}

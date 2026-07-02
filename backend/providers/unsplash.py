"""Unsplash API provider"""

import logging
from collections.abc import Generator
from typing import Any

from backend.providers.base import validate_photo_structure
from backend.unsplash_client import UnsplashClient
from config import ETL_STRICT_VALIDATION, FETCH_MODE

from .base import BaseProvider

logger = logging.getLogger(__name__)


class UnsplashProvider(BaseProvider):
    """Provider for fetching data from the Unsplash API using UnsplashClient.

    Supports a fetch mode controlled by `FETCH_MODE` ('batch' or
    'details'). 'batch' yields photos via the client's paginated helper.
    'details' fetches the full `/photos/{id}` payload for every photo so we
    capture tags/EXIF/location for ETL.
    """

    def __init__(self, client: UnsplashClient, fetch_mode: str | None = None):
        self.client = client
        self.fetch_mode = fetch_mode or FETCH_MODE

    def get_collections(self) -> Generator[dict[str, Any], None, None]:
        """Yield collections for the configured user (uses client's collection endpoint).

        Uses `fetch_user_collections` which returns a list; we yield each item.
        """
        username = getattr(self.client, 'username', None)
        logger.info(f'Fetching collections for user "{username}" from Unsplash')

        try:
            collections = self.client.fetch_user_collections()
            # `fetch_user_collections` returns a list; yield directly.
            yield from collections
        except Exception as e:
            logger.error(f'Error fetching collections: {e}')

    def get_photos_in_collection(self, collection_id: str) -> Generator[dict[str, Any], None, None]:
        """Yield all photos in a collection, paginating via the client's helper."""
        logger.info(f'Fetching photos for collection "{collection_id}" from Unsplash')
        page = 1
        per_page = 30
        while True:
            try:
                photos, has_more = self.client.fetch_collection_photos(
                    collection_id=collection_id, page=page, per_page=per_page
                )
                if not photos:
                    break

                for photo in photos:
                    # Validate provider output shape before yielding
                    if not validate_photo_structure(photo):
                        msg = f'Invalid photo shape from Unsplash provider (missing required keys): {photo.get("id", "<no-id>")}'
                        if ETL_STRICT_VALIDATION:
                            logger.error(msg)
                            raise ValueError(msg)
                        else:
                            logger.warning(msg + ' — skipping')
                            continue
                    yield photo

                if not has_more:
                    break
                page += 1
            except Exception as e:
                logger.error(
                    f'Error fetching photos for collection {collection_id} (page {page}): {e}'
                )
                break

    def _enrich_photo_with_tags(self, photo: dict[str, Any]) -> dict[str, Any]:
        """Fetch and merge tags for a photo from the individual photo endpoint.

        The collection photos endpoint doesn't return tags, so we fetch them
        separately from the /photos/{id} endpoint and extract tags using the
        client's _transform_photo_data method to ensure consistency.

        Args:
            photo: Photo dict from collection endpoint (may lack tags)

        Returns:
            Photo dict with tags field populated if available
        """
        try:
            photo_id = photo.get('id')
            if not photo_id:
                return photo

            # Fetch full photo details which includes tags
            details = self.client.fetch_photo_details(photo_id)
            if details:
                # Extract tags using the same method as the transform pipeline
                tags = [tag.get('title', '') for tag in details.get('tags', [])]
                photo['tags'] = tags
                if tags:
                    logger.debug(f'Enriched photo {photo_id} with {len(tags)} tags: {tags[:3]}...')
            return photo
        except Exception as e:
            logger.warning(f'Failed to enrich photo {photo.get("id", "unknown")} with tags: {e}')
            # Return original photo without tags rather than failing
            return photo

    def get_user_photos(self, username: str) -> Generator[dict[str, Any], None, None]:
        """Yield all photos for a user. The client is expected to be configured
        with a username; this method will use the client's pagination helper.
        """
        logger.info(
            f'Fetching all photos for user "{username}" from Unsplash (mode={self.fetch_mode})'
        )

        # 'details' mode: fetch all photos with full `/photos/{id}` payloads
        if self.fetch_mode == 'details':
            logger.info('Using "details" fetch mode — fetching full details for all photos')
            yield from self._detailed_user_photo_generator()
            return

        # Default/batch mode: paginate through user photos
        page = 1
        per_page = 30
        while True:
            try:
                photos, has_more = self.client.fetch_latest_user_photos(
                    page=page, per_page=per_page
                )
                if not photos:
                    break

                for photo in photos:
                    # Validate provider output shape before yielding
                    if not validate_photo_structure(photo):
                        msg = f'Invalid photo shape from Unsplash provider (missing required keys): {photo.get("id", "<no-id>")}'
                        if ETL_STRICT_VALIDATION:
                            logger.error(msg)
                            raise ValueError(msg)
                        else:
                            logger.warning(msg + ' — skipping')
                            continue
                    yield photo

                if not has_more:
                    break
                page += 1
            except Exception as e:
                logger.error(f'Error fetching photos for user {username} (page {page}): {e}')
                break

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

        # Required identity fields
        merged.setdefault('id', listing.get('id'))
        merged.setdefault('created_at', listing.get('created_at'))
        merged.setdefault('updated_at', listing.get('updated_at'))

        # Stats fallbacks
        stats = merged.get('statistics') or {}
        if listing.get('views') is not None:
            stats.setdefault('views', {'total': listing.get('views')})
        if listing.get('downloads') is not None:
            stats.setdefault('downloads', {'total': listing.get('downloads')})
        if stats:
            merged['statistics'] = stats

        if 'likes' not in merged and listing.get('likes') is not None:
            merged['likes'] = listing.get('likes')

        # URL normalisation
        if not merged.get('urls'):
            merged['urls'] = self._build_urls(listing)

        # Preserve user/links fallbacks if missing
        merged.setdefault('user', listing.get('user'))
        merged.setdefault('links', listing.get('links'))

        return merged

    def _detailed_user_photo_generator(self) -> Generator[dict[str, Any], None, None]:
        """Yield all user photos with full detail payloads (tags/EXIF/location)."""
        page = 1
        per_page = 30

        while True:
            try:
                photos, has_more = self.client.fetch_latest_user_photos(
                    page=page, per_page=per_page
                )
                if not photos:
                    break

                for photo in photos:
                    photo_id = photo.get('id')
                    if not photo_id:
                        continue

                    # Fetch full detail payload for tags/EXIF/location
                    details = self.client.fetch_photo_details(photo_id) or {}
                    merged = self._merge_listing_and_details(photo, details)

                    # Transform into canonical provider shape (adds url_* keys)
                    try:
                        transformed = self.client._transform_photo_data([merged])[0]
                    except Exception as e:
                        logger.warning(
                            f'Failed to transform detailed photo {photo_id}, using raw payload: {e}'
                        )
                        transformed = merged

                    # Validate provider output shape before yielding
                    if not validate_photo_structure(transformed):
                        msg = f'Invalid photo shape from Unsplash provider (missing required keys): {photo_id}'
                        if ETL_STRICT_VALIDATION:
                            logger.error(msg)
                            raise ValueError(msg)
                        else:
                            logger.warning(msg + ' — skipping')
                            continue

                    yield transformed

                if not has_more:
                    break
                page += 1
            except Exception as e:
                logger.error(f'Error fetching detailed photos for user (page {page}): {e}')
                break

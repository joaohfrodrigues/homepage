"""ETL script to sync photos from a provider to local database"""

import argparse
import logging
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from backend.database import (
    get_db_connection,
    get_existing_photos_map,
    init_database,
    insert_collection,
    insert_photo,
    link_photo_to_collection,
)
from backend.providers.base import BaseProvider
from backend.providers.unsplash import UnsplashProvider
from backend.slug import slugify
from backend.unsplash_client import UnsplashClient
from config import DEFAULT_USER_NAME

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
)
logger = logging.getLogger(__name__)


def _dedupe_slug(conn, base_slug: str) -> str:
    """Ensure slug uniqueness by appending a numeric suffix when needed."""
    cursor = conn.cursor()
    slug = base_slug
    suffix = 2
    cursor.execute('SELECT 1 FROM collections WHERE slug = ? LIMIT 1', (slug,))
    while cursor.fetchone():
        slug = f'{base_slug}-{suffix}'
        suffix += 1
        cursor.execute('SELECT 1 FROM collections WHERE slug = ? LIMIT 1', (slug,))
    return slug


def transform_photo(photo: dict) -> dict:
    """Transform API photo data to our database schema

    Provider is responsible for enriching photo data (EXIF, location, etc.)
    based on its configuration. This function is provider-agnostic.

    Args:
        photo: Photo data from the provider (already enriched if needed)
    """
    # Extract statistics. Providers may either supply a flattened integer
    # `views`/`downloads` at the top-level (our service transforms) or a
    # nested `statistics` object (raw Unsplash API). Prefer flattened
    # top-level values when present to avoid losing popularity data.
    views = photo.get('views')
    downloads = photo.get('downloads')
    if views is None:
        stats = photo.get('statistics') or {}
        views_data = stats.get('views') or {}
        views = views_data.get('total', 0) if views_data else 0
    if downloads is None:
        stats = photo.get('statistics') or {}
        downloads_data = stats.get('downloads') or {}
        downloads = downloads_data.get('total', 0) if downloads_data else 0

    # Provider may return either raw Unsplash API shape (with `urls` dict)
    # or a flattened canonical shape (with `url_regular`, `url_raw`, ...).
    # Prefer flattened keys, then fall back to nested `urls`.
    def _url(field: str) -> str:
        # field is one of: 'raw','full','regular','small','thumb'
        flat = photo.get(f'url_{field}')
        if flat:
            return flat
        urls = photo.get('urls') or {}
        return urls.get(field, '')

    # Extract location, EXIF, user, and tags
    location = photo.get('location') or {}
    exif = photo.get('exif') or {}
    user = photo.get('user') or {}
    # Tags may arrive as dict objects (Unsplash details) or already flattened
    # strings (from transformed listings). Normalize to titles only.
    tags_raw = photo.get('tags') or []
    tags: list[str] = []
    for tag in tags_raw:
        if isinstance(tag, str):
            if tag:
                tags.append(tag)
        elif isinstance(tag, dict):
            title = tag.get('title')
            if title:
                tags.append(title)

    transformed = {
        'id': photo['id'],
        'title': photo.get('title') or photo.get('alt_description') or 'Untitled',
        'description': photo.get('description', ''),
        'alt_description': photo.get('alt_description', ''),
        'created_at': photo.get('created_at', ''),
        'updated_at': photo.get('updated_at', ''),
        'width': photo.get('width', 0),
        'height': photo.get('height', 0),
        'color': photo.get('color', '#000000'),
        'blur_hash': photo.get('blur_hash', ''),
        'views': views,
        'downloads': downloads,
        'likes': photo.get('likes', 0),
        'url_raw': photo.get('url_raw') or _url('raw'),
        'url_full': photo.get('url_full') or _url('full'),
        'url_regular': photo.get('url_regular') or _url('regular'),
        'url_small': photo.get('url_small') or _url('small'),
        'url_thumb': photo.get('url_thumb') or _url('thumb'),
        'photographer_name': user.get('name') or DEFAULT_USER_NAME,
        'photographer_username': user.get('username', ''),
        'photographer_url': f'https://unsplash.com/@{user.get("username", "")}'
        if user.get('username')
        else '',
        'photographer_avatar': photo.get('photographer_avatar')
        or (user.get('profile_image') or {}).get('large', ''),
        'location_name': location.get('name'),
        'location_city': location.get('city'),
        'location_country': location.get('country'),
        'location_latitude': (location.get('position') or {}).get('latitude'),
        'location_longitude': (location.get('position') or {}).get('longitude'),
        'exif_make': exif.get('make'),
        'exif_model': exif.get('model'),
        'exif_exposure_time': exif.get('exposure_time'),
        'exif_aperture': exif.get('aperture'),
        'exif_focal_length': exif.get('focal_length'),
        'exif_iso': str(exif.get('iso')) if exif.get('iso') else None,
        'tags': tags,
        'unsplash_url': (photo.get('links') or {}).get('html', ''),
        'download_location': (photo.get('links') or {}).get('download_location', ''),
        'last_synced_at': datetime.now(timezone.utc).isoformat(),
    }

    return transformed


def _process_user_photos(
    conn,
    provider: BaseProvider,
    username: str,
    existing_photos: dict,
    max_photos: int | None,
    full_load: bool,
):
    """Process user photos lazily, enriching only when needed.

    Returns: tuple(photo_ids_set, total_synced)
    """
    total_synced = 0
    total_skipped = 0
    photo_ids: set = set()

    logger.info(f'\nSyncing all photos for user "{username}"')
    user_photos_generator = provider.get_user_photos(username)

    idx = 0
    for photo in user_photos_generator:
        if max_photos and idx >= max_photos:
            break

        try:
            photo_id = photo['id']
            # Skip if incremental mode and photo hasn't been updated
            if not full_load and photo_id in existing_photos:
                db_updated_at = existing_photos[photo_id]
                api_updated_at = photo.get('updated_at', '')
                if db_updated_at and api_updated_at and db_updated_at >= api_updated_at:
                    total_skipped += 1
                    photo_ids.add(photo_id)
                    idx += 1
                    continue

            # Enrich EXIF/location when missing (function short-circuits if already present)
            if getattr(provider, 'client', None) and hasattr(
                provider.client, 'enrich_photo_with_details'
            ):
                provider.client.enrich_photo_with_details(photo, force_enrich=full_load)

            # Transform and insert
            photo_data = transform_photo(photo)
            insert_photo(conn, photo_data)
            photo_ids.add(photo_id)
            total_synced += 1
            idx += 1
            if idx % 10 == 0:
                logger.info(
                    f'  Processed {idx} user photos (synced: {total_synced}, skipped: {total_skipped})'
                )
        except Exception as e:
            logger.error(f'Error syncing user photo {photo.get("id")}: {e}', exc_info=True)

    conn.commit()
    logger.info(f'Committed user photos (synced: {total_synced}, skipped: {total_skipped})')

    return photo_ids, total_synced, total_skipped


def _process_collections(
    conn,
    provider: BaseProvider,
    photo_ids: set,
    existing_photos: dict,
    max_photos: int | None,
    full_load: bool,
):
    """Process collections and link photos. Returns (collections_synced, photos_synced, photos_skipped)"""
    total_collections_synced = 0
    total_photos_synced = 0
    total_skipped = 0

    logger.info('\nSyncing collections')
    collections_generator = provider.get_collections()
    for collection in collections_generator:
        try:
            # Insert collection metadata
            base_slug = slugify(collection.get('title', ''))
            collection_slug = _dedupe_slug(conn, base_slug)

            collection_data = {
                'id': collection['id'],
                'title': collection['title'],
                'slug': collection_slug,
                'description': collection.get('description', ''),
                'total_photos': collection.get('total_photos', 0),
                'published_at': collection.get('published_at'),
                'updated_at': collection.get('updated_at'),
                'cover_photo_id': (
                    collection.get('cover_photo', {}).get('id')
                    if collection.get('cover_photo')
                    else None
                ),
                'cover_photo_url': (
                    (collection.get('cover_photo') or {}).get('url')
                    or (collection.get('cover_photo') or {}).get('url_regular')
                    or (collection.get('cover_photo') or {}).get('url_raw')
                    or (collection.get('cover_photo', {}).get('urls', {}) or {}).get('regular')
                ),
                'last_synced_at': datetime.now(timezone.utc).isoformat(),
            }
            insert_collection(conn, collection_data)
            total_collections_synced += 1

            # Link photos to the collection
            logger.info(f'Linking photos for collection: {collection["title"]}')
            collection_photos_generator = provider.get_photos_in_collection(collection['id'])

            collection_photo_count = 0
            for photo in collection_photos_generator:
                if max_photos and collection_photo_count >= max_photos:
                    break

                photo_id = photo['id']
                if photo_id not in photo_ids:
                    try:
                        if not full_load and photo_id in existing_photos:
                            db_updated_at = existing_photos[photo_id]
                            api_updated_at = photo.get('updated_at', '')
                            if db_updated_at and api_updated_at and db_updated_at >= api_updated_at:
                                total_skipped += 1
                                photo_ids.add(photo_id)
                                collection_photo_count += 1
                                continue

                        # Enrich EXIF/location when missing (function short-circuits if already present)
                        if getattr(provider, 'client', None) and hasattr(
                            provider.client, 'enrich_photo_with_details'
                        ):
                            provider.client.enrich_photo_with_details(photo, force_enrich=full_load)

                        photo_data = transform_photo(photo)
                        insert_photo(conn, photo_data)
                        photo_ids.add(photo_id)
                        total_photos_synced += 1
                    except Exception as e:
                        logger.error(f'Error syncing collection photo {photo.get("id")}: {e}')

                # Link photo to collection
                link_photo_to_collection(
                    conn,
                    photo['id'],
                    collection['id'],
                    photo.get('created_at', datetime.now(timezone.utc).isoformat()),
                )
                collection_photo_count += 1

            conn.commit()
            logger.info(
                f'Committed {total_collections_synced} collections and linked {collection_photo_count} photos'
            )
        except Exception as e:
            logger.error(f'Error syncing collection {collection.get("id")}: {e}')
            conn.rollback()

    return total_collections_synced, total_photos_synced, total_skipped


def sync_data(
    provider: BaseProvider, username: str, max_photos: int | None = None, full_load: bool = False
):
    """Main ETL function to sync data from a provider to the database

    Args:
        provider: Data provider instance
        username: Username to sync
        max_photos: Limit number of photos (for testing)
        full_load: If True, sync all photos. If False (default), only sync photos
                   that have been updated since last sync.
    """
    logger.info('=' * 60)
    logger.info(f'Starting data sync from provider: {type(provider).__name__}')
    logger.info(f'Sync mode: {"FULL LOAD" if full_load else "INCREMENTAL"}')
    logger.info('=' * 60)

    # Initialize database
    init_database()

    total_photos_synced = 0
    total_skipped = 0
    total_collections_synced = 0

    with get_db_connection() as conn:
        # Get existing photos for incremental sync
        existing_photos = {} if full_load else get_existing_photos_map(conn)
        # Process user photos and collections via extracted helpers
        photo_ids, user_synced, user_skipped = _process_user_photos(
            conn, provider, username, existing_photos, max_photos, full_load
        )
        total_photos_synced += user_synced
        total_skipped += user_skipped

        collections_synced, collections_photos_synced, collections_photos_skipped = (
            _process_collections(conn, provider, photo_ids, existing_photos, max_photos, full_load)
        )
        total_collections_synced += collections_synced
        total_photos_synced += collections_photos_synced
        total_skipped += collections_photos_skipped

    logger.info('=' * 60)
    logger.info('Sync completed!')
    logger.info(f'Collections synced: {total_collections_synced}')
    logger.info(f'Photos synced: {total_photos_synced}')
    logger.info(f'Photos skipped (unchanged): {total_skipped}')
    logger.info(f'Total photos processed: {total_photos_synced + total_skipped}')
    logger.info('=' * 60)


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description='Sync photos from a provider to local database')
    parser.add_argument(
        '--max-photos',
        type=int,
        default=None,
        help='Maximum photos per user/collection (for testing, default: all)',
    )
    parser.add_argument(
        '--test',
        action='store_true',
        help='Test mode: sync only 5 photos per user/collection',
    )
    parser.add_argument(
        '--full-load',
        action='store_true',
        help='Full load: sync all photos (default: incremental - only updated photos)',
    )
    parser.add_argument(
        '--fetch-mode',
        type=str,
        choices=['batch', 'details'],
        default=None,
        help='Photo fetch mode: batch (fast, basic data) or details (slower, includes EXIF). Defaults to FETCH_MODE env var.',
    )

    args = parser.parse_args()

    # Load environment variables
    load_dotenv()

    access_key = os.getenv('UNSPLASH_ACCESS_KEY')
    username = os.getenv('UNSPLASH_USERNAME', 'joaohfrodrigues')
    fetch_mode = args.fetch_mode or os.getenv('FETCH_MODE', 'batch')

    if not access_key:
        logger.error('UNSPLASH_ACCESS_KEY not found in environment')
        sys.exit(1)

    logger.info(f'Using fetch mode: {fetch_mode}')

    # Initialize the provider with fetch mode
    unsplash_client = UnsplashClient(access_key, username, fetch_mode=fetch_mode)
    provider = UnsplashProvider(unsplash_client)

    max_photos = 5 if args.test else args.max_photos

    try:
        sync_data(provider, username, max_photos, full_load=args.full_load)
    except Exception as e:
        logger.error(f'Sync failed: {e}', exc_info=True)
        sys.exit(1)


if __name__ == '__main__':
    main()

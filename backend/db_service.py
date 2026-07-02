"""Database service layer for reading photo data"""

import json
import logging
from typing import Any

from backend.database import get_db_connection
from backend.slug import slugify
from config import DEFAULT_USER_NAME

logger = logging.getLogger(__name__)


def _row_to_dict(row) -> dict[str, Any]:
    """Convert SQLite Row to dictionary with proper data types"""
    data = dict(row)

    # Parse JSON `tags` field into a Python list. If parsing fails, fall back
    # to an empty list. ETL now guarantees the `tags` column stores JSON.
    try:
        tags = json.loads(data.get('tags') or '[]')
    except (json.JSONDecodeError, TypeError):
        tags = []

    # The ETL enforces a canonical photo schema, so we do a minimal mapping
    # here: return a dictionary shaped for the frontend but avoid heavy
    # defensive logic — if fields are missing that's an ETL bug and should
    # be surfaced earlier.
    return {
        'id': data['id'],
        'url': data.get('url_regular'),
        'url_raw': data.get('url_raw'),
        'url_regular': data.get('url_regular'),
        'url_thumb': data.get('url_small'),
        'title': data.get('title') or '',
        'description': data.get('description') or '',
        'alt_description': data.get('alt_description') or '',
        'views': data.get('views') or 0,
        'downloads': data.get('downloads') or 0,
        'likes': data.get('likes') or 0,
        'width': data.get('width') or 0,
        'height': data.get('height') or 0,
        'created_at': data.get('created_at') or '',
        'updated_at': data.get('updated_at') or '',
        'color': data.get('color') or '#000000',
        'blur_hash': data.get('blur_hash') or '',
        'exif': {
            'make': data.get('exif_make'),
            'model': data.get('exif_model'),
            'exposure_time': data.get('exif_exposure_time'),
            'aperture': data.get('exif_aperture'),
            'focal_length': data.get('exif_focal_length'),
            'iso': data.get('exif_iso'),
        },
        'location': {
            'name': data.get('location_name'),
            'city': data.get('location_city'),
            'country': data.get('location_country'),
        },
        'tags': tags,
        'user': {
            'name': data.get('photographer_name') or DEFAULT_USER_NAME,
            'username': data.get('photographer_username') or '',
            'profile_url': data.get('photographer_url') or '',
        },
        'links': {
            'html': data.get('unsplash_url') or '',
            'download_location': data.get('download_location') or '',
        },
        'statistics': {
            'views': {'total': data.get('views') or 0},
            'downloads': {'total': data.get('downloads') or 0},
        },
    }


def get_latest_photos(
    page: int = 1, per_page: int = 30, order_by: str = 'popular'
) -> tuple[list[dict], bool]:
    """
    Get latest photos with pagination and ordering.

    Args:
        page: Page number (1-indexed)
        per_page: Photos per page
        order_by: 'popular' (views), 'latest' (created_at), or 'oldest'

    Returns:
        Tuple of (photos list, has_more boolean)
    """
    offset = (page - 1) * per_page

    # Determine order by clause
    # Build order clause - whitelist to prevent SQL injection
    if order_by == 'latest':
        order_clause = 'created_at DESC'
    elif order_by == 'oldest':
        order_clause = 'created_at ASC'
    else:  # popular
        order_clause = 'views DESC, created_at DESC'

    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Get photos - order_clause is from whitelisted values only
        cursor.execute(  # nosec B608 - order_clause is from whitelisted values
            f"""
            SELECT * FROM photos
            ORDER BY {order_clause}
            LIMIT ? OFFSET ?
        """,
            (per_page + 1, offset),  # Fetch one extra to check if there's more
        )

        rows = cursor.fetchall()

        # Check if there are more results
        has_more = len(rows) > per_page
        photos = [_row_to_dict(row) for row in rows[:per_page]]

        logger.info(
            f'Fetched {len(photos)} photos (page {page}, order: {order_by}, has_more: {has_more})'
        )

        return photos, has_more


def get_collection_photos(
    collection_id: str, page: int = 1, per_page: int = 30, order_by: str = 'created'
) -> tuple[list[dict], bool]:
    """
    Get photos from a specific collection.

    Returns:
        Tuple of (photos list, has_more boolean)
    """
    offset = (page - 1) * per_page

    with get_db_connection() as conn:
        cursor = conn.cursor()

        order_clause = (
            'p.created_at DESC' if order_by != 'popular' else 'p.views DESC, p.created_at DESC'
        )

        cursor.execute(
            f"""
            SELECT p.* FROM photos p
            JOIN photo_collections pc ON p.id = pc.photo_id
            WHERE pc.collection_id = ?
            ORDER BY {order_clause}
            LIMIT ? OFFSET ?
        """,
            (collection_id, per_page + 1, offset),
        )

        rows = cursor.fetchall()

        has_more = len(rows) > per_page
        photos = [_row_to_dict(row) for row in rows[:per_page]]

        logger.info(
            f'Fetched {len(photos)} photos for collection {collection_id} (page {page}, has_more: {has_more})'
        )

        return photos, has_more


def get_all_collections() -> list[dict]:
    """Get all collections with metadata"""
    with get_db_connection() as conn:
        cursor = conn.cursor()

        cursor.execute("""
            SELECT
                c.id,
                c.title,
                c.slug,
                c.description,
                c.total_photos,
                c.updated_at,
                c.published_at,
                COALESCE(
                    (
                        SELECT p.url_regular
                        FROM photos p
                        JOIN photo_collections pc ON pc.photo_id = p.id
                        WHERE pc.collection_id = c.id
                        ORDER BY p.views DESC
                        LIMIT 1
                    ),
                    c.cover_photo_url
                ) AS cover_photo_url
            FROM collections c
            ORDER BY c.updated_at DESC
        """)

        rows = cursor.fetchall()

        collections = []
        for row in rows:
            collections.append(
                {
                    'id': row['id'],
                    'title': row['title'],
                    'slug': row['slug'] or slugify(row['title']),
                    'description': row['description'] or '',
                    'total_photos': row['total_photos'],
                    'updated_at': row['updated_at'],
                    'published_at': row['published_at'],
                    'cover_photo': {'url': row['cover_photo_url']},
                }
            )

        logger.info(f'Fetched {len(collections)} collections')
        return collections


def get_collection_by_slug(slug: str) -> dict | None:
    """Get a collection by its slug.

    Args:
        slug: Collection slug (e.g., '25-valencia')

    Returns:
        Collection dict or None if not found
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()

        cursor.execute(
            """
            SELECT
                c.id,
                c.title,
                c.slug,
                c.description,
                c.total_photos,
                c.updated_at,
                c.published_at,
                c.cover_photo_url
            FROM collections c
            WHERE c.slug = ? OR (c.slug IS NULL AND ? = ?)
            LIMIT 1
        """,
            (slug, slugify(slug), slug),
        )

        row = cursor.fetchone()

        if not row:
            return None

        return {
            'id': row['id'],
            'title': row['title'],
            'slug': row['slug'] or slugify(row['title']),
            'description': row['description'] or '',
            'total_photos': row['total_photos'],
            'updated_at': row['updated_at'],
            'published_at': row['published_at'],
            'cover_photo': {'url': row['cover_photo_url']},
        }


def get_collection_by_id(collection_id: str) -> dict | None:
    """Get a collection by its original Unsplash ID."""

    with get_db_connection() as conn:
        cursor = conn.cursor()

        cursor.execute(
            """
            SELECT
                c.id,
                c.title,
                c.slug,
                c.description,
                c.total_photos,
                c.updated_at,
                c.published_at,
                c.cover_photo_url
            FROM collections c
            WHERE c.id = ?
            LIMIT 1
        """,
            (collection_id,),
        )

        row = cursor.fetchone()

        if not row:
            return None

        return {
            'id': row['id'],
            'title': row['title'],
            'slug': row['slug'] or slugify(row['title']),
            'description': row['description'] or '',
            'total_photos': row['total_photos'],
            'updated_at': row['updated_at'],
            'published_at': row['published_at'],
            'cover_photo': {'url': row['cover_photo_url']},
        }


def search_photos(
    query: str = '',
    page: int = 1,
    per_page: int = 30,
    order_by: str = 'popular',
    collection_id: str = None,
) -> tuple[list[dict], bool]:
    """
    Search and filter photos with pagination.

    Args:
        query: Search query (empty string for no search)
        page: Page number (1-indexed)
        per_page: Photos per page
        order_by: 'popular', 'latest', or 'oldest'
        collection_id: Optional collection ID to filter by

    Returns:
        Tuple of (photos list, has_more boolean)
    """
    offset = (page - 1) * per_page

    # Determine order clause
    if order_by == 'latest':
        order_clause = 'p.created_at DESC'
    elif order_by == 'oldest':
        order_clause = 'p.created_at ASC'
    else:  # popular
        order_clause = 'p.views DESC, p.created_at DESC'

    # Start building the query
    sql_query = 'SELECT p.* FROM photos p'
    params = []
    where_clauses = []

    if query:
        sql_query += ' JOIN photos_fts fts ON p.rowid = fts.rowid'
        where_clauses.append('photos_fts MATCH ?')
        params.append(query)

    if collection_id:
        # Ensure JOIN is added if not already present
        if 'JOIN photo_collections' not in sql_query:
            sql_query += ' JOIN photo_collections pc ON p.id = pc.photo_id'
        where_clauses.append('pc.collection_id = ?')
        params.append(collection_id)

    if where_clauses:
        sql_query += ' WHERE ' + ' AND '.join(where_clauses)

    # The f-string is safe because order_clause is built from a whitelist
    sql_query += f' ORDER BY {order_clause} LIMIT ? OFFSET ?'  # nosec B608
    params.extend([per_page + 1, offset])

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(sql_query, tuple(params))

        rows = cursor.fetchall()
        has_more = len(rows) > per_page
        photos = [_row_to_dict(row) for row in rows[:per_page]]

        search_str = f" matching '{query}'" if query else ''
        collection_str = f' in collection {collection_id}' if collection_id else ''
        logger.info(
            f'Fetched {len(photos)} photos{search_str}{collection_str} (page {page}, order: {order_by}, has_more: {has_more})'
        )

        return photos, has_more


def get_photo_by_id(photo_id: str) -> dict | None:
    """Get a single photo by ID"""
    with get_db_connection() as conn:
        cursor = conn.cursor()

        cursor.execute('SELECT * FROM photos WHERE id = ?', (photo_id,))
        row = cursor.fetchone()

        if row:
            return _row_to_dict(row)
        return None


def get_database_stats() -> dict:
    """Get database statistics"""
    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Total photos
        cursor.execute('SELECT COUNT(*) FROM photos')
        total_photos = cursor.fetchone()[0]

        # Total collections
        cursor.execute('SELECT COUNT(*) FROM collections')
        total_collections = cursor.fetchone()[0]

        # Total views and downloads
        cursor.execute('SELECT SUM(views), SUM(downloads) FROM photos')
        row = cursor.fetchone()
        total_views = row[0] or 0
        total_downloads = row[1] or 0

        return {
            'total_photos': total_photos,
            'total_collections': total_collections,
            'total_views': total_views,
            'total_downloads': total_downloads,
        }


def get_collection_stats() -> dict:
    """Get statistics for each collection (total views, downloads, etc.)"""
    with get_db_connection() as conn:
        cursor = conn.cursor()

        cursor.execute("""
            SELECT
                c.id,
                c.total_photos,
                COALESCE(SUM(p.views), 0) as total_views,
                COALESCE(SUM(p.downloads), 0) as total_downloads,
                COALESCE(SUM(p.likes), 0) as total_likes
            FROM collections c
            LEFT JOIN photo_collections pc ON c.id = pc.collection_id
            LEFT JOIN photos p ON pc.photo_id = p.id
            GROUP BY c.id
        """)

        stats = {}
        for row in cursor.fetchall():
            stats[row[0]] = {
                'total_photos': row[1],
                'total_views': row[2],
                'total_downloads': row[3],
                'total_likes': row[4],
            }

        return stats

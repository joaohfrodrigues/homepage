"""Database module for SQLite operations"""

import json
import logging
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Any

from backend.slug import slugify

logger = logging.getLogger(__name__)

# Database file location
DB_PATH = Path(__file__).parent.parent / 'data' / 'photos.db'


def get_db_path() -> Path:
    """Get the database file path"""
    return DB_PATH


@contextmanager
def get_db_connection():
    """Context manager for database connections"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row  # Enable dict-like access
    try:
        yield conn
    finally:
        conn.close()


def init_database():
    """Initialize the database with schema"""
    logger.info(f'Initializing database at {DB_PATH}')

    # Ensure data directory exists
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)

    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Create collections table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS collections (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                slug TEXT UNIQUE,
                description TEXT,
                total_photos INTEGER DEFAULT 0,
                published_at TEXT,
                updated_at TEXT,
                cover_photo_id TEXT,
                cover_photo_url TEXT,
                last_synced_at TEXT
            )
        """)

        # Create photos table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS photos (
                -- Primary identification
                id TEXT PRIMARY KEY,

                -- Photo metadata
                title TEXT,
                description TEXT,
                alt_description TEXT,

                -- Dates
                created_at TEXT,
                updated_at TEXT,

                -- Dimensions & visual
                width INTEGER,
                height INTEGER,
                color TEXT,
                blur_hash TEXT,

                -- Statistics
                views INTEGER DEFAULT 0,
                downloads INTEGER DEFAULT 0,
                likes INTEGER DEFAULT 0,

                -- URLs
                url_raw TEXT,
                url_full TEXT,
                url_regular TEXT,
                url_small TEXT,
                url_thumb TEXT,

                -- Photographer
                photographer_name TEXT,
                photographer_username TEXT,
                photographer_url TEXT,
                photographer_avatar TEXT,

                -- Location
                location_name TEXT,
                location_city TEXT,
                location_country TEXT,
                location_latitude REAL,
                location_longitude REAL,

                -- EXIF
                exif_make TEXT,
                exif_model TEXT,
                exif_exposure_time TEXT,
                exif_aperture TEXT,
                exif_focal_length TEXT,
                exif_iso TEXT,

                -- Tags (JSON array as TEXT)
                tags TEXT,

                -- Links
                unsplash_url TEXT,
                download_location TEXT,

                -- Sync metadata
                last_synced_at TEXT
            )
        """)

        # Create photo_collections junction table (many-to-many)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS photo_collections (
                photo_id TEXT NOT NULL,
                collection_id TEXT NOT NULL,
                added_at TEXT,
                PRIMARY KEY (photo_id, collection_id),
                FOREIGN KEY (photo_id) REFERENCES photos(id) ON DELETE CASCADE,
                FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
            )
        """)

        # Create indexes for common queries
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_photos_created ON photos(created_at DESC)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_photos_updated ON photos(updated_at DESC)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_photos_views ON photos(views DESC)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_photos_downloads ON photos(downloads DESC)')
        cursor.execute(
            'CREATE INDEX IF NOT EXISTS idx_photo_collections_photo ON photo_collections(photo_id)'
        )
        cursor.execute(
            'CREATE INDEX IF NOT EXISTS idx_photo_collections_collection ON photo_collections(collection_id)'
        )
        cursor.execute(
            'CREATE INDEX IF NOT EXISTS idx_collections_updated ON collections(updated_at DESC)'
        )

        # Create full-text search table
        cursor.execute("""
            CREATE VIRTUAL TABLE IF NOT EXISTS photos_fts USING fts5(
                id UNINDEXED,
                title,
                description,
                alt_description,
                tags,
                location_name,
                location_city,
                location_country,
                content=photos,
                content_rowid=rowid
            )
        """)

        conn.commit()
        logger.info('Database initialized successfully')


def insert_collection(conn: sqlite3.Connection, collection_data: dict[str, Any]) -> None:
    """Insert or update a collection in the database"""
    cursor = conn.cursor()
    # Use an UPSERT that updates existing rows in-place to avoid DELETE/INSERT
    # behavior which can trigger ON DELETE CASCADE or change rowid values.
    cursor.execute(
        """
        INSERT INTO collections (
            id, title, slug, description, total_photos, published_at, updated_at,
            cover_photo_id, cover_photo_url, last_synced_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            title=COALESCE(excluded.title, collections.title),
            slug=COALESCE(excluded.slug, collections.slug),
            description=COALESCE(excluded.description, collections.description),
            total_photos=COALESCE(excluded.total_photos, collections.total_photos),
            published_at=COALESCE(excluded.published_at, collections.published_at),
            updated_at=COALESCE(excluded.updated_at, collections.updated_at),
            cover_photo_id=COALESCE(excluded.cover_photo_id, collections.cover_photo_id),
            cover_photo_url=COALESCE(excluded.cover_photo_url, collections.cover_photo_url),
            last_synced_at=COALESCE(excluded.last_synced_at, collections.last_synced_at)
    """,
        (
            collection_data.get('id'),
            collection_data.get('title'),
            collection_data.get('slug') or slugify(collection_data.get('title') or ''),
            collection_data.get('description'),
            collection_data.get('total_photos', 0),
            collection_data.get('published_at'),
            collection_data.get('updated_at'),
            collection_data.get('cover_photo_id'),
            collection_data.get('cover_photo_url'),
            collection_data.get('last_synced_at'),
        ),
    )


def insert_photo(conn: sqlite3.Connection, photo_data: dict[str, Any]) -> None:
    """Insert or update a photo in the database"""
    cursor = conn.cursor()

    # Convert tags list to JSON string
    tags_json = json.dumps(photo_data.get('tags', []))

    # Use an UPSERT that updates existing rows without performing a DELETE.
    # `INSERT OR REPLACE` performs a DELETE followed by INSERT which can
    # trigger ON DELETE CASCADE and remove related rows (e.g. photo_collections).
    # Using `ON CONFLICT(id) DO UPDATE` preserves the rowid and avoids cascades.
    cursor.execute(
        """
        INSERT INTO photos (
            id, title, description, alt_description,
            created_at, updated_at,
            width, height, color, blur_hash,
            views, downloads, likes,
            url_raw, url_full, url_regular, url_small, url_thumb,
            photographer_name, photographer_username, photographer_url, photographer_avatar,
            location_name, location_city, location_country, location_latitude, location_longitude,
            exif_make, exif_model, exif_exposure_time, exif_aperture, exif_focal_length, exif_iso,
            tags, unsplash_url, download_location, last_synced_at
        ) VALUES (
            ?, ?, ?, ?,
            ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?
        )
        ON CONFLICT(id) DO UPDATE SET
            title=COALESCE(excluded.title, photos.title),
            description=COALESCE(excluded.description, photos.description),
            alt_description=COALESCE(excluded.alt_description, photos.alt_description),
            created_at=COALESCE(excluded.created_at, photos.created_at),
            updated_at=COALESCE(excluded.updated_at, photos.updated_at),
            width=COALESCE(excluded.width, photos.width),
            height=COALESCE(excluded.height, photos.height),
            color=COALESCE(excluded.color, photos.color),
            blur_hash=COALESCE(excluded.blur_hash, photos.blur_hash),
            views=COALESCE(excluded.views, photos.views),
            downloads=COALESCE(excluded.downloads, photos.downloads),
            likes=COALESCE(excluded.likes, photos.likes),
            url_raw=COALESCE(excluded.url_raw, photos.url_raw),
            url_full=COALESCE(excluded.url_full, photos.url_full),
            url_regular=COALESCE(excluded.url_regular, photos.url_regular),
            url_small=COALESCE(excluded.url_small, photos.url_small),
            url_thumb=COALESCE(excluded.url_thumb, photos.url_thumb),
            photographer_name=COALESCE(excluded.photographer_name, photos.photographer_name),
            photographer_username=COALESCE(excluded.photographer_username, photos.photographer_username),
            photographer_url=COALESCE(excluded.photographer_url, photos.photographer_url),
            photographer_avatar=COALESCE(excluded.photographer_avatar, photos.photographer_avatar),
            location_name=COALESCE(excluded.location_name, photos.location_name),
            location_city=COALESCE(excluded.location_city, photos.location_city),
            location_country=COALESCE(excluded.location_country, photos.location_country),
            location_latitude=COALESCE(excluded.location_latitude, photos.location_latitude),
            location_longitude=COALESCE(excluded.location_longitude, photos.location_longitude),
            exif_make=COALESCE(excluded.exif_make, photos.exif_make),
            exif_model=COALESCE(excluded.exif_model, photos.exif_model),
            exif_exposure_time=COALESCE(excluded.exif_exposure_time, photos.exif_exposure_time),
            exif_aperture=COALESCE(excluded.exif_aperture, photos.exif_aperture),
            exif_focal_length=COALESCE(excluded.exif_focal_length, photos.exif_focal_length),
            exif_iso=COALESCE(excluded.exif_iso, photos.exif_iso),
            tags=COALESCE(excluded.tags, photos.tags),
            unsplash_url=COALESCE(excluded.unsplash_url, photos.unsplash_url),
            download_location=COALESCE(excluded.download_location, photos.download_location),
            last_synced_at=COALESCE(excluded.last_synced_at, photos.last_synced_at)
    """,
        (
            photo_data.get('id'),
            photo_data.get('title'),
            photo_data.get('description'),
            photo_data.get('alt_description'),
            photo_data.get('created_at'),
            photo_data.get('updated_at'),
            photo_data.get('width'),
            photo_data.get('height'),
            photo_data.get('color'),
            photo_data.get('blur_hash'),
            photo_data.get('views', 0),
            photo_data.get('downloads', 0),
            photo_data.get('likes', 0),
            photo_data.get('url_raw'),
            photo_data.get('url_full'),
            photo_data.get('url_regular'),
            photo_data.get('url_small'),
            photo_data.get('url_thumb'),
            photo_data.get('photographer_name'),
            photo_data.get('photographer_username'),
            photo_data.get('photographer_url'),
            photo_data.get('photographer_avatar'),
            photo_data.get('location_name'),
            photo_data.get('location_city'),
            photo_data.get('location_country'),
            photo_data.get('location_latitude'),
            photo_data.get('location_longitude'),
            photo_data.get('exif_make'),
            photo_data.get('exif_model'),
            photo_data.get('exif_exposure_time'),
            photo_data.get('exif_aperture'),
            photo_data.get('exif_focal_length'),
            photo_data.get('exif_iso'),
            tags_json,
            photo_data.get('unsplash_url'),
            photo_data.get('download_location'),
            photo_data.get('last_synced_at'),
        ),
    )

    # Update FTS index
    cursor.execute(
        """
        INSERT OR REPLACE INTO photos_fts (
            rowid, id, title, description, alt_description, tags,
            location_name, location_city, location_country
        )
        SELECT rowid, id, title, description, alt_description, tags,
               location_name, location_city, location_country
        FROM photos WHERE id = ?
    """,
        (photo_data.get('id'),),
    )


def link_photo_to_collection(
    conn: sqlite3.Connection, photo_id: str, collection_id: str, added_at: str
) -> None:
    """Link a photo to a collection"""
    cursor = conn.cursor()
    cursor.execute(
        """
        INSERT OR IGNORE INTO photo_collections (photo_id, collection_id, added_at)
        VALUES (?, ?, ?)
    """,
        (photo_id, collection_id, added_at),
    )


def get_photo_count() -> int:
    """Get total number of photos in database"""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT COUNT(*) FROM photos')
        return cursor.fetchone()[0]


def get_existing_photos_map(conn: sqlite3.Connection) -> dict[str, str]:
    """Get map of photo_id -> updated_at for all existing photos

    Returns:
        Dictionary mapping photo ID to its updated_at timestamp from the DB
    """
    cursor = conn.cursor()
    cursor.execute('SELECT id, updated_at FROM photos')
    return {row[0]: row[1] for row in cursor.fetchall()}


def get_collection_count() -> int:
    """Get total number of collections in database"""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT COUNT(*) FROM collections')
        return cursor.fetchone()[0]

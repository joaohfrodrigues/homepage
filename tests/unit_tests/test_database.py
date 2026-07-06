"""Tests for database module"""

import json

import pytest

import backend.database as db_module
from backend.database import (
    get_db_connection,
    init_database,
    insert_collection,
    insert_photo,
    link_photo_to_collection,
)


@pytest.fixture
def test_db(tmp_path):
    """Create a temporary test database"""
    # Override DB_PATH for testing
    original_path = db_module.DB_PATH
    db_module.DB_PATH = tmp_path / 'test_photos.db'

    # Initialize test database
    init_database()

    yield db_module.DB_PATH

    # Cleanup
    db_module.DB_PATH = original_path


def test_init_database(test_db):
    """Test database initialization creates tables and indexes"""
    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Check photos table exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='photos'")
        assert cursor.fetchone() is not None

        # Check FTS table exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='photos_fts'")
        assert cursor.fetchone() is not None

        # Check collections table exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='collections'")
        assert cursor.fetchone() is not None

        # Check photo_collections junction table exists
        cursor.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='photo_collections'"
        )
        assert cursor.fetchone() is not None


def test_insert_photo(test_db):
    """Test inserting a photo into the database"""
    test_photo = {
        'id': 'test123',
        'title': 'Test Photo',
        'description': 'A beautiful test photo',
        'alt_description': 'Test alt',
        'created_at': '2024-01-01T00:00:00Z',
        'updated_at': '2024-01-01T00:00:00Z',
        'width': 1920,
        'height': 1080,
        'color': '#FF5733',
        'blur_hash': 'LKO2?U%2Tw=w]~RBVZRi};RPxuwH',
        'views': 100,
        'downloads': 10,
        'likes': 5,
        'url_raw': 'https://example.com/raw.jpg',
        'url_full': 'https://example.com/full.jpg',
        'url_regular': 'https://example.com/regular.jpg',
        'url_small': 'https://example.com/small.jpg',
        'url_thumb': 'https://example.com/thumb.jpg',
        'photographer_name': 'John Doe',
        'photographer_username': 'johndoe',
        'photographer_url': 'https://unsplash.com/@johndoe',
        'photographer_avatar': 'https://example.com/avatar.jpg',
        'location_name': 'Test Location',
        'location_city': 'Test City',
        'location_country': 'Test Country',
        'location_latitude': 40.7128,
        'location_longitude': -74.0060,
        'exif_make': 'Canon',
        'exif_model': 'EOS 5D',
        'exif_exposure_time': '1/125',
        'exif_aperture': 'f/2.8',
        'exif_focal_length': '50mm',
        'exif_iso': '400',
        'tags': ['nature', 'landscape', 'test'],
        'unsplash_url': 'https://unsplash.com/photos/test123',
        'download_location': 'https://api.unsplash.com/download/test123',
        'last_synced_at': '2024-01-01T00:00:00Z',
    }

    with get_db_connection() as conn:
        insert_photo(conn, test_photo)
        conn.commit()

        # Verify photo was inserted
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM photos WHERE id = ?', ('test123',))
        row = cursor.fetchone()

        assert row is not None
        assert row['id'] == 'test123'
        assert row['title'] == 'Test Photo'
        assert row['width'] == 1920
        assert row['views'] == 100

        # Verify tags are stored as JSON
        tags = json.loads(row['tags'])
        assert tags == ['nature', 'landscape', 'test']


def test_insert_photo_upsert(test_db):
    """Test that inserting the same photo twice updates it"""
    photo_v1 = {
        'id': 'test456',
        'title': 'Original Title',
        'views': 100,
        'tags': ['tag1'],
        'width': 1920,
        'height': 1080,
        'last_synced_at': '2024-01-01T00:00:00Z',
    }

    photo_v2 = {
        'id': 'test456',
        'title': 'Updated Title',
        'views': 200,
        'tags': ['tag1', 'tag2'],
        'width': 1920,
        'height': 1080,
        'last_synced_at': '2024-01-02T00:00:00Z',
    }

    with get_db_connection() as conn:
        # Insert first version
        insert_photo(conn, photo_v1)
        conn.commit()

        # Insert updated version
        insert_photo(conn, photo_v2)
        conn.commit()

        # Verify only one row exists with updated data
        cursor = conn.cursor()
        cursor.execute('SELECT COUNT(*) FROM photos WHERE id = ?', ('test456',))
        assert cursor.fetchone()[0] == 1

        cursor.execute('SELECT * FROM photos WHERE id = ?', ('test456',))
        row = cursor.fetchone()
        assert row['title'] == 'Updated Title'
        assert row['views'] == 200


def test_fts_index_updated(test_db):
    """Test that FTS index is updated when photo is inserted"""
    test_photo = {
        'id': 'test789',
        'title': 'Searchable Photo',
        'description': 'This photo contains searchable content',
        'tags': ['searchable', 'test'],
        'width': 1920,
        'height': 1080,
    }

    with get_db_connection() as conn:
        insert_photo(conn, test_photo)
        conn.commit()

        # Search using FTS
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT p.id FROM photos p
            JOIN photos_fts fts ON p.rowid = fts.rowid
            WHERE photos_fts MATCH 'searchable'
        """
        )
        result = cursor.fetchone()

        assert result is not None
        assert result['id'] == 'test789'


def test_upsert_preserves_links(test_db):
    """Ensure that upserting a photo does not remove links to collections"""
    photo = {
        'id': 'link-test',
        'title': 'Linked Photo',
        'width': 800,
        'height': 600,
        'tags': [],
        'last_synced_at': '2024-01-01T00:00:00Z',
    }

    collection = {
        'id': 'col-1',
        'title': 'Test Collection',
        'total_photos': 1,
        'published_at': '2024-01-01T00:00:00Z',
        'updated_at': '2024-01-01T00:00:00Z',
        'last_synced_at': '2024-01-01T00:00:00Z',
    }

    photo_updated = {
        'id': 'link-test',
        'title': 'Linked Photo (updated)',
        'views': 42,
        'last_synced_at': '2024-01-02T00:00:00Z',
    }

    with get_db_connection() as conn:
        # Insert collection and photo, link them
        insert_collection(conn, collection)
        insert_photo(conn, photo)
        link_photo_to_collection(conn, photo['id'], collection['id'], '2024-01-01T00:00:00Z')
        conn.commit()

        # Upsert the photo with updated fields
        insert_photo(conn, photo_updated)
        conn.commit()

        # Ensure the photo still links to the collection
        cursor = conn.cursor()
        cursor.execute(
            'SELECT COUNT(*) FROM photo_collections WHERE photo_id = ? AND collection_id = ?',
            (photo['id'], collection['id']),
        )
        assert cursor.fetchone()[0] == 1

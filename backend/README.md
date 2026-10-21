# Backend Architecture

The backend is a set of Python ETL pipelines that sync external data into the repo, so the site
never calls those APIs at request time:

- **Unsplash → SQLite** (`etl.py`) - photos and collections into `data/photos.db`, which the
    Next.js frontend reads directly with `better-sqlite3`.
- **Plex → Keystatic** (`plex_etl.py`) - watch history into one YAML file per title under
    `content/watch-items/`.

## Structure

```text
backend/
├── __init__.py
├── database.py      # SQLite schema and write operations
├── db_service.py    # Python query layer (used by tests and ad-hoc checks)
├── etl.py           # Unsplash sync pipeline
├── plex_etl.py      # Plex watch-history sync pipeline
├── slug.py          # URL slug helper shared by both pipelines
└── providers/
    ├── unsplash.py  # Unsplash API client: pagination, enrichment, transforms
    └── tmdb.py      # TMDB poster lookup, fallback for Plex items with no thumbnail

data/
└── photos.db        # SQLite database (committed to git)
```

## Database Schema

### Tables

**photos** (46 fields)

- Photo details: id, title, description, dimensions, colors
- Statistics: views, downloads, likes
- EXIF data: camera make/model, exposure, aperture, ISO, focal length
- Location: name, city, country, coordinates (lat/long)
- Photographer: name, username, profile URL
- URLs: raw, full, regular, small, thumb
- Timestamps: created_at, updated_at, last_synced_at

**collections** (9 fields)

- Collection metadata: id, title, description
- Statistics: total_photos
- Timestamps: published_at, updated_at, last_synced_at
- Cover photo: cover_photo_id, cover_photo_url

**photo_collections** (Junction table)

- photo_id (FK → photos.id)
- collection_id (FK → collections.id)
- added_at timestamp
- Composite primary key (photo_id, collection_id)

### Indexes

- FTS5 virtual table for full-text search across photos
- Composite index on (photo_id, collection_id) in junction table
- Individual indexes on foreign keys

## Unsplash ETL (`etl.py`)

```bash
python backend/etl.py                       # Incremental sync (only updated photos)
python backend/etl.py --full-load           # Re-sync every photo
python backend/etl.py --test                # Test mode (5 photos per user/collection)
python backend/etl.py --max-photos 10       # Limit photos per user/collection
python backend/etl.py --fetch-mode details  # Fetch per-photo details (EXIF, location)
```

Needs `UNSPLASH_ACCESS_KEY` (and optionally `UNSPLASH_USERNAME`) in `.env`.

### Sync strategy

1. **User photos** - fetches the user's photos with statistics. In incremental mode (the default),
    photos unchanged since the last sync are skipped.
2. **Collections** - fetches the user's collections, syncs their photos, and links photos to
    collections in `photo_collections`.

`--fetch-mode` (or the `FETCH_MODE` env var) picks how photos are fetched: `batch` (the CLI default)
uses list endpoints only and is fast; `details` also fetches each photo's details endpoint for EXIF
and location, but only for photos that don't have real EXIF yet. Slugs are deduplicated so every
photo gets a unique URL.

## Plex ETL (`plex_etl.py`)

```bash
python backend/plex_etl.py                     # Plex's entire retained history
python backend/plex_etl.py --since 2026-01-01  # Bound a historical backfill
```

Needs `PLEX_URL` and `PLEX_TOKEN`; `TMDB_API_KEY` is optional and fills in missing posters. Films
map to `film` and episodes are aggregated into one `series` entry once at least 3 episodes have been
watched. Visibility is driven by the Plex rating (8/10 or higher is shown), a manual `hidden` edit in
Keystatic survives until the rating changes, and hidden entries older than a year are deleted by
`cleanup_stale_hidden_items`. See the root [README](../README.md) for the full rules.

Posters are stored as token-free Plex paths; the site's `/api/watch-poster` route adds `PLEX_TOKEN`
server-side, so the token is never committed.

## Query Layer (`db_service.py`)

The frontend has its own TypeScript query layer (`src/lib/photos.ts`); this Python one is used by
the tests and for inspecting the database:

- `get_latest_photos(...)` - Paginated photos with sorting
- `get_all_collections()` - All collections with cover photos
- `get_collection_photos(...)` - Photos in a collection
- `get_collection_by_slug(slug)` / `get_collection_by_id(id)` - One collection
- `search_photos(...)` - Full-text search
- `get_photo_by_id(photo_id)` - Single photo details
- `get_database_stats()` / `get_collection_stats()` - Database statistics

## Testing

```bash
pytest -v                                       # All unit tests (tests/unit_tests/)
pytest tests/unit_tests/test_plex_etl.py -v     # One file
python -c "from backend.db_service import get_database_stats; print(get_database_stats())"
```

Fixtures for the Unsplash tests are described in
[tests/unit_tests/fixtures/README.md](../tests/unit_tests/fixtures/README.md).

## GitHub Actions

- `.github/workflows/etl.yaml` - daily Unsplash sync; commits the updated `data/photos.db`. Can be
    run manually with a fetch mode and a full-load option.
- `.github/workflows/plex-etl.yaml` - daily Plex sync; commits changed `content/watch-items/` files.

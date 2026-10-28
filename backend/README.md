# Data pipelines

Two Python jobs sync external data into the repo, each on a daily GitHub Actions schedule that
commits the result. The site reads the committed files, never the APIs.

| Pipeline | From → to | Workflow |
| --- | --- | --- |
| `etl.py` | Unsplash → `data/photos.db` (SQLite, read by the site via `better-sqlite3`) | `etl.yaml` |
| `plex_etl.py` | Plex (+ TMDB posters) → one YAML file per title in `content/watch-items/` | `plex-etl.yaml` |

Setup: Python 3.12+, `pip install '.[dev]'`, and a `.env` built from
[.env.example](../.env.example).

## Unsplash (`etl.py`)

Needs `UNSPLASH_ACCESS_KEY` (free tier: 50 requests/hour).

```bash
python backend/etl.py                       # incremental: only photos changed since last sync
python backend/etl.py --full-load           # re-sync everything
python backend/etl.py --test                # 5 photos per collection
python backend/etl.py --fetch-mode details  # also fetch EXIF and location
```

The default `batch` mode uses list endpoints only. `details` calls each photo's endpoint, but only
for photos that don't have EXIF yet. The workflow can be run manually with either mode.

The database has three tables: `photos` (metadata, EXIF, location, stats, URLs), `collections`,
and the `photo_collections` join table, plus an FTS5 table for search. Schema is in `database.py`.
SQLite's `-journal`, `-shm` and `-wal` files are git-ignored.

## Plex (`plex_etl.py`)

Needs `PLEX_URL` and `PLEX_TOKEN`; `TMDB_API_KEY` fills in missing posters.

```bash
python backend/plex_etl.py                     # all of Plex's retained history
python backend/plex_etl.py --since 2026-01-01  # bounded backfill
```

What ends up on the site:

- A series appears once at least 3 episodes are watched, dated by the latest one.
- Only titles rated **8/10 or higher** in Plex are shown. The rest get `hidden: true`.
- A manual `hidden` change in Keystatic sticks until the title is re-rated in Plex.
- Hidden entries older than a year are deleted, unless manually un-hidden.
- Every other field is overwritten on each sync, so fix watch dates in Plex, not in Keystatic.

Posters are stored as token-free Plex paths; `/api/watch-poster` adds the token server-side.

## Layout

```text
database.py      SQLite schema and writes
db_service.py    Python read queries (tests and ad-hoc inspection; the site uses src/lib/photos.ts)
etl.py           Unsplash pipeline
plex_etl.py      Plex pipeline
slug.py          URL slugs shared by both
providers/       Unsplash and TMDB clients
../config.py     shared settings read from the environment
```

## Testing

```bash
pytest                                     # tests/unit_tests
python tests/local_tests/test_unsplash_api.py  # manual check against the live API
```

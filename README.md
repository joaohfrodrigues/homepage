# joaohfrodrigues.com

João Rodrigues' personal site — photography, writing, and hobbies (music, running, watching).
The frontend is a Next.js 15 app (App Router, TypeScript, Tailwind CSS, Keystatic CMS); photo data
and watch items are synced daily by Python ETL pipelines that commit their output straight to
the repo.

## 🏗️ Architecture

- **Frontend** (`src/`) - Next.js 15 App Router site, deployed to Vercel. Reads photo data directly
    from `data/photos.db` (via `better-sqlite3`), watch items from the `watchItems` Keystatic
    collection, and other content from `content/` (Markdown/YAML, managed through Keystatic CMS).
- **ETL pipelines** (`backend/`) - Python scripts that sync data into the repo, each on its own
    daily GitHub Actions schedule:
    - `backend/etl.py` - syncs photos and collections from the Unsplash API into `data/photos.db`
      (`.github/workflows/etl.yaml`).
    - `backend/plex_etl.py` - syncs watch history from a Plex server into one Keystatic content
      file per title under `content/watch-items/*` (each editable/hideable in the CMS), falling
      back to TMDB for posters Plex doesn't have (`.github/workflows/plex-etl.yaml`).

## 🚀 Frontend - Quick Start

```bash
bun install
bun run dev
```

Visit <http://localhost:3000> to see the site.

## 📸 ETL Pipelines - Quick Start

### Prerequisites

- Python 3.12+
- An [Unsplash](https://unsplash.com/developers) API account (free tier: 50 requests/hour) for the
    photo sync
- A Plex server and token for the watch-history sync (optional — see below)

### Setup

1. **Install dependencies:**

    ```bash
    pip install .          # runtime deps
    pip install '.[dev]'   # add lint/test tools
    ```

2. **Set up environment variables:**

    Create a `.env` file in the project root — see [.env.example](./.env.example) for the full list.
    At minimum for the photo sync:

    ```bash
    UNSPLASH_ACCESS_KEY=your_unsplash_access_key
    UNSPLASH_USERNAME=your_unsplash_username
    ```

    Get your Unsplash API key from <https://unsplash.com/oauth/applications>.

3. **Sync photos from Unsplash:**

    ```bash
    python backend/etl.py              # Full sync
    python backend/etl.py --test       # Test mode (5 photos per collection)
    python backend/etl.py --max-photos 10  # Limit photos per collection
    ```

    This fetches photos and collections from Unsplash, extracts EXIF data for featured photos, and
    stores everything in `data/photos.db`.

4. **Sync watch history from Plex (optional):**

    ```bash
    PLEX_URL=http://localhost:32400 PLEX_TOKEN=your_plex_token python backend/plex_etl.py
    ```

    Reads Plex watch history and writes one YAML file per title to `content/watch-items/`. Set
    `TMDB_API_KEY` to fill in posters for items Plex doesn't have a thumbnail for. By default this
    pulls Plex's entire retained history (no date cutoff); pass `--since YYYY-MM-DD` to bound a
    historical backfill, e.g. `python backend/plex_etl.py --since 2026-01-01`. A series only gets a
    Watching entry once at least 3 of its episodes have been watched — its date is the most
    recently watched episode.

    **Rating-based visibility:** only titles rated **8/10 or higher in Plex** show up on `/hobbies`
    by default — everything else (including unrated items) is hidden, reusing the same `hidden`
    checkbox exposed in Keystatic. `hidden` is recomputed from the rating only when the rating
    itself changes since the last sync, so a manual override set through Keystatic (e.g. showing a
    lower-rated title anyway) survives until you re-rate that title in Plex. A failed rating lookup
    is never treated as a rating change, so a flaky request can't silently re-hide something.
    Hidden entries older than a year are deleted automatically at the end of every sync
    (`cleanup_stale_hidden_items`) — an entry you've manually un-hidden is exempt from this too.

    Every field except `hidden` is overwritten on each sync, including `watchedAt` — correct a
    watched date directly in Plex (Plex supports editing it) rather than in Keystatic, since the
    next sync will overwrite a Keystatic edit anyway.

See [backend/README.md](./backend/README.md) for detailed ETL documentation.

### Database Schema

SQLite with three main tables:

- **photos** - Photo metadata (EXIF, location, statistics)
- **collections** - Collection metadata (title, description, dates)
- **photo_collections** - Junction table for many-to-many relationships

Full-text search uses an FTS5 virtual table.

### Automated Sync

- `.github/workflows/etl.yaml` runs daily to sync new photos, update statistics for existing photos,
    and commit the updated database.
- `.github/workflows/plex-etl.yaml` runs daily to sync watch history and commit any changed
    files under `content/watch-items/`.

Vercel then picks up the change on the next deploy.

## 🌐 Deploy to Vercel

1. Push your code to GitHub
2. Import the repository in [Vercel](https://vercel.com)
3. Add environment variables in the project settings
4. Deploy

## 🛠️ Tech Stack

- **[Next.js](https://nextjs.org/)** - React framework (App Router)
- **[Keystatic](https://keystatic.com/)** - Git-backed CMS for content
- **[SQLite](https://www.sqlite.org/)** - Embedded database with FTS5 full-text search
- **[Unsplash API](https://unsplash.com/developers)** - Photo source with CDN
- **[Plex](https://www.plex.tv/) / [TMDB](https://www.themoviedb.org/)** - Watch history source and
    poster fallback
- **[Playwright](https://playwright.dev/)** - End-to-end tests
- **[pytest](https://pytest.org/)** - ETL pipeline tests
- **[Ruff](https://docs.astral.sh/ruff/)** - Python linter and formatter
- **[Vercel](https://vercel.com)** - Deployment platform
- **[GitHub Actions](https://github.com/features/actions)** - CI/CD and daily data sync

## 📚 Documentation

- **[backend/README.md](./backend/README.md)** - Database schema and ETL pipeline details
- **[content/pages/README.md](./content/pages/README.md)** - Managing static content pages
- **[data/README.md](./data/README.md)** - Database file information

## 📁 Project Structure

```text
homepage/
├── .github/
│   └── workflows/       # CI/CD pipelines
│       ├── dev.yaml         # Linting, testing
│       ├── etl.yaml         # Daily photo sync
│       └── plex-etl.yaml    # Daily watch-items sync
├── backend/             # Database and ETL (Python)
│   ├── database.py      # Schema and operations
│   ├── db_service.py    # Query layer
│   ├── providers/       # Unsplash and TMDB API clients
│   ├── etl.py           # Unsplash sync pipeline
│   └── plex_etl.py      # Plex watch-items sync pipeline
├── content/             # Keystatic-managed content (Markdown/YAML)
│   └── watch-items/         # One file per synced film/show (editable/hideable)
├── data/                # Synced data
│   └── photos.db            # Local photo database
├── src/                 # Next.js app (App Router)
│   ├── app/              # Routes and pages
│   ├── components/       # React components
│   └── lib/               # Data access, utilities
├── public/              # Static assets served by Next.js
├── tests/               # Test suites
│   ├── unit_tests/       # Pytest (ETL, database)
│   └── e2e/               # Playwright (frontend)
├── config.py            # ETL configuration
└── pyproject.toml       # Python project config
```

## 🧪 Testing

```bash
pytest -v            # ETL/backend tests
npx playwright test  # Playwright end-to-end tests (frontend)
```

## 🔐 Security

- **Environment Variables:** API keys stored in `.env` (not committed)
- **Dependency Updates:** Dependabot for automated security updates
- **pip-audit:** Dependency vulnerability scan in CI

## 📝 License

MIT License

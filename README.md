# Photography Portfolio - joaohfrodrigues.com

A photography and writing portfolio site. The frontend is a Next.js 15 app (App Router, TypeScript,
Tailwind CSS, Keystatic CMS); photo data is synced from Unsplash into a local SQLite database by a
Python ETL pipeline that runs daily via GitHub Actions.

## 🏗️ Architecture

- **Frontend** (`src/`) - Next.js 15 App Router site, deployed to Vercel. Reads photo data directly
    from `data/photos.db` (via `better-sqlite3`) and content from `content/` (Markdown/YAML, managed
    through Keystatic CMS).
- **ETL pipeline** (`backend/`) - Python scripts that sync photos and collections from the Unsplash
    API into `data/photos.db`. Runs daily via `.github/workflows/etl.yaml`.

## 🚀 Frontend - Quick Start

```bash
bun install
bun run dev
```

Visit <http://localhost:3000> to see the site.

## 📸 ETL Pipeline - Quick Start

### Prerequisites

- Python 3.12+
- An [Unsplash](https://unsplash.com/developers) API account (free tier: 50 requests/hour)

### Setup

1. **Install dependencies:**

    ```bash
    pip install .          # runtime deps
    pip install '.[dev]'   # add lint/test tools
    ```

2. **Set up environment variables:**

    Create a `.env` file in the project root:

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

See [backend/README.md](./backend/README.md) for detailed ETL documentation.

### Database Schema

SQLite with three main tables:

- **photos** - Photo metadata (EXIF, location, statistics)
- **collections** - Collection metadata (title, description, dates)
- **photo_collections** - Junction table for many-to-many relationships

Full-text search uses an FTS5 virtual table.

### Automated Sync

`.github/workflows/etl.yaml` runs daily to sync new photos, update statistics for existing photos,
and commit the updated database. Vercel then picks up the change on the next deploy.

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
- **[Playwright](https://playwright.dev/)** - End-to-end tests
- **[pytest](https://pytest.org/)** - ETL pipeline tests
- **[Ruff](https://docs.astral.sh/ruff/)** - Python linter and formatter
- **[Vercel](https://vercel.com)** - Deployment platform
- **[GitHub Actions](https://github.com/features/actions)** - CI/CD and daily photo sync

## 📚 Documentation

- **[backend/README.md](./backend/README.md)** - Database schema and ETL pipeline details
- **[tests/fixtures/README.md](./tests/fixtures/README.md)** - Test data and fixture documentation
- **[content/pages/README.md](./content/pages/README.md)** - Managing static content pages
- **[data/README.md](./data/README.md)** - Database file information

## 📁 Project Structure

```text
photography-home/
├── .github/
│   └── workflows/       # CI/CD pipelines
│       ├── dev.yaml     # Linting, testing
│       └── etl.yaml     # Daily photo sync
├── backend/             # Database and ETL (Python)
│   ├── database.py      # Schema and operations
│   ├── db_service.py    # Query layer
│   ├── providers/       # Unsplash API client
│   └── etl.py           # Unsplash sync pipeline
├── content/             # Keystatic-managed content (Markdown/YAML)
├── data/                # SQLite database
│   └── photos.db        # Local photo database
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

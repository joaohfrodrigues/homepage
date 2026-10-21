# joaohfrodrigues.com

João Rodrigues' personal site — photography, writing, and hobbies (music, running, watching).
The home page is a pixel-art apartment you walk around: each room leads to part of the site. The
frontend is a Next.js 16 app (App Router, TypeScript, Tailwind CSS, Keystatic CMS) with the house
drawn by Phaser. Photo data and watch items are synced daily by Python ETL pipelines that commit
their output straight to the repo.

## 🏗️ Architecture

- **Frontend** (`src/`) - Next.js 16 App Router site, deployed to Vercel. Reads photo data directly
    from `data/photos.db` (via `better-sqlite3`), watch items from the `watchItems` Keystatic
    collection, and other content from `content/` (Markdown/YAML, managed through Keystatic CMS).
    - **The house** (`src/game/`, `src/components/house/`) - every page under `src/app/(house)/`
      renders inside the house: a Phaser scene with React panels and dialogue on top. See
      [The House](#-the-house) below.
    - **API routes** (`src/app/api/`) - `photos` (paginated/searchable photos from the database),
      `watch-poster` (proxies Plex thumbnails, adding `PLEX_TOKEN` server-side) and `keystatic`
      (the CMS backend).
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

Visit <http://localhost:3000> to see the site, and <http://localhost:3000/keystatic> to edit
content locally (in production the CMS needs the Keystatic GitHub OAuth variables from
[.env.example](./.env.example)).

```bash
bun run lint       # ESLint
bun run typecheck  # TypeScript, no emit
bun run build      # production build
```

## 🏠 The House

The home page is a compact Lisbon flat drawn tile by tile. Walk with the arrow keys/WASD and
interact with <kbd>E</kbd>, <kbd>Space</kbd> or <kbd>Enter</kbd>, or click the floor and the things
on it. <kbd>M</kbd> opens the directory and <kbd>G</kbd> the guestbook. The directory lists the
site's subjects and things to do (with the room and item each lives at), then a floor plan to jump
to a room; picking a subject stands you next to its item before the page opens, so closing it leaves
you there. On touch screens, dragging anywhere brings up a joystick under your thumb, and tapping
the floor walks there. Tapping a thing or person walks you up to it; a second tap (or one tap if
you're already facing it) uses it, so nothing opens by surprise. Furniture and people open the
site's sections:

- **Entrance hall** - running and hiking kit.
- **Living room** - the TV (film & TV) and João himself.
- **Kitchen** - pull a bica, or guess where the fridge-magnet photos were taken.
- **Study** - the wall map (photography by trip), bookshelves (writing), home server, camera and
    drums.
- **Bedroom** - change outfit at the wardrobe, nap until nightfall, step out onto the balcony.

A first visit to the home page opens with a welcome card from João: shortcuts to photos, writing,
films & series and About, or a button to explore the house. Dismissing it is remembered in
`localStorage`, and visitors arriving on a deep link never see it.

Pages over the house have real URLs, so Back closes them. Panels, dialogue and the photo lightbox
aren't pages, but each gets a history entry at the same URL while it is open
(`useHistoryLayer` in `src/components/house/house-navigation.tsx`), so the browser's Back or a
phone's swipe back closes just that layer instead of leaving the site. Closing one any other way
steps back over its entry, and a page opened from a panel takes over the panel's entry, so Back
from that page returns to the house. The welcome card gets no entry: Back from it leaves, as from
any first page.

The house starts at night between 8pm and 7am, visitor's local time. Every room's page also has a
plain HTML version for screen readers, crawlers and visitors without JavaScript.

Where things live:

- `src/game/layout.ts` - the floor plan and rooms; `src/game/furnishings.ts` - what stands where;
    `src/game/house-scene.ts` - the Phaser scene; `src/game/bridge.ts` - events between Phaser and
    React.
- `src/components/house/` - the shell, panels (directory, wardrobe, guestbook, travel map, ...)
    and dialogue.
- `public/house/` - the art: character and furniture atlases cut from LimeZu's
    [Modern Interiors](https://limezu.itch.io/moderninteriors) pack (licence in
    `public/house/LICENSE-limezu.txt`) and the world-map land outlines.

Scripts that generate those assets (outputs are committed, so only re-run them when changing art):

```bash
node scripts/import_limezu.mjs ~/path/to/moderninteriors   # repack character/furniture atlases
python scripts/build_house_map.py ne_50m_land.geojson public/house/world-land.json  # world map
bun run og                                                  # re-snapshot the share image
```

The pack's licence forbids redistributing it, so only the packed atlases are committed — never the
pack itself. `bun run og` needs a running dev server and writes `src/assets/og-image.png`; re-run it
and commit the PNG whenever the house art changes.

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
    python backend/etl.py                       # Incremental sync (only updated photos)
    python backend/etl.py --full-load           # Re-sync every photo
    python backend/etl.py --test                # Test mode (5 photos per collection)
    python backend/etl.py --max-photos 10       # Limit photos per collection
    python backend/etl.py --fetch-mode details  # Fetch per-photo details (EXIF, location)
    ```

    This fetches photos and collections from Unsplash and stores everything in `data/photos.db`.
    `--fetch-mode batch` (the default) is faster but skips per-photo EXIF and location; `details`
    fetches them for photos that don't have real EXIF yet.

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

- **[Next.js](https://nextjs.org/)** 16 / **[React](https://react.dev/)** 19 - App Router framework
- **[Phaser](https://phaser.io/)** 4 - the house's game engine
- **[Tailwind CSS](https://tailwindcss.com/)** 4 - styling
- **[Bun](https://bun.sh/)** - JavaScript package manager and script runner
- **[Keystatic](https://keystatic.com/)** - Git-backed CMS for content
- **[LimeZu Modern Interiors](https://limezu.itch.io/moderninteriors)** - character, plant, rug and
    bed art for the house (most furniture is hand-drawn in code)
- **[Natural Earth](https://www.naturalearthdata.com/)** - land outlines for the world map
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

- **[CLAUDE.md](./CLAUDE.md)** - Rules for working in the repo (incl. the pre-PR documentation pass)
- **[backend/README.md](./backend/README.md)** - Database schema and ETL pipeline details
- **[content/pages/README.md](./content/pages/README.md)** - Managing static content pages
- **[data/README.md](./data/README.md)** - Database file information
- **[tests/unit_tests/fixtures/README.md](./tests/unit_tests/fixtures/README.md)** - Unsplash API
    test fixtures

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
│   ├── articles/            # Writing (Markdoc)
│   ├── projects/            # Article series
│   ├── hobbies/             # One file per hobby
│   ├── events/              # Races, hikes, concerts
│   ├── gear/                # Cameras, drums, shoes
│   ├── pages/               # Static pages (About)
│   └── watch-items/         # One file per synced film/show (editable/hideable)
├── data/                # Synced data
│   └── photos.db            # Local photo database
├── scripts/             # House asset generators (LimeZu import, world map, share image)
├── src/                 # Next.js app (App Router)
│   ├── app/
│   │   ├── (house)/         # Pages rendered inside the house
│   │   ├── api/             # photos, watch-poster, keystatic
│   │   └── keystatic/       # CMS admin UI
│   ├── assets/           # Imported assets (share image)
│   ├── components/       # React components (house/, photography/, writing/, hobby-feed/, ui/)
│   ├── game/             # Phaser scene, floor plan, furniture, characters
│   ├── lib/              # Data access, utilities
│   └── proxy.ts          # Hides the CMS in production unless it's configured
├── public/              # Static assets served by Next.js
│   └── house/               # House atlases and world-map outlines
├── tests/               # Test suites
│   ├── unit_tests/       # Pytest (ETL, database)
│   ├── local_tests/      # Manual checks against the live Unsplash API
│   └── e2e/               # Playwright (frontend)
├── keystatic.config.ts  # CMS collections
├── config.py            # ETL configuration
└── pyproject.toml       # Python project config
```

## 🧪 Testing

```bash
pytest -v            # ETL/backend tests
npx playwright test  # Playwright end-to-end tests (frontend)
```

CI (`.github/workflows/dev.yaml`) runs the pre-commit hooks, `pytest` and `pip-audit`.

## 🔐 Security

- **Environment Variables:** API keys stored in `.env` (not committed)
- **Dependency Updates:** Dependabot for automated security updates
- **pip-audit:** Dependency vulnerability scan in CI

## 📝 License

MIT License

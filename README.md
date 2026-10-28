# joaohfrodrigues.com

João Rodrigues' personal site: photography, writing, work and hobbies. The home page is a
pixel-art Lisbon flat you walk around, and each room leads to part of the site.

## How it fits together

- **Site** (`src/`) — Next.js 16 (App Router, TypeScript, Tailwind) on Vercel. Content lives in
    `content/` as Markdown/YAML, edited through Keystatic CMS at `/keystatic`.
- **The house** (`src/game/`, `src/components/house/`) — a Phaser scene with React panels on top.
    Every page under `src/app/(house)/` opens inside it. See [docs/house.md](./docs/house.md).
- **About page** (`/about`) — who João is and his work, in one page (`/work` redirects there).
    The work half is the Keystatic `work` singleton (`content/work.yaml`); the rest is
    `content/pages/about.md`. Roles in a row at one company show as one stay, dated from joining.
    The CV and email are off while `cvUrl` and `email` are empty; the CV only shows if its file
    exists under `public/`.
- **Data pipelines** (`backend/`) — Python jobs that run daily in GitHub Actions and commit their
    output: Unsplash photos into `data/photos.db`, Plex watch history into `content/watch-items/`.
    The site never calls those APIs at request time. See [backend/README.md](./backend/README.md).
- **Scoreboards** (`src/lib/scores/`) — the only thing visitors write to: opt-in names and scores
    in Upstash Redis. See [docs/scoreboards.md](./docs/scoreboards.md).

API routes in `src/app/api/`: `photos`, `watch-poster` (proxies Plex posters, adding the token
server-side), `scores`, `house/joao`, `weather` (Lisbon's sky from Open-Meteo, cached 30 min) and
`keystatic`.

## Quick start

```bash
bun install
bun run dev        # http://localhost:3000, CMS at /keystatic
```

No environment variables are needed. Without Upstash the scoreboards show as offline; set
`SCORES_STORE=memory` in `.env.local` to try them locally. Every variable is described in
[.env.example](./.env.example).

```bash
bun run lint && bun run typecheck && bun run build
```

For the Python pipelines: `pip install '.[dev]'`, then see [backend/README.md](./backend/README.md).

## Testing

```bash
bun run test:unit    # Bun unit tests (tests/unit_ts)
npx playwright test  # end-to-end (tests/e2e); never touches Upstash or Open-Meteo
pytest               # pipelines and database (tests/unit_tests)
```

Playwright builds the site (`next build`) and serves it with `next start` on port 3100, so it
never reuses the dev server on 3000. It runs in parallel on half the CPU cores, in Chromium's
new headless mode, which draws the house's WebGL canvas on the GPU. The full suite takes
about 45 s. Useful variations:

```bash
npx playwright test tests/e2e/house-beer.spec.ts  # one spec
E2E_DEV=1 npx playwright test                     # against `next dev` instead, for debugging
E2E_PORT=3200 npx playwright test                 # another port
npx playwright test --workers=1                   # one test at a time
```

A server already listening on the port is reused, so stop a stale one after changing app code.
The e2e build sets `NEXT_PUBLIC_E2E=1`, which exposes the game as `window.__house` for the house
specs (`next dev` always does), and dummy Keystatic GitHub values when none are set.

CI (`.github/workflows/dev.yaml`) runs the pre-commit hooks, pytest, the Bun unit tests and
`pip-audit`.

## Deploying

Import the repo in Vercel and add the variables from `.env.example`. For the scoreboards, add
**Upstash for Redis** from the Vercel Marketplace, which sets its URL and token, then add
`SCORES_ADMIN_SECRET` and `HOUSE_OWNER_SECRET`. Each pipeline commit triggers a redeploy.

## Project structure

```text
.github/workflows/  dev.yaml (CI), etl.yaml (photos), plex-etl.yaml (watch history)
backend/            Python pipelines, SQLite schema and API clients
content/            Keystatic content: articles, projects, hobbies, events, gear, pages,
                    watch-items, work.yaml
data/photos.db      photo database written by the Unsplash pipeline
docs/               house, sprite and scoreboard guides
public/house/       character and furniture atlases, sounds, world-map outlines
scripts/            house asset generators; scripts/sprites/ holds the sprite tools
src/app/            pages: (house)/ inside the house, api/, keystatic/
src/components/     React components: house/, photography/, writing/, hobby-feed/, ui/
src/game/           Phaser scene, floor plan, furniture, palette, characters, missions
src/lib/            data access and utilities; scores/ for the scoreboards
tests/              unit_ts/ (Bun), e2e/ (Playwright), unit_tests/ (pytest),
                    local_tests/ (manual, live Unsplash API)
```

## Tech stack

Next.js 16, React 19, Phaser 4, Tailwind 4, Keystatic, Bun · SQLite (`better-sqlite3`) · Upstash
Redis · Unsplash, Plex, TMDB, Open-Meteo · Web Audio API for the house's sound · Playwright, Bun
test, pytest, Ruff · Vercel, GitHub Actions. Characters, plants, rugs, the bed and the trophy
poster come from LimeZu's [Modern Interiors](https://limezu.itch.io/moderninteriors); the rest of
the furniture is drawn in code.

## Documentation

- [docs/house.md](./docs/house.md) — what's in the house and where its code lives
- [docs/drawing-the-house.md](./docs/drawing-the-house.md) — grid sprites, palette and art tools
- [docs/scoreboards.md](./docs/scoreboards.md) — scoreboard and João's-look APIs
- [backend/README.md](./backend/README.md) — pipelines and database
- [content/pages/README.md](./content/pages/README.md) — adding a static page
- [tests/unit_tests/fixtures/README.md](./tests/unit_tests/fixtures/README.md) — Unsplash fixtures
- [CLAUDE.md](./CLAUDE.md) — working rules for the repo, including the documentation standard

## License

MIT

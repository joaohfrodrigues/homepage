# joaohfrodrigues.com

João Rodrigues' personal site — photography, writing, and hobbies (music, running, watching).
The home page is a pixel-art apartment you walk around: each room leads to part of the site. The
frontend is a Next.js 16 app (App Router, TypeScript, Tailwind CSS, Keystatic CMS) with the house
drawn by Phaser. Photo data and watch items are synced daily by Python ETL pipelines that commit
their output straight to the repo. The only data visitors can send is what they choose to post to
the public scoreboards, which live in Upstash Redis.

## 🏗️ Architecture

- **Frontend** (`src/`) - Next.js 16 App Router site, deployed to Vercel. Reads photo data directly
    from `data/photos.db` (via `better-sqlite3`), watch items from the `watchItems` Keystatic
    collection, and other content from `content/` (Markdown/YAML, managed through Keystatic CMS).
    - **The house** (`src/game/`, `src/components/house/`) - every page under `src/app/(house)/`
      renders inside the house: a Phaser scene with React panels and dialogue on top. See
      [The House](#-the-house) below.
    - **API routes** (`src/app/api/`) - `photos` (paginated/searchable photos from the database),
      `watch-poster` (proxies Plex thumbnails, adding `PLEX_TOKEN` server-side), `scores` (the
      public scoreboards, below), `weather` (Lisbon's current sky from
      [Open-Meteo](https://open-meteo.com/), cached for 30 minutes) and `keystatic` (the CMS
      backend).
    - **Scoreboards** (`src/lib/scores/`, `src/app/api/scores/`) - shared names and scores for the
      house's games and Hall of Fame, the one thing on the site visitors write to. Kept in
      [Upstash Redis](https://upstash.com/) (a sorted set per board) behind a small store
      interface, so tests run on an in-memory store and a site without the env vars shows every
      board as offline. See [Scoreboards API](#-scoreboards-api).
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

`bun run dev` needs no environment variables. Without the Upstash ones the public
scoreboards read as offline; set `SCORES_STORE=memory` in `.env.local` to try them with an
in-memory store, or copy the Upstash variables there to use the real one (see
[.env.example](./.env.example)).

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
- **Living room** - the TV (film & TV), João himself, and a record player that puts on a short
    lo-fi loop. On the first chat João introduces himself and points at the contact note on the
    console by the front door; after that he skips the introduction and gives a tip about something
    the visitor hasn't found yet (the bica, the fridge magnets, the study, Zeno...), worked out from
    the guestbook's stats (`joaoTips` in `src/components/house/dialogues.ts`).
- **Kitchen** - pull a bica, or open the fridge to guess where the magnet photos were taken (or
    grab a beer). Each game has a Top 10 tab, and after a new personal best offers to put it on the
    public leaderboard under a name of the visitor's choosing (prefilled with the last one used).
- **Corridor** - the trophy poster opens the leaderboards, a tab per game with the visitor's own
    best, the top 10, and the same opt-in form while that best isn't on the board yet.
- **Study** - the wall map (photography by trip), bookshelves (writing), home server, camera and
    drums.
- **Bedroom** - change outfit at the wardrobe, nap until nightfall, step out onto the balcony.
- **Bathroom** - its old panelled door is stuck shut until its mission swings it open. Inside, the mirror cabinet
    over the sink has paracetamol for the morning after (see the beers below).

Missions are multi-step activities that open up parts of the house. The first, *The stuck door*,
starts once you've tried the bathroom door three times: ask João about it, pull him a perfect bica
for the knack, take it to him, then lift the handle and shoulder the door open, and the bathroom
is open for good. Steps are checked against
the guestbook's stats, things that happen (a perfect bica) or a choice in dialogue; João offers a
hint for any mission under way, and the guestbook shows each one's progress. Missions are defined
in `src/game/missions.ts`; progress is saved with the guestbook's stats, so it survives reloads and
tearing out the guestbook page shuts everything again.

A first visit to the home page opens with a welcome card from João: shortcuts to photos, writing,
films & series and About, or a button to explore the house. Dismissing it is remembered in
`localStorage`, and visitors arriving on a deep link never see it.

The guestbook in the hall keeps the visitor's own tallies (rooms visited, distance walked, bicas,
fridge-magnet scores) and a page of stickers to collect, all in this browser's `localStorage`
(`src/components/house/visitor-stats.ts`; stickers are its `ACHIEVEMENTS`). Earning a sticker pops
up a toast ("★ First sip unlocked") under the HUD for a few seconds, also announced to screen
readers; clicking it opens the guestbook. Announced sticker ids are saved under
`house:stickers-seen`, so a reload doesn't repeat a toast, and stickers earned before toasts existed
are marked seen quietly. A new sticker needs only an entry in `ACHIEVEMENTS` to get its toast.

Pages over the house have real URLs, so Back closes them. Panels, dialogue and the photo lightbox
aren't pages, but each gets a history entry at the same URL while it is open
(`useHistoryLayer` in `src/components/house/house-navigation.tsx`), so the browser's Back or a
phone's swipe back closes just that layer instead of leaving the site. Closing one any other way
steps back over its entry, and a page opened from a panel takes over the panel's entry, so Back
from that page returns to the house. The welcome card gets no entry: Back from it leaves, as from
any first page.

The record player's music is synthesised in the browser with the Web Audio API
(`src/components/house/record-player.ts`), so there's no audio file. It is off by default and only
starts when the visitor presses play (or Enter in its window); it keeps playing around the house
(with a stop button in the HUD) and stops when the tab is hidden. Its volume slider, which the left
and right arrows also move, is the volume of the whole house, music and sound effects alike.

The house also has sound effects (`src/components/house/sfx.ts`), mostly synthesised the same way:
quiet footsteps, a pop when something is used, a blip when someone talks, the stuck bathroom door
rattling and then cracking free, the bathroom cabinet and a paracetamol going down, Zeno's meow, the coffee machine, a chime for each new sticker, a paper rustle at the trophy
poster and a fanfare when a submitted score makes a top 10, plus the hidden behaviours' own: a
heartbeat with each thump of a caffeine overdose, a bottle opening (and a hiccup once dizzy), a
clink for the toast, snoring as the guest nods off and birds when they wake, and the call of a gull
gliding over the roofs. Zeno's meow, the Super Bock and the coffee machine are recordings in
`public/house/sounds/` (credited in `CREDITS.txt` there), with a synthesised stand-in if a file
fails to load. They are on by default but stay silent until the visitor first clicks or presses a
key. The speaker button in the HUD (or the record player's mute) mutes every sound, the record
included; it and the house's volume are remembered in `localStorage`. The music and the effects
share one audio context (`src/components/house/audio.ts`), which sleeps when nothing is playing.

Outside the balcony (`src/game/exterior.ts`, drawn in code and baked once under the house) is a
strip of calçada street below the railing and the neighbour's terracotta roof beside it, fading into
the dark further out; everywhere else the flat sits in the dark. A gull rests on the roof's chimney,
and by day, under a calm sky, others glide past every so often and call, seen only over the street
and the roof. Under `prefers-reduced-motion` only the resting gull stays.

The house keeps Lisbon's time and follows Lisbon's sun (`src/lib/sun.ts`, worked out from the date
with no API), wherever the visitor is. By day, under a sunny sky, the street windows let soft
neutral light onto the floor, golden while the sun is low. From just before sunset to the end of
dusk the house sinks gradually into blue as the lamps come up, and dawn lifts it the same way; the
light catches up with the sun every minute. At night only lamps you can see are on, low and warm
(the floor lamps, the bedside lamp, a lamp on the hall console and festoon bulbs along the balcony),
each lighting a soft patch of the dark around it, while the TV and the study's monitor glow and
throw a cool fan of light down from the screen. The window glass goes dark, with stars and the moon
in its current phase on a clear night. A nap until evening moves the clock on to after the next
dusk, and sleeping, or waking on the sofa, to the next morning; a reload goes back to Lisbon's real
time. To preview a time of day, add `?time=21:15` (Lisbon time) to the URL.

Lisbon's real weather shows through the street windows in the top walls and on the balcony: the
glass goes grey under cloud, as do the street and roof outside, rain runs down the panes and streaks
across the balcony, a storm brings the odd lightning flash, and the balcony's view mentions it.
Cloud dims the sunlight and rain shuts it out. The back walls show no windows from inside. The HUD
shows a cloud icon when the sky isn't clear. The sky comes from `/api/weather` (Open-Meteo, no API
key, cached for 30 minutes) and falls back to clear if that fails. Under `prefers-reduced-motion`
the drops hold still and there's no lightning. To preview a sky, add `?weather=clear`, `cloudy`,
`rain` or `storm` to the URL. Every room's page also has a plain HTML version for screen readers,
crawlers and visitors without JavaScript.

There are hidden behaviours too. Ten bicas within five minutes is an overdose: the guest walks
faster, the camera thumps like a heartbeat and João tells you to sit down, for about 75 seconds
or until a nap. Beers from the fridge make you tipsy at three (the view sways and the edges
breathe) and dizzy at five (a wider sway, steps with the keys that wander, darker edges and a view
that keeps slipping out of focus). The seventh fades to black and you wake on the living-room
sofa in the morning, where João can tell you what happened and how many you had (and how fast)
before you take the glass of water he left you. You wake hungover (slower feet, heavy edges, a
blurry head) for five minutes; a paracetamol from the bathroom cabinet clears it in thirty
seconds, if you've got the door open. The third beer, nodding off and waking up each
cut to a comic-book strip of close-ups drawn from the character sprites
(`src/components/house/comic-strip.tsx`), which a click or key skips. A nap sleeps off the beers
as well as the bicas and the hangover. Those counts live in memory for the session only
(`src/components/house/intoxication.ts`), apart from the guestbook's lifetime stats. Under
`prefers-reduced-motion` the temporary effects (`effect` on the bridge) drop shake, jitter, sway
and drift, hold the vignette and blur still, and the comic panels appear all at once.

The visitor's local date also puts up seasonal decorations (`src/game/seasons.ts`): a tree and a
bolo-rei in December until Dia de Reis, sardines, manjericos and paper garlands through June for the
Santos Populares, a pumpkin by the front door and Zeno in a witch's hat for Halloween week, and
balloons on New Year's Eve and Day (and on João's birthday, once `BIRTHDAY` is set). João greets
visitors with a seasonal line, and at night the tree's lights and the pumpkin's candle light the
dark around them like the lamps. Add `?season=xmas` (or `santos`, `halloween`, `newyear`,
`birthday`) to the URL to preview one whatever the date, or `?season=none` to turn them off.

Where things live:

- `src/game/layout.ts` - the floor plan and rooms; `src/game/furnishings.ts` - what stands where;
    `src/game/pixels.ts` - the pixel art drawn in code; `src/game/missions.ts` - missions and what
    they unlock; `src/game/seasons.ts` - which decorations are up;
    `src/game/house-scene.ts` - the Phaser scene; `src/game/lighting.ts` - daylight and the night's
    lamps; `src/game/exterior.ts` - the street, roof and gulls outside the balcony;
    `src/game/weather-layer.ts` - rain, cloud and lightning over it; `src/game/bridge.ts` - events
    between Phaser and React.
- `src/components/house/` - the shell, panels (directory, wardrobe, guestbook, record player, travel
    map, ...), dialogue, the sticker toast and the sound (`audio.ts`, `sfx.ts`, `record-player.ts`);
    `leaderboard.tsx` holds the games' Top 10 tabs and submit form, and `scores-panel.tsx` the
    trophy poster's tabbed boards.
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
and commit the PNG whenever the house art changes. It always snapshots the everyday house
(`?season=none`), so seasonal decorations never need a new one.

## 🏆 Scoreboards API

`src/app/api/scores/route.ts`, with the logic in `src/lib/scores/`. Boards are listed in
`src/lib/scores/boards.ts` (`geoguess`, `bica` and `hall-of-fame`); adding one is a single entry
there, with its score bounds and whether it ranks by score or lists newest first.

- `GET /api/scores?board=geoguess&limit=10` - the top entries (default 10, at most 50), cached at
    the edge for 30 seconds.
- `POST /api/scores` with `{ board, player, name, score, meta? }` - saves an entry. `player` is a
    random id the browser keeps, so each browser has one entry per board: its best score, or on a
    board listed by date its latest. Answers with the entry, its rank and the fresh top 10.
- `POST /api/scores/moderate` with `Authorization: Bearer $SCORES_ADMIN_SECRET` and
    `{ board, id, hidden }` - hides an entry (or shows it again). Hidden entries stay hidden if
    their browser submits again. Entries can also be edited in the Upstash console.

In the house, nothing is posted until the visitor presses *Submit to the leaderboard*; boards are
only read, when a game's Top 10 tab or the trophy poster is opened. A board that
can't be reached shows as offline, and the games play on regardless.

Everything is checked on the server: scores must be whole numbers within the board's bounds, names
2-16 characters of Latin letters, digits and single `space . _ ' -` separators, and past a small
English/Portuguese profanity filter; `meta` may only hold a few numbers and flags. Each IP (stored
hashed) gets 5 submissions a minute. Failures answer with an `error` message to show as is; a
missing or unreachable store answers `503 { offline: true }`. Scores are worked out in the
browser, so they can still be forged: the checks only stop casual abuse.

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
4. For the scoreboards, add **Upstash for Redis** from the Vercel Marketplace (Storage → Create
    Database) and connect it to the project, which sets its REST URL and token; then add
    `SCORES_ADMIN_SECRET` for moderation
5. Deploy

## 🛠️ Tech Stack

- **[Next.js](https://nextjs.org/)** 16 / **[React](https://react.dev/)** 19 - App Router framework
- **[Phaser](https://phaser.io/)** 4 - the house's game engine
- **[Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)** - the record
    player's lo-fi loop and the house's sound effects, synthesised in the browser
- **[Tailwind CSS](https://tailwindcss.com/)** 4 - styling
- **[Bun](https://bun.sh/)** - JavaScript package manager and script runner
- **[Keystatic](https://keystatic.com/)** - Git-backed CMS for content
- **[LimeZu Modern Interiors](https://limezu.itch.io/moderninteriors)** - character, plant, rug,
    bed and trophy-poster art for the house (most furniture is hand-drawn in code)
- **[Natural Earth](https://www.naturalearthdata.com/)** - land outlines for the world map
- **[Open-Meteo](https://open-meteo.com/)** - Lisbon's current weather for the house (no API key)
- **[SQLite](https://www.sqlite.org/)** - Embedded database with FTS5 full-text search
- **[Upstash Redis](https://upstash.com/)** - the public scoreboards (`@upstash/redis`), with
    `@upstash/ratelimit` for per-IP limits
- **[Unsplash API](https://unsplash.com/developers)** - Photo source with CDN
- **[Plex](https://www.plex.tv/) / [TMDB](https://www.themoviedb.org/)** - Watch history source and
    poster fallback
- **[Playwright](https://playwright.dev/)** - End-to-end tests
- **[Bun test](https://bun.sh/docs/cli/test)** - unit tests for the scoreboards
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
│       ├── dev.yaml         # Linting, testing (pytest, Bun unit tests)
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
│   │   ├── api/             # photos, watch-poster, scores, weather, keystatic
│   │   └── keystatic/       # CMS admin UI
│   ├── assets/           # Imported assets (share image)
│   ├── components/       # React components (house/, photography/, writing/, hobby-feed/, ui/)
│   ├── game/             # Phaser scene, floor plan, furniture, characters, missions, seasons
│   ├── lib/              # Data access, utilities
│   │   └── scores/           # Scoreboards: boards, validation, store, API handlers, client
│   └── proxy.ts          # Hides the CMS in production unless it's configured
├── public/              # Static assets served by Next.js
│   └── house/               # House atlases and world-map outlines
├── tests/               # Test suites
│   ├── unit_tests/       # Pytest (ETL, database)
│   ├── unit_ts/          # Bun unit tests (scoreboards, João's dialogue)
│   ├── local_tests/      # Manual checks against the live Unsplash API
│   └── e2e/               # Playwright (frontend)
├── keystatic.config.ts  # CMS collections
├── config.py            # ETL configuration
└── pyproject.toml       # Python project config
```

## 🧪 Testing

```bash
pytest -v            # ETL/backend tests
bun run test:unit    # Scoreboard unit tests (validation, store, API) on an in-memory store, João's dialogue, and Lisbon's sun and moon
npx playwright test  # Playwright end-to-end tests (frontend)
```

E2E specs import `test` from `tests/e2e/fixtures.ts`, which answers `/api/weather` with a clear sky
so no test reaches Open-Meteo; a test can `page.route` its own sky on top.

The e2e tests never need Upstash: the scores API spec only sends requests the server rejects
before reaching a store.

CI (`.github/workflows/dev.yaml`) runs the pre-commit hooks, `pytest`, the scoreboard unit tests
and `pip-audit`.

## 🔐 Security

- **Environment Variables:** API keys stored in `.env` (not committed)
- **Dependency Updates:** Dependabot for automated security updates
- **pip-audit:** Dependency vulnerability scan in CI
- **Scoreboards:** names and scores are validated server-side, submissions are rate-limited per
    (hashed) IP, and moderation needs `SCORES_ADMIN_SECRET`

## 📝 License

MIT License

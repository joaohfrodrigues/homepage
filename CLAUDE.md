# CLAUDE.md

## Sound in the house

New house features are expected to come with sound wherever the action would intuitively make one
(a door, a pour, a bottle opening, an animal, a reward). Add each sound as a small function in
[src/components/house/sfx.ts](./src/components/house/sfx.ts) and call it where the action happens.
Synthesise it with the Web Audio API by default; use a recording only where a real sound is clearly
better (an animal, a specific object). Recordings go in `public/house/sounds/` as short mono-ish
MP3s (well under 100 KB), need a licence that allows use on a public site, are credited in
`public/house/sounds/CREDITS.txt`, get a gain in `RECORDINGS` in `sfx.ts`, and keep a synthesised
fallback in case the file fails to load. Sounds play
through the shared context in [audio.ts](./src/components/house/audio.ts), so they follow the house's
volume and mute and stay silent until the visitor's first click or key press. Keep frequent sounds
(footsteps, anything that repeats) quiet, and leave out sounds for actions that would be silent in
real life. If a feature has no sound, say why in the PR description.

## Pixel art in the house

Draw new or redrawn furniture as a grid sprite in
[src/game/sprites/props.ts](./src/game/sprites/props.ts), using only swatches from the palette in
[src/game/palette.ts](./src/game/palette.ts), lit from the top left. Look at it with
`bun run sprites:preview <prop>` (and LimeZu pieces alongside with `--limezu`) before and after
each change, and check it in the running house. Blender renders and PixelLab drafts are starting
points only: snap them with `bun run sprites:grid import` and clean them up by hand. The tools need
no paid software; don't add steps that need Aseprite. See "Drawing the house" in the README.

## Documentation pass before every Pull Request

Before creating any Pull Request, do a documentation pass and update every doc the branch's changes
affect. Commit the doc updates on the same branch so they land in the same PR.

Start with the root [README.md](./README.md), which is the main entry point and the doc most likely
to drift. Check that it still matches the code for:

- **Overview and Architecture** — what the site is and how its parts fit together (new pages,
    routes, features such as the house, new data sources).
- **Quick Start and setup steps** — commands, prerequisites and environment variables (keep
    [.env.example](./.env.example) in sync with any new or removed variable).
- **ETL pipelines and Automated Sync** — CLI flags, behaviour and the workflows in
    `.github/workflows/`.
- **Tech Stack** — libraries, services and asset packs added or removed.
- **Project Structure** — the directory tree must reflect real paths (new folders such as
    `scripts/`, moved or deleted files).
- **Testing** — how to run each test suite.
- **Documentation** — the index of other docs, including any new README.

Then check the other docs that cover the touched area:

- [backend/README.md](./backend/README.md) — database schema, ETL pipelines, `backend/` layout.
- [content/pages/README.md](./content/pages/README.md) — how static content pages are added.
- [data/README.md](./data/README.md) — files in `data/`.
- [tests/unit_tests/fixtures/README.md](./tests/unit_tests/fixtures/README.md) — test fixtures.
- This file, if the change alters how work in the repo should be done.

Remove or correct statements the change made wrong rather than only adding new text. If nothing
needs updating, say so in the PR description.

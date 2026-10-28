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
no paid software; don't add steps that need Aseprite. See [docs/drawing-the-house.md](./docs/drawing-the-house.md).

## Writing documentation

Docs are for people skimming, so keep them short and readable:

- **Summarise.** Say what a thing is, why it exists and how to use it. Leave out what the code
    already says plainly (every sticker, every sound, every prop); point to the file instead.
- **Keep a detail only if it changes what the reader does**: a non-obvious rule, a trap, a
    command, a required variable, a limit.
- **Say it once.** Each fact has one home; other docs link to it rather than repeat it.
- **One topic per doc.** The root README is a short overview and index. Feature guides live in
    `docs/`, and a folder's own README covers only that folder.
- **Prefer lists, tables and code blocks** to long paragraphs, and plain words to jargon.

## Documentation pass before every Pull Request

Before creating any Pull Request, update every doc the branch's changes affect, on the same branch.
Follow "Writing documentation" above: correct or delete statements the change made wrong rather
than adding to them, and put new detail in the doc that owns the topic.

| Doc | Covers |
| --- | --- |
| [README.md](./README.md) | Overview, quick start, testing, deploying, project structure, tech stack, docs index |
| [docs/house.md](./docs/house.md) | The house's rooms, systems, URL previews and asset scripts |
| [docs/drawing-the-house.md](./docs/drawing-the-house.md) | Grid sprites, the palette and art tools |
| [docs/scoreboards.md](./docs/scoreboards.md) | Scoreboard and João's-look APIs |
| [backend/README.md](./backend/README.md) | Pipelines, their CLI flags and workflows, the database |
| [content/pages/README.md](./content/pages/README.md) | Adding a static page |
| [tests/unit_tests/fixtures/README.md](./tests/unit_tests/fixtures/README.md) | Unsplash fixtures |
| [.env.example](./.env.example) | Every environment variable |
| This file | How work in the repo is done |

If nothing needs updating, say so in the PR description.

# The house

The home page is a small Lisbon flat drawn tile by tile in Phaser. Pages, panels and dialogue are
React, drawn over the scene. Every room's page also has a plain HTML version for screen readers,
crawlers and visitors without JavaScript.

## Playing

Arrow keys or WASD walk; `E`, `Space` or `Enter` interact; clicking the
floor walks there. `M` opens the directory (subjects, activities and a floor plan to jump
to) and `G` the guestbook. On touch screens, dragging brings up a joystick, and tapping a
thing walks to it; a second tap uses it.

Back always closes the top layer. Pages have real URLs, and panels, dialogue and the lightbox each
push a history entry while open (`useHistoryLayer` in `house-navigation.tsx`).

A first visit opens a welcome card asking who's visiting: a friend goes straight in, the curious
get shortcuts, and *Here to hire* offers the About page or the interview. It's skipped on deep links
and remembered once dismissed.

The interview is an optional one-minute tour for recruiters, also offered on the About page and by
João when asked about work. It moves the guest to four stops (the desk, the Pi, the bookshelves,
João), each with a card built from the Work content (`interview.ts`); a stop whose project isn't
in `content/work.yaml` drops out. It ends on LinkedIn and GitHub only, never the CV or email.

## Rooms

| Room | What's there |
| --- | --- |
| Entrance hall | Running and hiking kit, the guestbook, the contact note |
| Living room | TV (film and series), João, and a record player with a synthesised lo-fi loop |
| Kitchen | Bica machine, and the fridge: a photo-location guessing game, and beer |
| Corridor | Trophy poster: leaderboards and the Hall of Fame |
| Study | Workstation terminal (leads to About & work), wall map (photography), bookshelves (writing), camera, drums |
| Bedroom | Wardrobe (outfits), bed (nap), balcony |
| Bathroom | Locked until its mission is done; the cabinet holds paracetamol |

The study's workstation is a shell logged into the Raspberry Pi. It opens on a scripted session
(`terminal-session.ts`, built from the Work content) and then takes commands
(`terminal-commands.ts`): the site is the home directory, so `ls`, `cd`, `cat` and `open` browse
writing, photography, hobbies and work, and Pi commands such as `docker ps` link the home-server
article they come from. `help` doesn't list everything; finding three secret commands earns a
sticker.

João introduces himself on the first chat, then gives one tip per chat about something the visitor
hasn't found yet (`joaoTips` in `dialogues.ts`).

## Progress

- **Guestbook** — the visitor's tallies and a page of stickers, kept in `localStorage`
  (`visitor-stats.ts`). A new sticker needs only an entry in `ACHIEVEMENTS`; the toast comes for
  free. Collecting all of them lets the visitor sign the Hall of Fame.
- **Missions** — multi-step activities that unlock parts of the house, defined in `missions.ts`
  and saved with the guestbook. The first, *The stuck door*, opens the bathroom.
- **Hidden behaviours** — ten bicas in five minutes cause an overdose; beers make the visitor
  tipsy, then dizzy, then pass out and wake hungover. A nap resets it all. Session-only state lives
  in `intoxication.ts`. Under `prefers-reduced-motion` the effects drop all motion.

## Sound

All sound goes through one Web Audio context (`audio.ts`). Most effects are synthesised in
`sfx.ts`; a few are recordings in `public/house/sounds/` with a synthesised fallback. Nothing plays
until the visitor's first click or key press, and the HUD's speaker button mutes everything. The
record player's volume slider is the whole house's volume. Rules for adding sounds are in
[CLAUDE.md](../CLAUDE.md).

## Time, weather and seasons

The house follows Lisbon's clock and sun (`src/lib/sun.ts`, computed, no API): daylight through
the windows, blue dusk, and at night only the visible lamps and screens are lit (`lighting.ts`).
Lisbon's real weather (`/api/weather`) greys the glass and brings rain or lightning
(`weather-layer.ts`). Seasonal decorations (`seasons.ts`) appear for Christmas, Santos Populares,
Halloween, New Year and João's birthday.

Preview any of these with URL parameters:

- `?time=21:15` (Lisbon time)
- `?weather=clear|cloudy|rain|storm`
- `?season=xmas|santos|halloween|newyear|birthday|none`

## Software rendering

Without GPU acceleration (VMs, some Linux setups, acceleration turned off) WebGL runs on the CPU
through SwiftShader or llvmpipe, and each frame costs the CPU a lot. `software-render.ts` detects
this, and the scene then:

- lights lamps and screens with their tint images instead of the lit shader (most of the cost),
- caps itself at 30 fps, and at 5 fps while a page or panel covers the house,
- draws the drunk blur in one pass instead of four.

On a GPU nothing changes.

The e2e suite (`channel: 'chromium'`) renders on the GPU where there is one. To try the software
path, open the house in Playwright's default headless shell, which uses SwiftShader.

## Where things live

| Path | Contents |
| --- | --- |
| `src/game/layout.ts`, `furnishings.ts` | Floor plan, rooms, and what stands where |
| `src/game/pixels.ts`, `sprites/`, `palette.ts` | Everything drawn in code (see [drawing-the-house.md](./drawing-the-house.md)) |
| `src/game/house-scene.ts` | The Phaser scene |
| `src/game/lighting.ts`, `weather-layer.ts`, `exterior.ts` | Light, weather, the street and gulls outside |
| `src/game/missions.ts`, `seasons.ts` | Missions and decorations |
| `src/game/bridge.ts` | Events between Phaser and React |
| `src/components/house/` | Shell, panels, dialogue, toasts and sound |
| `public/house/` | LimeZu atlases (licence alongside), sounds, world-map outlines |

## Regenerating assets

Outputs are committed, so these only run when the art changes:

```bash
node scripts/import_limezu.mjs ~/path/to/moderninteriors   # repack LimeZu atlases
python scripts/build_house_map.py ne_50m_land.geojson public/house/world-land.json
bun run og                                                  # share image; needs `bun run dev`
```

The LimeZu licence forbids redistributing the pack, so only the packed atlases are committed.
Re-run `bun run og` and commit `src/assets/og-image.png` whenever the house art changes.

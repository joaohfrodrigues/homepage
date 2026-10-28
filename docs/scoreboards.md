# Scoreboards and João's look

Both are stored in Upstash Redis behind small store interfaces, so tests use an in-memory store
(`SCORES_STORE=memory`) and a site without Upstash simply shows boards as offline.

## Scoreboards

Routes in `src/app/api/scores/`, logic in `src/lib/scores/`. Boards (`geoguess`, `bica`,
`hall-of-fame`) are declared in `boards.ts`; adding one is a single entry with its score bounds and
ordering.

| Request | Does |
| --- | --- |
| `GET /api/scores?board=geoguess&limit=10` | Top entries (max 50), edge-cached 30 s |
| `POST /api/scores` `{ board, player, name, score, meta? }` | Saves the browser's best (or latest) entry; returns its rank and the top 10 |
| `POST /api/scores/moderate` `{ board, id, hidden }` | Hides or restores an entry; needs `Bearer $SCORES_ADMIN_SECRET` |

`player` is a random id kept by the browser, so each browser has one entry per board. Nothing is
sent until the visitor chooses to submit.

The server checks scores against the board's bounds, names (2–16 Latin letters, digits and simple
separators, plus a profanity filter) and `meta`, and rate-limits each hashed IP to 5 submissions a
minute. Scores are computed in the browser, so these checks stop casual abuse, not forgery.

## João's look

`/api/house/joao` (logic in `src/lib/joao-look.ts`) stores the outfit every visitor sees João in.

- `GET` returns `{ look }`, or `null` to fall back to `LOOKS.joao` in `characters.ts`.
- `PUT { look }` with `Bearer $HOUSE_OWNER_SECRET` saves it. Only wardrobe pieces are accepted, and
  without the secret the route is closed.

In the house, the owner enters the Konami code at the wardrobe, dresses João and enters the pass
under *Are you João?*. Visitors who use the code only change João in their own browser.

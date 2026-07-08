"""ETL script to sync watch history from a Plex server into content/watch-items/*.

Each watched film/show becomes its own Keystatic content file (like Gear and
Events), so entries can be manually edited or hidden through the CMS. Every
sync overwrites all fields except `hidden` and `watchedAt`, which default to
automatic behaviour but yield to a manual edit once one is made (see
`write_watch_item_files`).
"""

import argparse
import logging
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote

import yaml
from dotenv import load_dotenv
from plexapi.server import PlexServer

sys.path.insert(0, str(Path(__file__).parent.parent))

from backend.providers.tmdb import search_poster
from backend.slug import slugify

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
)
logger = logging.getLogger(__name__)

WATCH_ITEMS_DIR = Path(__file__).parent.parent / 'content' / 'watch-items'

TYPE_MAP = {
    'movie': 'film',
    'episode': 'series',
}

# A series only earns a Watching entry once at least this many of its
# episodes have been watched — a couple of stray episodes isn't "watching
# the show" and would otherwise clutter the grid with one-off entries.
MIN_EPISODES_FOR_SERIES = 3

# Only ratings at or above this bar (Plex's userRating is a 0-10 scale, so
# 8.0 = 80% = 4/5 stars) default to visible on the site. Unrated and
# lower-rated items default to hidden rather than discarded outright, so
# they can still be found/edited in Keystatic and are only actually
# deleted once stale — see `cleanup_stale_hidden_items`.
MIN_RATING_TO_SHOW = 8.0

# How long a hidden, low-rated entry is kept around before the cleanup
# step deletes its file outright. Only ever applies to entries that are
# still `hidden` at cleanup time — one manually un-hidden is never
# swept up, the same way it's protected from being auto-re-hidden.
CLEANUP_MAX_AGE_DAYS = 365

# A watch was "close to release" — and therefore treated as genuinely
# current viewing, not a rewatch/historical catch-up — if it happened
# within this many days of the episode/movie's original air date. Used
# to decide whether `watchedAt` is allowed to advance on resync; see
# `_watched_near_release`.
RECENT_AIR_WINDOW_DAYS = 45

# Plex sometimes bakes a disambiguating year into the title itself (e.g. a
# library with both the 1999 anime and the 2023 live-action "One Piece"),
# usually alongside a missing parentYear/year. A trailing "(YYYY)" in the
# query string makes TMDB's search return zero results, so it needs pulling
# back out into its own field before searching.
TRAILING_YEAR_PATTERN = re.compile(r'\s*\((\d{4})\)\s*$')


def _split_title_year(title: str) -> tuple[str, int | None]:
    match = TRAILING_YEAR_PATTERN.search(title)
    if not match:
        return title, None
    return TRAILING_YEAR_PATTERN.sub('', title), int(match.group(1))


def _poster_path(item) -> str | None:
    """Return the bare Plex thumbnail path, with no host or token attached.

    Prefers the season poster (`parentThumb`) over the episode's own
    thumbnail (`thumb`, usually a video-frame still rather than artwork),
    falling back to the show poster (`grandparentThumb`) if neither is set.
    Movies only ever have `thumb` (their own poster), so this is a no-op
    for them. Since `_aggregate_series` keeps the most recently watched
    episode's entry, this naturally becomes the poster of the season
    containing that latest episode.

    The frontend proxies this through /api/watch-poster, which attaches
    PLEX_URL/PLEX_TOKEN server-side at request time — the token must never
    end up written into a content/watch-items/*.yaml file, since those are
    committed to git.
    """
    return (
        getattr(item, 'parentThumb', None)
        or getattr(item, 'thumb', None)
        or getattr(item, 'grandparentThumb', None)
    )


def transform_history_item(item) -> dict | None:
    """Transform a Plex history entry into our canonical watch-history schema.

    Episodes are keyed by their parent show (`grandparentRatingKey`) if
    available, else the raw title, so every watched episode of a series
    collapses onto the same group in `_aggregate_series`. This grouping key
    is internal — `_assign_readable_slugs` computes the actual `id` (and
    therefore filename) from the title afterwards, once per show/film.
    """
    media_type = TYPE_MAP.get(item.type)
    if media_type is None:
        return None

    is_episode = item.type == 'episode'
    raw_title = item.grandparentTitle if is_episode else item.title
    native_id = getattr(item, 'grandparentRatingKey', None) if is_episode else item.ratingKey
    # Grouping key only — distinct from the final `id` used as filename.
    # Falls back to the raw (un-split) title so two differently-titled
    # shows that both lack a native key (e.g. "One Piece" vs "One Piece
    # (2023)") still group separately.
    group_key = str(native_id) if native_id else slugify(raw_title)
    title, inferred_year = _split_title_year(raw_title)
    year = getattr(item, 'year', None) or getattr(item, 'parentYear', None) or inferred_year
    watched_at = getattr(item, 'viewedAt', None)
    aired_at = getattr(item, 'originallyAvailableAt', None)
    poster_path = _poster_path(item)

    return {
        'id': group_key,
        'title': title,
        'type': media_type,
        'watchedAt': watched_at.isoformat() if watched_at else None,
        # Internal signal only, never written to the YAML file — see
        # `_watched_near_release`. Plex provides this on history items
        # directly, no extra lookup needed.
        'airedAt': aired_at.isoformat() if aired_at else None,
        'year': year,
        'season': getattr(item, 'parentIndex', None) if is_episode else None,
        'posterUrl': f'/api/watch-poster?path={quote(poster_path, safe="")}'
        if poster_path
        else None,
        # Resolved after aggregation, once per surviving entry — see
        # `_fetch_rating`. Plex's history endpoint never includes
        # `userRating` in its response, regardless of whether the title
        # has actually been rated.
        'rating': None,
        'note': None,
        '_plex_item': item,
    }


class _RatingFetchFailed:
    """Sentinel distinguishing a failed rating lookup from a confirmed
    'genuinely unrated' result (`None`) — see `_fetch_rating`."""


RATING_FETCH_FAILED = _RatingFetchFailed()


def _fetch_rating(item) -> float | None | _RatingFetchFailed:
    """Look up an entry's true rating from the real Plex library item.

    `plex.history()` entries never carry `userRating` — it's simply not
    part of that endpoint's response — so it has to be fetched from the
    actual show/movie instead. Episodes are rated at the show level, not
    per-episode, so an episode history entry resolves to its parent show.

    Returns `RATING_FETCH_FAILED` (not `None`) on lookup failure (e.g. the
    title was removed from the library since being watched), so a
    transient error can never be mistaken for a confirmed "no rating" —
    see `write_watch_item_files`, where that distinction is what stops a
    flaky lookup from silently re-hiding an already-visible entry.
    """
    try:
        source = item.show() if item.type == 'episode' else item.source()
    except Exception:
        logger.warning('Could not resolve rating for %r', getattr(item, 'title', None))
        return RATING_FETCH_FAILED
    return getattr(source, 'userRating', None)


def _aggregate_series(entries: list[dict]) -> list[dict]:
    """Collapse per-episode entries into one entry per series.

    A series is only kept once at least `MIN_EPISODES_FOR_SERIES` distinct
    episodes have been watched. The kept entry uses the most recently
    watched episode's date/poster/rating as the series' own.
    """
    films = [e for e in entries if e['type'] == 'film']

    episodes_by_series: dict[str, list[dict]] = {}
    for entry in entries:
        if entry['type'] == 'series':
            episodes_by_series.setdefault(entry['id'], []).append(entry)

    series = [
        max(episodes, key=lambda e: e['watchedAt'])
        for episodes in episodes_by_series.values()
        if len(episodes) >= MIN_EPISODES_FOR_SERIES
    ]

    return films + series


def _assign_readable_slugs(entries: list[dict]) -> None:
    """Replace each entry's grouping-key id with a readable slug of its title.

    Mutates `entries` in place. Processes in a fixed (title-sorted) order so
    dedup suffixes are stable from run to run rather than depending on
    whatever order Plex happened to return history in.
    """
    seen: dict[str, int] = {}
    for entry in sorted(entries, key=lambda e: e['title']):
        base = slugify(entry['title'])
        seen[base] = seen.get(base, 0) + 1
        count = seen[base]
        entry['id'] = base if count == 1 else f'{base}-{count}'


def fetch_watch_history(
    plex_url: str,
    plex_token: str,
    tmdb_api_key: str | None = None,
    since: datetime | None = None,
) -> list[dict]:
    """Connect to Plex and return the transformed watch history.

    `since` limits history to items watched on or after that date — useful
    for a one-off historical backfill (Plex defaults to returning its
    entire retained history otherwise). When a TMDB API key is configured,
    every entry's poster is preferred from TMDB (a public CDN URL, so the
    frontend can render it directly with no Plex token/proxy involved);
    the Plex thumbnail proxy path is only kept as a fallback when TMDB has
    no match for the title.
    """
    plex = PlexServer(plex_url, plex_token)
    history = plex.history(mindate=since) if since else plex.history()

    raw_entries = []
    for item in history:
        entry = transform_history_item(item)
        if entry is not None and entry['watchedAt'] is not None:
            raw_entries.append(entry)

    entries = _aggregate_series(raw_entries)
    _assign_readable_slugs(entries)

    for entry in entries:
        entry['rating'] = _fetch_rating(entry.pop('_plex_item'))
        if tmdb_api_key:
            tmdb_poster = search_poster(
                entry['title'], entry['type'], entry['year'], tmdb_api_key, season=entry['season']
            )
            if tmdb_poster is not None:
                entry['posterUrl'] = tmdb_poster

    entries.sort(key=lambda e: e['watchedAt'], reverse=True)
    return entries


def _compute_hidden(rating: float | None) -> bool:
    """Whether an entry should default to hidden, based on its rating.

    Unrated items and anything below MIN_RATING_TO_SHOW default to
    hidden — only ratings you've actively given at or above the bar
    surface on the site by default.
    """
    return rating is None or rating < MIN_RATING_TO_SHOW


def _read_existing(path: Path) -> dict:
    """Read back a previously-synced entry's file, if any.

    Returns `{}` for a missing, unparseable, or unexpectedly-shaped file
    (e.g. hand-edited into a YAML list) — every caller treats that the
    same as "nothing on disk yet" rather than crashing on a malformed one
    file out of the whole directory.
    """
    if not path.exists():
        return {}
    try:
        data = yaml.safe_load(path.read_text())
    except yaml.YAMLError:
        return {}
    return data if isinstance(data, dict) else {}


def _watched_near_release(aired_at: str | None, watched_at: str | None) -> bool:
    """Whether `watched_at` falls within RECENT_AIR_WINDOW_DAYS of `aired_at`.

    Distinguishes "watching current, still-airing content" — where the
    stored `watchedAt` should keep advancing to the latest episode as you
    watch it — from a rewatch or historical catch-up of something
    released long ago, where it shouldn't jump to today (see
    `write_watch_item_files`). Missing/unparseable dates are treated
    conservatively as *not* recent, since freezing is the safer default.
    """
    if not aired_at or not watched_at:
        return False
    try:
        aired = datetime.fromisoformat(aired_at).replace(tzinfo=None)
        watched = datetime.fromisoformat(watched_at).replace(tzinfo=None)
    except ValueError:
        return False
    return abs((watched - aired).days) <= RECENT_AIR_WINDOW_DAYS


def write_watch_item_files(entries: list[dict]) -> None:
    """Write one Keystatic content file per entry to content/watch-items/.

    Existing files for ids no longer present in `entries` (e.g. a series
    that dropped back below MIN_EPISODES_FOR_SERIES) are left untouched
    rather than deleted, so manual edits/hides are never lost.

    Two fields are only ever set automatically; a manual edit through
    Keystatic otherwise sticks:
    - `hidden` is recomputed from `rating` only when `rating` has
      genuinely changed since the last sync; otherwise the existing value
      (which may be a manual override) is preserved. A *failed* rating
      lookup (`RATING_FETCH_FAILED`) never counts as a change — it falls
      back to whatever was last known, so a transient Plex error can't
      masquerade as a real rating change and silently re-hide something.
    - `watchedAt` only advances when the new watch happened close to the
      title's release (`_watched_near_release`) — i.e. genuinely current
      viewing of an ongoing series. Otherwise (a rewatch, or rating an
      old favourite long after the fact) it's left exactly as last
      written, so it doesn't jump to today and so a manual correction
      made through Keystatic survives future syncs.
    """
    WATCH_ITEMS_DIR.mkdir(parents=True, exist_ok=True)
    for entry in entries:
        path = WATCH_ITEMS_DIR / f'{entry["id"]}.yaml'
        existing = _read_existing(path)
        existing_rating = existing.get('rating')
        existing_hidden = bool(existing.get('hidden', False))
        existing_watched_at = existing.get('watchedAt')

        if entry['rating'] is RATING_FETCH_FAILED:
            rating = existing_rating if path.exists() else None
            hidden = existing_hidden if path.exists() else _compute_hidden(None)
        elif path.exists() and existing_rating == entry['rating']:
            rating = entry['rating']
            hidden = existing_hidden
        else:
            rating = entry['rating']
            hidden = _compute_hidden(rating)

        if existing_watched_at and not _watched_near_release(
            entry.get('airedAt'), entry['watchedAt']
        ):
            watched_at = existing_watched_at
        else:
            watched_at = entry['watchedAt']

        content = {
            'title': entry['title'],
            'type': entry['type'],
            'watchedAt': watched_at,
            'year': entry['year'],
            'posterUrl': entry['posterUrl'],
            'rating': rating,
            'note': entry['note'],
            'hidden': hidden,
        }
        path.write_text(yaml.safe_dump(content, sort_keys=False, allow_unicode=True))


def cleanup_stale_hidden_items(
    directory: Path | None = None,
    max_age_days: int = CLEANUP_MAX_AGE_DAYS,
    now: datetime | None = None,
) -> list[Path]:
    """Delete hidden watch items whose `watchedAt` is older than `max_age_days`.

    Only ever deletes entries that are still `hidden` at cleanup time — an
    item manually un-hidden despite a low rating is protected from
    deletion, the same way it's protected from being auto-re-hidden by a
    routine resync (see `write_watch_item_files`).
    """
    directory = directory or WATCH_ITEMS_DIR
    now = now or datetime.now(timezone.utc)
    deleted = []
    for path in sorted(directory.glob('*.yaml')):
        data = _read_existing(path)
        if not data.get('hidden', False):
            continue

        watched_at = data.get('watchedAt')
        if not watched_at:
            continue
        try:
            watched_dt = datetime.fromisoformat(watched_at)
        except ValueError:
            continue
        if watched_dt.tzinfo is None:
            watched_dt = watched_dt.replace(tzinfo=timezone.utc)

        if (now - watched_dt).days > max_age_days:
            try:
                path.unlink()
            except OSError:
                # A stray permissions/filesystem error here must not
                # abort the whole sync — write_watch_item_files already
                # succeeded, and losing that on a cleanup-only failure
                # would be worse than just retrying cleanup tomorrow.
                logger.warning('Could not delete stale watch item %s', path)
                continue
            deleted.append(path)
    return deleted


def sync_data(
    plex_url: str,
    plex_token: str,
    tmdb_api_key: str | None = None,
    since: datetime | None = None,
) -> list[dict]:
    entries = fetch_watch_history(plex_url, plex_token, tmdb_api_key, since)
    write_watch_item_files(entries)
    logger.info('Wrote %d watch item files to %s', len(entries), WATCH_ITEMS_DIR)

    deleted = cleanup_stale_hidden_items()
    if deleted:
        logger.info(
            'Deleted %d stale hidden watch item(s) older than %d days',
            len(deleted),
            CLEANUP_MAX_AGE_DAYS,
        )
    return entries


def main() -> int:
    load_dotenv()

    parser = argparse.ArgumentParser(description='Sync Plex watch history to content/watch-items/*')
    parser.add_argument(
        '--since',
        metavar='YYYY-MM-DD',
        help='Only include history watched on or after this date. '
        'For a historical backfill, e.g. --since 2026-01-01.',
    )
    args = parser.parse_args()

    plex_url = os.environ.get('PLEX_URL')
    plex_token = os.environ.get('PLEX_TOKEN')
    tmdb_api_key = os.environ.get('TMDB_API_KEY')

    if not plex_url or not plex_token:
        logger.error('Missing required environment variables: PLEX_URL, PLEX_TOKEN')
        return 1

    since = None
    if args.since:
        try:
            since = datetime.strptime(args.since, '%Y-%m-%d')
        except ValueError:
            logger.error('Invalid --since date "%s", expected YYYY-MM-DD', args.since)
            return 1

    try:
        sync_data(plex_url, plex_token, tmdb_api_key, since)
    except Exception:
        logger.exception('Plex sync failed')
        return 1

    return 0


if __name__ == '__main__':
    sys.exit(main())

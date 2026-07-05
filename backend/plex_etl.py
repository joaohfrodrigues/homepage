"""ETL script to sync watch history from a Plex server into content/watch-items/*.

Each watched film/show becomes its own Keystatic content file (like Gear and
Events), so entries can be manually edited or hidden through the CMS. Every
sync overwrites all fields except `hidden`, which is only ever set by hand.
"""

import argparse
import logging
import os
import re
import sys
from datetime import datetime
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

    Episodes are keyed by their parent show (`grandparentRatingKey`), not
    their own `ratingKey`, so every watched episode of a series collapses
    onto the same id in `_aggregate_series`. Plex sometimes drops the
    rating key entirely for history entries whose underlying media has
    since been removed from the library — fall back to a title slug so
    those items still get a stable, non-colliding id.
    """
    media_type = TYPE_MAP.get(item.type)
    if media_type is None:
        return None

    is_episode = item.type == 'episode'
    raw_title = item.grandparentTitle if is_episode else item.title
    native_id = getattr(item, 'grandparentRatingKey', None) if is_episode else item.ratingKey
    # Fall back id is derived from the raw (un-split) title so two
    # differently-titled shows that both lack a native key (e.g. "One Piece"
    # vs "One Piece (2023)") still get distinct ids.
    entry_id = str(native_id) if native_id else slugify(raw_title)
    title, inferred_year = _split_title_year(raw_title)
    year = getattr(item, 'year', None) or getattr(item, 'parentYear', None) or inferred_year
    watched_at = getattr(item, 'viewedAt', None)
    poster_path = _poster_path(item)

    return {
        'id': entry_id,
        'title': title,
        'type': media_type,
        'watchedAt': watched_at.isoformat() if watched_at else None,
        'year': year,
        'posterUrl': f'/api/watch-poster?path={quote(poster_path, safe="")}'
        if poster_path
        else None,
        'rating': getattr(item, 'userRating', None),
        'note': None,
    }


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


def fetch_watch_history(
    plex_url: str,
    plex_token: str,
    tmdb_api_key: str | None = None,
    since: datetime | None = None,
) -> list[dict]:
    """Connect to Plex and return the transformed watch history.

    `since` limits history to items watched on or after that date — useful
    for a one-off historical backfill (Plex defaults to returning its
    entire retained history otherwise). When a Plex item has no poster of
    its own and a TMDB API key is configured, fall back to searching TMDB
    by title/type/year.
    """
    plex = PlexServer(plex_url, plex_token)
    history = plex.history(mindate=since) if since else plex.history()

    raw_entries = []
    for item in history:
        entry = transform_history_item(item)
        if entry is not None and entry['watchedAt'] is not None:
            raw_entries.append(entry)

    entries = _aggregate_series(raw_entries)

    for entry in entries:
        if entry['posterUrl'] is None and tmdb_api_key:
            entry['posterUrl'] = search_poster(
                entry['title'], entry['type'], entry['year'], tmdb_api_key
            )

    entries.sort(key=lambda e: e['watchedAt'], reverse=True)
    return entries


def _existing_hidden(path: Path) -> bool:
    """Read back a previously-synced entry's `hidden` flag, if any.

    Every other field is overwritten wholesale on each sync, but `hidden`
    is a manual curation flag set through Keystatic — the ETL must never
    silently un-hide something someone hid.
    """
    if not path.exists():
        return False
    try:
        data = yaml.safe_load(path.read_text()) or {}
    except yaml.YAMLError:
        return False
    return bool(data.get('hidden', False))


def write_watch_item_files(entries: list[dict]) -> None:
    """Write one Keystatic content file per entry to content/watch-items/.

    Existing files for ids no longer present in `entries` (e.g. a series
    that dropped back below MIN_EPISODES_FOR_SERIES) are left untouched
    rather than deleted, so manual edits/hides are never lost.
    """
    WATCH_ITEMS_DIR.mkdir(parents=True, exist_ok=True)
    for entry in entries:
        path = WATCH_ITEMS_DIR / f'{entry["id"]}.yaml'
        content = {
            'title': entry['title'],
            'type': entry['type'],
            'watchedAt': entry['watchedAt'],
            'year': entry['year'],
            'posterUrl': entry['posterUrl'],
            'rating': entry['rating'],
            'note': entry['note'],
            'hidden': _existing_hidden(path),
        }
        path.write_text(yaml.safe_dump(content, sort_keys=False, allow_unicode=True))


def sync_data(
    plex_url: str,
    plex_token: str,
    tmdb_api_key: str | None = None,
    since: datetime | None = None,
) -> list[dict]:
    entries = fetch_watch_history(plex_url, plex_token, tmdb_api_key, since)
    write_watch_item_files(entries)
    logger.info('Wrote %d watch item files to %s', len(entries), WATCH_ITEMS_DIR)
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

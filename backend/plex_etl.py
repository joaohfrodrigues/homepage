"""ETL script to sync watch history from a Plex server to data/watch-history.json"""

import argparse
import json
import logging
import os
import re
import sys
from datetime import datetime
from pathlib import Path
from urllib.parse import quote

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

WATCH_HISTORY_PATH = Path(__file__).parent.parent / 'data' / 'watch-history.json'

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

    The frontend proxies this through /api/watch-poster, which attaches
    PLEX_URL/PLEX_TOKEN server-side at request time — the token must never
    end up written into data/watch-history.json, since that file is
    committed to git.
    """
    return getattr(item, 'thumb', None) or getattr(item, 'parentThumb', None)


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


def sync_data(
    plex_url: str,
    plex_token: str,
    tmdb_api_key: str | None = None,
    since: datetime | None = None,
) -> list[dict]:
    entries = fetch_watch_history(plex_url, plex_token, tmdb_api_key, since)
    WATCH_HISTORY_PATH.parent.mkdir(parents=True, exist_ok=True)
    WATCH_HISTORY_PATH.write_text(json.dumps(entries, indent=2) + '\n')
    logger.info('Wrote %d watch history entries to %s', len(entries), WATCH_HISTORY_PATH)
    return entries


def main() -> int:
    load_dotenv()

    parser = argparse.ArgumentParser(
        description='Sync Plex watch history to data/watch-history.json'
    )
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

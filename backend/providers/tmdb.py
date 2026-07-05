"""TMDB provider — poster lookup fallback for Plex items missing a thumbnail."""

import logging

import requests

logger = logging.getLogger(__name__)

TMDB_API_BASE = 'https://api.themoviedb.org/3'
TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500'

SEARCH_ENDPOINT = {
    'film': 'movie',
    'series': 'tv',
}
YEAR_PARAM = {
    'film': 'year',
    'series': 'first_air_date_year',
}


def _season_poster_path(show_id: int, season: int, api_key: str) -> str | None:
    """Look up the poster for a specific season of a TV show.

    A show's own poster_path (from /search/tv) is its general key art, which
    for an older show is usually the earliest/most iconic season rather than
    the one actually watched. Season-specific art better matches what the
    viewer saw, so it's preferred whenever a season number is known.
    """
    try:
        response = requests.get(
            f'{TMDB_API_BASE}/tv/{show_id}/season/{season}',
            params={'api_key': api_key},
            timeout=10,
        )
        response.raise_for_status()
    except requests.RequestException:
        logger.exception('TMDB season lookup failed for show %s season %s', show_id, season)
        return None

    return response.json().get('poster_path')


def search_poster(
    title: str,
    media_type: str,
    year: int | None,
    api_key: str,
    season: int | None = None,
) -> str | None:
    """Search TMDB for a poster matching the given title/type/year.

    For a series, pass `season` (the season of the most recently watched
    episode) to prefer that season's own poster over the show's general
    poster; falls back to the show poster if the season has none.

    Returns a full poster image URL, or None if nothing matched.
    """
    endpoint = SEARCH_ENDPOINT.get(media_type)
    if endpoint is None:
        return None

    params = {'api_key': api_key, 'query': title}
    if year:
        params[YEAR_PARAM[media_type]] = year

    try:
        response = requests.get(f'{TMDB_API_BASE}/search/{endpoint}', params=params, timeout=10)
        response.raise_for_status()
    except requests.RequestException:
        logger.exception('TMDB search failed for "%s"', title)
        return None

    results = response.json().get('results') or []
    if not results:
        return None

    show_poster_path = results[0].get('poster_path')

    poster_path = show_poster_path
    if media_type == 'series' and season is not None:
        show_id = results[0].get('id')
        season_poster_path = _season_poster_path(show_id, season, api_key)
        poster_path = season_poster_path or show_poster_path

    if not poster_path:
        return None

    return f'{TMDB_IMAGE_BASE}{poster_path}'

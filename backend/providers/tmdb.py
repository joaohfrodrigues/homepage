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


def search_poster(title: str, media_type: str, year: int | None, api_key: str) -> str | None:
    """Search TMDB for a poster matching the given title/type/year.

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

    poster_path = results[0].get('poster_path')
    if not poster_path:
        return None

    return f'{TMDB_IMAGE_BASE}{poster_path}'

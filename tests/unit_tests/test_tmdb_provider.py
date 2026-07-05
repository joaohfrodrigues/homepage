"""Tests for the TMDB poster-lookup fallback provider"""

import sys
from pathlib import Path
from unittest.mock import patch

import requests

sys.path.insert(0, str(Path(__file__).parent.parent))

from backend.providers.tmdb import search_poster


def _mock_response(json_data, status_ok=True):
    class _Response:
        def raise_for_status(self):
            if not status_ok:
                raise Exception('bad status')

        def json(self):
            return json_data

    return _Response()


def test_search_poster_returns_full_url():
    with patch('backend.providers.tmdb.requests.get') as mock_get:
        mock_get.return_value = _mock_response({'results': [{'poster_path': '/abc.jpg'}]})
        result = search_poster('Dune: Part Two', 'film', 2024, 'key')

    assert result == 'https://image.tmdb.org/t/p/w500/abc.jpg'
    called_url = mock_get.call_args[0][0]
    assert called_url.endswith('/search/movie')


def test_search_poster_uses_tv_endpoint_for_series():
    with patch('backend.providers.tmdb.requests.get') as mock_get:
        mock_get.return_value = _mock_response({'results': [{'poster_path': '/xyz.jpg'}]})
        search_poster('Severance', 'series', 2022, 'key')

    called_url = mock_get.call_args[0][0]
    assert called_url.endswith('/search/tv')


def test_search_poster_returns_none_when_no_results():
    with patch('backend.providers.tmdb.requests.get') as mock_get:
        mock_get.return_value = _mock_response({'results': []})
        result = search_poster('Unknown Title', 'film', None, 'key')

    assert result is None


def test_search_poster_returns_none_on_request_error():
    with patch('backend.providers.tmdb.requests.get', side_effect=requests.RequestException):
        result = search_poster('Dune: Part Two', 'film', 2024, 'key')

    assert result is None

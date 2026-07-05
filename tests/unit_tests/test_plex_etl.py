"""Tests for the Plex watch-history ETL transform logic"""

import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from backend.plex_etl import _aggregate_series, transform_history_item


@dataclass
class FakeHistoryItem:
    ratingKey: int | None
    type: str
    title: str
    thumb: str | None = None
    parentThumb: str | None = None
    grandparentTitle: str | None = None
    grandparentRatingKey: int | None = None
    year: int | None = None
    parentYear: int | None = None
    viewedAt: datetime | None = None
    userRating: float | None = None


def test_transform_movie():
    item = FakeHistoryItem(
        ratingKey=101,
        type='movie',
        title='Dune: Part Two',
        thumb='/library/metadata/101/thumb',
        year=2024,
        viewedAt=datetime(2026, 6, 28, 20, 0, tzinfo=timezone.utc),
        userRating=8.0,
    )

    result = transform_history_item(item)

    assert result == {
        'id': '101',
        'title': 'Dune: Part Two',
        'type': 'film',
        'watchedAt': '2026-06-28T20:00:00+00:00',
        'year': 2024,
        'posterUrl': '/api/watch-poster?path=%2Flibrary%2Fmetadata%2F101%2Fthumb',
        'rating': 8.0,
        'note': None,
    }


def test_transform_does_not_leak_plex_token_into_poster_url():
    """data/watch-history.json is committed to git — the poster URL must
    never contain a Plex token, only a token-free path the frontend proxy
    can attach credentials to server-side."""
    item = FakeHistoryItem(
        ratingKey=101,
        type='movie',
        title='Dune: Part Two',
        thumb='/library/metadata/101/thumb',
    )

    result = transform_history_item(item)

    assert 'X-Plex-Token' not in result['posterUrl']
    assert result['posterUrl'].startswith('/api/watch-poster?path=')


def test_transform_episode_uses_show_title_and_id():
    item = FakeHistoryItem(
        ratingKey=202,
        type='episode',
        title='Nights',
        grandparentTitle='The Bear',
        grandparentRatingKey=200,
        parentThumb='/library/metadata/200/thumb',
        parentYear=2022,
        viewedAt=datetime(2026, 7, 3, 21, 15, tzinfo=timezone.utc),
    )

    result = transform_history_item(item)

    assert result['id'] == '200'
    assert result['title'] == 'The Bear'
    assert result['type'] == 'series'
    assert result['year'] == 2022


def test_transform_unsupported_type_returns_none():
    item = FakeHistoryItem(ratingKey=303, type='track', title='Some Song')

    assert transform_history_item(item) is None


def test_transform_falls_back_to_slug_when_movie_rating_key_missing():
    """Plex can drop ratingKey for history entries whose media was later
    deleted from the library — str(None) would otherwise produce the
    literal id "None" and collide across unrelated items."""
    item = FakeHistoryItem(ratingKey=None, type='movie', title='Exit 8')

    result = transform_history_item(item)

    assert result['id'] == 'exit-8'


def test_transform_falls_back_to_slug_when_episode_grandparent_key_missing():
    item = FakeHistoryItem(
        ratingKey=505,
        type='episode',
        title='Episode 1',
        grandparentTitle='House of the Dragon',
        grandparentRatingKey=None,
    )

    result = transform_history_item(item)

    assert result['id'] == 'house-of-the-dragon'


def _series_entry(entry_id, watched_at):
    return {
        'id': entry_id,
        'title': 'The Bear',
        'type': 'series',
        'watchedAt': watched_at,
        'year': 2022,
        'posterUrl': None,
        'rating': None,
        'note': None,
    }


def _film_entry(entry_id):
    return {
        'id': entry_id,
        'title': 'Dune: Part Two',
        'type': 'film',
        'watchedAt': '2026-06-28T20:00:00+00:00',
        'year': 2024,
        'posterUrl': None,
        'rating': None,
        'note': None,
    }


def test_aggregate_series_drops_shows_with_fewer_than_three_episodes():
    entries = [
        _series_entry('200', '2026-07-01T00:00:00+00:00'),
        _series_entry('200', '2026-07-02T00:00:00+00:00'),
    ]

    assert _aggregate_series(entries) == []


def test_aggregate_series_keeps_shows_with_three_or_more_episodes():
    entries = [
        _series_entry('200', '2026-07-01T00:00:00+00:00'),
        _series_entry('200', '2026-07-03T00:00:00+00:00'),
        _series_entry('200', '2026-07-02T00:00:00+00:00'),
    ]

    result = _aggregate_series(entries)

    assert len(result) == 1
    assert result[0]['watchedAt'] == '2026-07-03T00:00:00+00:00'


def test_aggregate_series_keeps_all_films_regardless_of_count():
    entries = [_film_entry('101')]

    assert _aggregate_series(entries) == entries

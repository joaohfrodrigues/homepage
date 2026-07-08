"""Tests for the Plex watch-history ETL transform logic"""

import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace

import yaml

sys.path.insert(0, str(Path(__file__).parent.parent))

from backend import plex_etl
from backend.plex_etl import (
    RATING_FETCH_FAILED,
    _aggregate_series,
    _assign_readable_slugs,
    _compute_hidden,
    _fetch_rating,
    cleanup_stale_hidden_items,
    transform_history_item,
    write_watch_item_files,
)


@dataclass
class FakeHistoryItem:
    ratingKey: int | None
    type: str
    title: str
    thumb: str | None = None
    parentThumb: str | None = None
    grandparentThumb: str | None = None
    grandparentTitle: str | None = None
    grandparentRatingKey: int | None = None
    year: int | None = None
    parentYear: int | None = None
    viewedAt: datetime | None = None
    show_rating: float | None = None
    source_rating: float | None = None

    def show(self):
        return SimpleNamespace(userRating=self.show_rating)

    def source(self):
        return SimpleNamespace(userRating=self.source_rating)


def test_transform_movie():
    item = FakeHistoryItem(
        ratingKey=101,
        type='movie',
        title='Dune: Part Two',
        thumb='/library/metadata/101/thumb',
        year=2024,
        viewedAt=datetime(2026, 6, 28, 20, 0, tzinfo=timezone.utc),
    )

    result = transform_history_item(item)

    assert result == {
        'id': '101',
        'title': 'Dune: Part Two',
        'type': 'film',
        'watchedAt': '2026-06-28T20:00:00+00:00',
        'year': 2024,
        'season': None,
        'posterUrl': '/api/watch-poster?path=%2Flibrary%2Fmetadata%2F101%2Fthumb',
        'rating': None,
        'note': None,
        '_plex_item': item,
    }


def test_fetch_rating_uses_source_for_movies():
    """A movie's rating lives on the movie item itself."""
    item = FakeHistoryItem(ratingKey=101, type='movie', title='Dune: Part Two', source_rating=8.0)

    assert _fetch_rating(item) == 8.0


def test_fetch_rating_uses_show_for_episodes():
    """Ratings are given at the show level, not per-episode — an episode
    history entry must resolve to its parent show's rating."""
    item = FakeHistoryItem(
        ratingKey=202,
        type='episode',
        title='Nights',
        grandparentTitle='The Bear',
        show_rating=9.0,
    )

    assert _fetch_rating(item) == 9.0


def test_fetch_rating_returns_sentinel_when_lookup_fails():
    """Plex can drop an item from the library after it was watched (see
    the ratingKey-missing tests below) — a failed lookup must not crash
    the whole sync, and must be distinguishable from a confirmed 'no
    rating' (None), so a transient failure can never masquerade as a real
    rating change in `write_watch_item_files`."""

    class BrokenItem:
        type = 'movie'
        title = 'Deleted Movie'

        def source(self):
            raise Exception('410 Gone')

    assert _fetch_rating(BrokenItem()) is RATING_FETCH_FAILED


def test_transform_does_not_leak_plex_token_into_poster_url():
    """content/watch-items/*.yaml is committed to git — the poster URL must
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


def test_transform_prefers_season_poster_over_episode_still():
    """An episode's own `thumb` is usually a video-frame still, not
    artwork — the season poster (`parentThumb`) should win when both are
    present, so the card shows the poster of the season containing the
    most recently watched episode (aggregation already keeps that one)."""
    item = FakeHistoryItem(
        ratingKey=202,
        type='episode',
        title='Nights',
        grandparentTitle='The Bear',
        grandparentRatingKey=200,
        thumb='/library/metadata/202/thumb',
        parentThumb='/library/metadata/201/thumb',
        grandparentThumb='/library/metadata/200/thumb',
    )

    result = transform_history_item(item)

    assert result['posterUrl'] == '/api/watch-poster?path=%2Flibrary%2Fmetadata%2F201%2Fthumb'


def test_transform_falls_back_to_show_poster_when_no_season_or_episode_thumb():
    item = FakeHistoryItem(
        ratingKey=202,
        type='episode',
        title='Nights',
        grandparentTitle='The Bear',
        grandparentRatingKey=200,
        grandparentThumb='/library/metadata/200/thumb',
    )

    result = transform_history_item(item)

    assert result['posterUrl'] == '/api/watch-poster?path=%2Flibrary%2Fmetadata%2F200%2Fthumb'


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


def test_transform_pulls_trailing_year_out_of_title():
    """Plex can bake a disambiguating year into grandparentTitle (e.g. a
    library with both the 1999 anime and 2023 live-action "One Piece"),
    usually alongside a missing parentYear. A literal "(2023)" in the
    search query makes TMDB return zero results, so it needs splitting
    out into its own year field before the TMDB fallback runs."""
    item = FakeHistoryItem(
        ratingKey=606,
        type='episode',
        title='Episode 1',
        grandparentTitle='ONE PIECE (2023)',
        grandparentRatingKey=None,
    )

    result = transform_history_item(item)

    assert result['title'] == 'ONE PIECE'
    assert result['year'] == 2023
    # id keeps the raw (un-split) title so "One Piece" and "One Piece
    # (2023)" — two distinct shows missing their native key — don't collide.
    assert result['id'] == 'one-piece-2023'


def test_transform_prefers_native_year_over_title_suffix():
    item = FakeHistoryItem(
        ratingKey=101,
        type='movie',
        title='Movie (2020)',
        year=2024,
    )

    result = transform_history_item(item)

    assert result['year'] == 2024


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


def test_assign_readable_slugs_uses_title_not_native_key():
    entries = [_film_entry('101')]

    _assign_readable_slugs(entries)

    assert entries[0]['id'] == 'dune-part-two'


def test_assign_readable_slugs_dedupes_collisions_deterministically():
    """Two distinct items that happen to share a title (e.g. a remake) must
    not collide on the same filename — later ones (in title-sorted order)
    get a numeric suffix, and the ordering is stable across runs."""
    entries = [
        {**_film_entry('a'), 'title': 'One Piece', 'watchedAt': '2026-01-01T00:00:00+00:00'},
        {**_film_entry('b'), 'title': 'One Piece', 'watchedAt': '2026-02-01T00:00:00+00:00'},
    ]

    _assign_readable_slugs(entries)

    ids = sorted(e['id'] for e in entries)
    assert ids == ['one-piece', 'one-piece-2']


def test_compute_hidden_true_when_unrated():
    assert _compute_hidden(None) is True


def test_compute_hidden_true_below_threshold():
    assert _compute_hidden(7.9) is True


def test_compute_hidden_false_at_or_above_threshold():
    assert _compute_hidden(8.0) is False
    assert _compute_hidden(9.5) is False


def test_write_watch_item_files_creates_new_unrated_file_hidden(tmp_path, monkeypatch):
    """Unrated items default to hidden — only ratings you've actively given
    at or above MIN_RATING_TO_SHOW surface on the site by default."""
    monkeypatch.setattr(plex_etl, 'WATCH_ITEMS_DIR', tmp_path)

    write_watch_item_files([_film_entry('dune-part-two')])

    written = yaml.safe_load((tmp_path / 'dune-part-two.yaml').read_text())
    assert written['title'] == 'Dune: Part Two'
    assert written['hidden'] is True


def test_write_watch_item_files_creates_new_highly_rated_file_unhidden(tmp_path, monkeypatch):
    monkeypatch.setattr(plex_etl, 'WATCH_ITEMS_DIR', tmp_path)

    write_watch_item_files([{**_film_entry('dune-part-two'), 'rating': 9.0}])

    written = yaml.safe_load((tmp_path / 'dune-part-two.yaml').read_text())
    assert written['hidden'] is False


def test_write_watch_item_files_preserves_hidden_flag_when_rating_unchanged(tmp_path, monkeypatch):
    """`hidden` is only recomputed from rating when the rating itself has
    changed since the last sync — otherwise a manual override set through
    Keystatic must survive a routine resync untouched."""
    monkeypatch.setattr(plex_etl, 'WATCH_ITEMS_DIR', tmp_path)
    path = tmp_path / 'dune-part-two.yaml'
    path.write_text(yaml.safe_dump({'title': 'Dune: Part Two', 'rating': None, 'hidden': False}))

    write_watch_item_files([_film_entry('dune-part-two')])

    written = yaml.safe_load(path.read_text())
    assert written['hidden'] is False
    assert written['title'] == 'Dune: Part Two'


def test_write_watch_item_files_recomputes_hidden_when_rating_changes(tmp_path, monkeypatch):
    """A rating change in Plex (e.g. rating something well after the fact)
    drives visibility automatically, even overriding a prior manual hide."""
    monkeypatch.setattr(plex_etl, 'WATCH_ITEMS_DIR', tmp_path)
    path = tmp_path / 'dune-part-two.yaml'
    path.write_text(yaml.safe_dump({'title': 'Dune: Part Two', 'rating': None, 'hidden': True}))

    write_watch_item_files([{**_film_entry('dune-part-two'), 'rating': 9.0}])

    written = yaml.safe_load(path.read_text())
    assert written['hidden'] is False


def test_write_watch_item_files_preserves_state_on_rating_fetch_failure(tmp_path, monkeypatch):
    """A transient Plex lookup failure (RATING_FETCH_FAILED) must not be
    treated as a real rating change — otherwise a flaky request would
    silently re-hide an already-visible, well-rated entry."""
    monkeypatch.setattr(plex_etl, 'WATCH_ITEMS_DIR', tmp_path)
    path = tmp_path / 'dune-part-two.yaml'
    path.write_text(yaml.safe_dump({'title': 'Dune: Part Two', 'rating': 9.0, 'hidden': False}))

    write_watch_item_files([{**_film_entry('dune-part-two'), 'rating': RATING_FETCH_FAILED}])

    written = yaml.safe_load(path.read_text())
    assert written['rating'] == 9.0
    assert written['hidden'] is False


def test_write_watch_item_files_hides_new_entry_on_rating_fetch_failure(tmp_path, monkeypatch):
    """A brand-new entry has no prior state to fall back to on a failed
    rating lookup, so it defaults to hidden — same as a confirmed unrated
    item — rather than defaulting to visible."""
    monkeypatch.setattr(plex_etl, 'WATCH_ITEMS_DIR', tmp_path)

    write_watch_item_files([{**_film_entry('dune-part-two'), 'rating': RATING_FETCH_FAILED}])

    written = yaml.safe_load((tmp_path / 'dune-part-two.yaml').read_text())
    assert written['rating'] is None
    assert written['hidden'] is True


def test_write_watch_item_files_always_syncs_watched_at_from_plex(tmp_path, monkeypatch):
    """`watchedAt` always mirrors Plex, even if it differs from what's on
    disk — correct the date in Plex itself (Plex supports editing it
    directly) rather than in Keystatic, since the next sync overwrites it
    either way."""
    monkeypatch.setattr(plex_etl, 'WATCH_ITEMS_DIR', tmp_path)
    path = tmp_path / 'dune-part-two.yaml'
    path.write_text(
        yaml.safe_dump(
            {'title': 'Dune: Part Two', 'watchedAt': '2015-01-01T00:00:00+00:00', 'hidden': False}
        )
    )

    write_watch_item_files([_film_entry('dune-part-two')])

    written = yaml.safe_load(path.read_text())
    assert written['watchedAt'] == '2026-06-28T20:00:00+00:00'


def test_write_watch_item_files_does_not_remove_stale_entries(tmp_path, monkeypatch):
    """A show dropping back below MIN_EPISODES_FOR_SERIES (or a hidden
    entry no longer present in the latest sync) should stay on disk —
    manual edits/hides are never deleted out from under the user."""
    monkeypatch.setattr(plex_etl, 'WATCH_ITEMS_DIR', tmp_path)
    stale_path = tmp_path / 'stale-show.yaml'
    stale_path.write_text(yaml.safe_dump({'title': 'Stale Show', 'hidden': False}))

    write_watch_item_files([_film_entry('dune-part-two')])

    assert stale_path.exists()


def _watch_item_file(directory, name, *, hidden, watched_at):
    path = directory / f'{name}.yaml'
    path.write_text(yaml.safe_dump({'title': name, 'hidden': hidden, 'watchedAt': watched_at}))
    return path


def test_cleanup_deletes_hidden_items_older_than_max_age(tmp_path):
    old_path = _watch_item_file(
        tmp_path, 'old-flop', hidden=True, watched_at='2020-01-01T00:00:00+00:00'
    )

    deleted = cleanup_stale_hidden_items(
        tmp_path, max_age_days=365, now=datetime(2026, 7, 8, tzinfo=timezone.utc)
    )

    assert deleted == [old_path]
    assert not old_path.exists()


def test_cleanup_keeps_hidden_items_within_max_age(tmp_path):
    recent_path = _watch_item_file(
        tmp_path, 'recent-flop', hidden=True, watched_at='2026-06-01T00:00:00+00:00'
    )

    deleted = cleanup_stale_hidden_items(
        tmp_path, max_age_days=365, now=datetime(2026, 7, 8, tzinfo=timezone.utc)
    )

    assert deleted == []
    assert recent_path.exists()


def test_cleanup_never_deletes_visible_items_regardless_of_age(tmp_path):
    """A manually un-hidden item is protected from deletion, the same way
    it's protected from being auto-re-hidden by a routine resync."""
    visible_path = _watch_item_file(
        tmp_path, 'old-favourite', hidden=False, watched_at='2018-01-01T00:00:00+00:00'
    )

    deleted = cleanup_stale_hidden_items(
        tmp_path, max_age_days=365, now=datetime(2026, 7, 8, tzinfo=timezone.utc)
    )

    assert deleted == []
    assert visible_path.exists()


def test_cleanup_skips_items_with_no_watched_at(tmp_path):
    path = tmp_path / 'no-date.yaml'
    path.write_text(yaml.safe_dump({'title': 'No Date', 'hidden': True, 'watchedAt': None}))

    deleted = cleanup_stale_hidden_items(
        tmp_path, max_age_days=365, now=datetime(2026, 7, 8, tzinfo=timezone.utc)
    )

    assert deleted == []
    assert path.exists()


def test_read_existing_ignores_non_dict_yaml(tmp_path):
    """A file hand-edited (via Keystatic or git) into a YAML list/scalar
    must be treated as 'nothing on disk yet' rather than blowing up every
    caller's `.get(...)` calls with an AttributeError."""
    path = tmp_path / 'malformed.yaml'
    path.write_text(yaml.safe_dump(['not', 'a', 'mapping']))

    assert plex_etl._read_existing(path) == {}


def test_cleanup_skips_malformed_file_without_crashing(tmp_path):
    """`cleanup_stale_hidden_items` globs every file in the directory, not
    just ones touched by the current sync — one malformed file must not
    abort the cleanup pass for every other (valid) hidden entry."""
    malformed_path = tmp_path / 'malformed.yaml'
    malformed_path.write_text(yaml.safe_dump(['not', 'a', 'mapping']))
    old_path = _watch_item_file(
        tmp_path, 'old-flop', hidden=True, watched_at='2020-01-01T00:00:00+00:00'
    )

    deleted = cleanup_stale_hidden_items(
        tmp_path, max_age_days=365, now=datetime(2026, 7, 8, tzinfo=timezone.utc)
    )

    assert deleted == [old_path]
    assert malformed_path.exists()

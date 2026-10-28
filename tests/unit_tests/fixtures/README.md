# Unsplash test fixtures

Anonymised copies of real Unsplash API responses, loaded with `load_fixture('<name>.json')`. Each
endpoint returns different fields, and the tests check the pipeline handles each shape:

| File | Endpoint | Has |
| --- | --- | --- |
| `collection.json` | `/users/{user}/collections` | collection metadata |
| `collection_photo.json` | `/collections/{id}/photos` | basic photo data only |
| `user_photo_with_stats.json` | `/users/{user}/photos?stats=true` | + views and downloads |
| `photo_with_exif.json` | `/photos/{id}` | + EXIF and location |
| `photo_ON9hQ_02Cn4.json` | `/photos/{id}` | every field, including coordinates |

EXIF and location only come from `/photos/{id}`; stats only from the user photos endpoint.

When updating a fixture, keep the real response structure and keep personal data anonymised
("Test Photographer", "Test City"), then run `pytest tests/unit_tests/test_etl_transform.py`.

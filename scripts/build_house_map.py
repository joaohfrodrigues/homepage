"""Rasterize the travel room's pixel-art map of Europe.

Usage:
    curl -sLO https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_land.geojson
    python scripts/build_house_map.py ne_50m_land.geojson public/house/europe-map.png 176 100
    python scripts/build_house_map.py ne_50m_land.geojson public/house/europe-map-wall.png 52 30

The large map is the travel-map overlay; the small one lies on the study's
map table in-game.

Land polygons come from Natural Earth (public domain). The projection constants
must stay in sync with src/game/map-projection.ts, which places trip pins on
the same image.
"""

import json
import sys

from PIL import Image, ImageDraw

# Keep in sync with src/game/map-projection.ts
LON_MIN, LON_MAX = -30.0, 22.0
LAT_MIN, LAT_MAX = 35.0, 56.0

SUPERSAMPLE = 8
SEA = (127, 176, 201, 255)
SEA_DARK = (111, 160, 188, 255)
LAND = (233, 217, 166, 255)
COAST = (92, 70, 50, 255)


def project(lon: float, lat: float, width: int, height: int) -> tuple[float, float]:
    x = (lon - LON_MIN) / (LON_MAX - LON_MIN) * width
    y = (LAT_MAX - lat) / (LAT_MAX - LAT_MIN) * height
    return x, y


def main(src: str, out: str, width: int, height: int) -> None:
    with open(src) as f:
        features = json.load(f)['features']

    mask = Image.new('L', (width * SUPERSAMPLE, height * SUPERSAMPLE), 0)
    draw = ImageDraw.Draw(mask)
    for feature in features:
        geom = feature['geometry']
        polygons = geom['coordinates'] if geom['type'] == 'MultiPolygon' else [geom['coordinates']]
        for polygon in polygons:
            ring = polygon[0]
            # Skip polygons that are entirely outside the map window.
            lons = [p[0] for p in ring]
            lats = [p[1] for p in ring]
            if max(lons) < LON_MIN - 5 or min(lons) > LON_MAX + 5:
                continue
            if max(lats) < LAT_MIN - 5 or min(lats) > LAT_MAX + 5:
                continue
            pts = [
                tuple(c * SUPERSAMPLE for c in project(lon, lat, width, height))
                for lon, lat in ring
            ]
            draw.polygon(pts, fill=255)

    # Downsample with a hard threshold so the coastline stays crisp pixel art.
    small = mask.resize((width, height), Image.BOX).point(lambda v: 255 if v >= 96 else 0)
    land = small.load()

    img = Image.new('RGBA', (width, height), SEA)
    px = img.load()
    for y in range(height):
        for x in range(width):
            if land[x, y]:
                coastal = any(
                    0 <= x + dx < width and 0 <= y + dy < height and not land[x + dx, y + dy]
                    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))
                )
                px[x, y] = COAST if coastal else LAND
            elif (x + y * 3) % 11 == 0 and (y // 4) % 2 == 0:
                # Sparse dither so the sea doesn't read as a flat fill.
                px[x, y] = SEA_DARK

    img.save(out, optimize=True)
    print(f'wrote {out} ({width}x{height})')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4]))

"""Pack the land outlines for the house's pixel-art world map.

Usage:
    curl -sLO https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_land.geojson
    python scripts/build_house_map.py ne_50m_land.geojson public/house/world-land.json

Land polygons come from Natural Earth (public domain). The map itself is
rasterized in the browser by src/game/world-map.ts, at whatever view the map
is showing, so the coastline stays crisp pixel art at every zoom level.

Output format: {"scale": S, "rings": [[lon0, lat0, dlon1, dlat1, ...], ...]}
where coordinates are degrees * S rounded to integers and every point after
the first is a delta from the previous one. Holes (e.g. the Caspian Sea) are
plain rings too; the map fills them with the even-odd rule.
"""

import json
import sys

SCALE = 100  # 0.01° ≈ 1 km, finer than the map ever shows
# Drop points closer than this to the line through their neighbours (in
# scaled units). Well below a pixel at the deepest zoom.
TOLERANCE = 2


def simplify(points: list[tuple[int, int]]) -> list[tuple[int, int]]:
    """Douglas-Peucker, iterative so long coastlines don't hit the recursion limit."""
    if len(points) < 4:
        return points
    keep = [False] * len(points)
    keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]
    while stack:
        start, end = stack.pop()
        (ax, ay), (bx, by) = points[start], points[end]
        dx, dy = bx - ax, by - ay
        length = (dx * dx + dy * dy) ** 0.5
        best, best_dist = -1, 0.0
        for i in range(start + 1, end):
            px, py = points[i]
            if length == 0:
                dist = ((px - ax) ** 2 + (py - ay) ** 2) ** 0.5
            else:
                dist = abs(dy * px - dx * py + bx * ay - by * ax) / length
            if dist > best_dist:
                best, best_dist = i, dist
        if best_dist > TOLERANCE:
            keep[best] = True
            stack.append((start, best))
            stack.append((best, end))
    return [p for p, k in zip(points, keep, strict=True) if k]


def main(src: str, out: str) -> None:
    with open(src) as f:
        features = json.load(f)['features']

    rings = []
    total = 0
    for feature in features:
        geom = feature['geometry']
        polygons = geom['coordinates'] if geom['type'] == 'MultiPolygon' else [geom['coordinates']]
        for polygon in polygons:
            for ring in polygon:
                points: list[tuple[int, int]] = []
                for lon, lat in ring:
                    p = (round(lon * SCALE), round(lat * SCALE))
                    if not points or points[-1] != p:
                        points.append(p)
                points = simplify(points)
                if len(points) < 4:
                    continue
                flat = [points[0][0], points[0][1]]
                for (px, py), (x, y) in zip(points, points[1:], strict=False):
                    flat += [x - px, y - py]
                rings.append(flat)
                total += len(points)

    with open(out, 'w') as f:
        json.dump({'scale': SCALE, 'rings': rings}, f, separators=(',', ':'))
        f.write('\n')
    print(f'wrote {out}: {len(rings)} rings, {total} points')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])

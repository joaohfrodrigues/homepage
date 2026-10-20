/**
 * Lat/lon window of the pixel maps in public/house — keep in sync with
 * scripts/build_house_map.py, which rasterizes them.
 */
export const MAP_PROJECTION = { lonMin: -30, lonMax: 22, latMin: 35, latMax: 56 }

/** Position on the map as fractions of its width and height (0..1). */
export function projectToMap(lat: number, lon: number): { x: number; y: number } {
  const { lonMin, lonMax, latMin, latMax } = MAP_PROJECTION
  return {
    x: (lon - lonMin) / (lonMax - lonMin),
    y: (latMax - lat) / (latMax - latMin),
  }
}

export function isOnMap(lat: number, lon: number): boolean {
  const { x, y } = projectToMap(lat, lon)
  return x >= 0 && x <= 1 && y >= 0 && y <= 1
}

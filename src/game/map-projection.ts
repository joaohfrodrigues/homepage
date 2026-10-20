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

/** Inverse of projectToMap: a point on the map (0..1 fractions) back to lat/lon. */
export function unprojectFromMap(x: number, y: number): { lat: number; lon: number } {
  const { lonMin, lonMax, latMin, latMax } = MAP_PROJECTION
  return { lon: lonMin + x * (lonMax - lonMin), lat: latMax - y * (latMax - latMin) }
}

/** Great-circle distance in km. */
export function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const rad = (deg: number) => (deg * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLon = rad(b.lon - a.lon)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}

/**
 * Web Mercator for the house's pixel world map. Map coordinates are
 * normalised: x runs 0..1 from 180°W to 180°E, y runs 0..1 from ~85°N to
 * ~85°S. A view is a window into that square; every map (the travel map, the
 * fridge game, the study wall) shows one, rasterized by world-map.ts.
 */

export interface MapView {
  x: number
  y: number
  w: number
  h: number
}

export interface LatLon {
  lat: number
  lon: number
}

/** Poles are cut off here; nothing above or below is pannable. */
const LAT_LIMIT = 80
/** The deepest zoom, as a view width: about 9° of longitude. */
const MIN_VIEW_W = 0.025

export function mercX(lon: number): number {
  return (lon + 180) / 360
}

export function mercY(lat: number): number {
  const clamped = Math.max(-85, Math.min(85, lat))
  const rad = (clamped * Math.PI) / 180
  return 0.5 - Math.log(Math.tan(Math.PI / 4 + rad / 2)) / (2 * Math.PI)
}

function latFromMercY(y: number): number {
  return (Math.atan(Math.exp((0.5 - y) * 2 * Math.PI)) * 360) / Math.PI - 90
}

const WORLD_TOP = mercY(LAT_LIMIT)
const WORLD_BOTTOM = mercY(-LAT_LIMIT)

/**
 * The window the house used back when the map was only Europe. Trips that
 * all fit inside it get exactly this view, so the map looks the same until
 * the first trip further afield.
 */
const EUROPE = { x: mercX(-30), y: mercY(56), w: mercX(22) - mercX(-30), h: mercY(35) - mercY(56) }

export function isOnMap(lat: number, lon: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= LAT_LIMIT && Math.abs(lon) <= 180
}

/** Position within the view as fractions of its width and height (0..1 when visible). */
export function projectToMap(lat: number, lon: number, view: MapView): { x: number; y: number } {
  return { x: (mercX(lon) - view.x) / view.w, y: (mercY(lat) - view.y) / view.h }
}

/** Inverse of projectToMap: a point in the view (0..1 fractions) back to lat/lon. */
export function unprojectFromMap(x: number, y: number, view: MapView): LatLon {
  return { lon: (view.x + x * view.w) * 360 - 180, lat: latFromMercY(view.y + y * view.h) }
}

export function isInView(lat: number, lon: number, view: MapView): boolean {
  const { x, y } = projectToMap(lat, lon, view)
  return x >= 0 && x <= 1 && y >= 0 && y <= 1
}

/** Grow the view's short side so it matches `aspect` (width / height), keeping its centre. */
function withAspect(view: MapView, aspect: number): MapView {
  const cx = view.x + view.w / 2
  const cy = view.y + view.h / 2
  const w = Math.max(view.w, view.h * aspect)
  const h = w / aspect
  return { x: cx - w / 2, y: cy - h / 2, w, h }
}

/** Keep the view within the zoom limits and inside the world. */
export function clampView(view: MapView, aspect: number): MapView {
  let w = Math.min(1, Math.max(MIN_VIEW_W, view.w))
  let h = w / aspect
  if (h > WORLD_BOTTOM - WORLD_TOP) {
    h = WORLD_BOTTOM - WORLD_TOP
    w = h * aspect
  }
  const cx = view.x + view.w / 2
  const cy = view.y + view.h / 2
  const x = Math.min(1 - w, Math.max(0, cx - w / 2))
  const y = Math.min(WORLD_BOTTOM - h, Math.max(WORLD_TOP, cy - h / 2))
  return { x, y, w, h }
}

/**
 * The view that shows every point: the old Europe window when they all fit
 * in it, otherwise their bounding box with room for the pins, never zoomed in
 * further than the Europe window.
 */
export function fitView(points: LatLon[], aspect: number): MapView {
  const europe = clampView(withAspect(EUROPE, aspect), aspect)
  const onMap = points.filter((p) => isOnMap(p.lat, p.lon))
  if (onMap.every((p) => isInView(p.lat, p.lon, europe))) return europe

  const xs = onMap.map((p) => mercX(p.lon))
  const ys = onMap.map((p) => mercY(p.lat))
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const pad = Math.max(maxX - minX, (maxY - minY) * aspect) * 0.1
  // Extra headroom on top: pins stand above the point they mark.
  const box = { x: minX - pad, y: minY - pad * 2, w: maxX - minX + pad * 2, h: maxY - minY + pad * 3 }
  const cx = box.x + box.w / 2
  const cy = box.y + box.h / 2
  const w = Math.max(box.w, europe.w)
  const h = Math.max(box.h, europe.h)
  return clampView(withAspect({ x: cx - w / 2, y: cy - h / 2, w, h }, aspect), aspect)
}

/** Zoom by `factor` (>1 zooms in), keeping the point at (fx, fy) of the view where it is. */
export function zoomView(view: MapView, factor: number, fx: number, fy: number, aspect: number): MapView {
  const w = Math.min(1, Math.max(MIN_VIEW_W, view.w / factor))
  const h = w / aspect
  const px = view.x + fx * view.w
  const py = view.y + fy * view.h
  return clampView({ x: px - fx * w, y: py - fy * h, w, h }, aspect)
}

/** Move the view by fractions of its own size. */
export function panView(view: MapView, dx: number, dy: number, aspect: number): MapView {
  return clampView({ ...view, x: view.x + dx * view.w, y: view.y + dy * view.h }, aspect)
}

export function sameView(a: MapView, b: MapView): boolean {
  const eps = 1e-9
  return Math.abs(a.x - b.x) < eps && Math.abs(a.y - b.y) < eps && Math.abs(a.w - b.w) < eps
}

/** Great-circle distance in km. */
export function distanceKm(a: LatLon, b: LatLon): number {
  const rad = (deg: number) => (deg * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLon = rad(b.lon - a.lon)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}

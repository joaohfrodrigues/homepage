import 'server-only'
import Database from 'better-sqlite3'
import path from 'path'
import { blurHashToDataURL } from './blur-hash'

const DB_PATH = path.join(process.cwd(), 'data', 'photos.db')

// Module-level singleton — better-sqlite3 is synchronous and safe to reuse across calls
let _db: Database.Database | null = null
function getDb(): Database.Database {
  if (!_db) _db = new Database(DB_PATH, { readonly: true })
  return _db
}

export interface Photo {
  id: string
  title: string
  description: string
  altDescription: string
  url: string
  urlThumb: string
  urlRaw: string
  width: number
  height: number
  color: string
  blurHash: string
  blurDataURL: string
  views: number
  downloads: number
  likes: number
  createdAt: string
  exif: {
    make: string | null
    model: string | null
    exposureTime: string | null
    aperture: string | null
    focalLength: string | null
    iso: string | null
  }
  location: {
    name: string | null
    city: string | null
    country: string | null
  }
  tags: string[]
  photographer: {
    name: string
    username: string
    profileUrl: string | null
  }
  unsplashUrl: string | null
}

export interface Collection {
  id: string
  title: string
  slug: string
  description: string
  totalPhotos: number
  coverPhotoUrl: string | null
  publishedAt: string
  updatedAt: string
  totalViews: number
  totalDownloads: number
}

export type SortOrder = 'popular' | 'recent'

export type AlbumBadgeType = 'recent' | 'popular' | 'downloads' | 'updated'

export interface AlbumBadge {
  type: AlbumBadgeType
  emoji: string
  label: string
}

const ALBUM_BADGE_META: Record<AlbumBadgeType, { emoji: string; label: string }> = {
  recent: { emoji: '🆕', label: 'Most recent album' },
  popular: { emoji: '🔥', label: 'Most popular album' },
  downloads: { emoji: '📥', label: 'Most downloaded album' },
  updated: { emoji: '🕐', label: 'Recently updated album' },
}

// Priority when one album would qualify for more than one badge — only the
// highest-priority badge is kept, so every album carries at most one.
const ALBUM_BADGE_PRIORITY: AlbumBadgeType[] = ['recent', 'popular', 'downloads', 'updated']

function toTimestamp(iso: string): number {
  const t = Date.parse(iso)
  return Number.isNaN(t) ? 0 : t
}

const BADGE_RECENCY_WINDOW_MS = 30 * 24 * 60 * 60 * 1000

/** Timestamp for a time-based badge, or 0 (no signal) once it's older than a month. */
function recencyBadgeValue(iso: string): number {
  const ts = toTimestamp(iso)
  if (ts === 0 || Date.now() - ts > BADGE_RECENCY_WINDOW_MS) return 0
  return ts
}

/**
 * Picks the collection with the highest value(c). Collections with a value <= 0
 * are skipped entirely — a zero count isn't a real signal, just an empty one.
 * Ties favor the more recently published collection.
 */
function pickBadgeWinner(
  collections: Collection[],
  value: (c: Collection) => number,
): Collection | null {
  let winner: Collection | null = null
  let bestValue = 0
  for (const c of collections) {
    const v = value(c)
    if (v <= 0) continue
    if (
      v > bestValue ||
      (v === bestValue && winner && toTimestamp(c.publishedAt) > toTimestamp(winner.publishedAt))
    ) {
      winner = c
      bestValue = v
    }
  }
  return winner
}

/**
 * Assigns at most one badge per collection. Each category's winner is computed
 * independently; if a higher-priority category already claimed that collection,
 * the lower-priority badge is simply dropped rather than passed to the runner-up.
 */
export function computeAlbumBadges(collections: Collection[]): Map<string, AlbumBadge> {
  const winners: Record<AlbumBadgeType, Collection | null> = {
    recent: pickBadgeWinner(collections, (c) => recencyBadgeValue(c.publishedAt)),
    popular: pickBadgeWinner(collections, (c) => c.totalViews),
    downloads: pickBadgeWinner(collections, (c) => c.totalDownloads),
    updated: pickBadgeWinner(collections, (c) => recencyBadgeValue(c.updatedAt)),
  }

  const result = new Map<string, AlbumBadge>()
  const claimed = new Set<string>()
  for (const type of ALBUM_BADGE_PRIORITY) {
    const winner = winners[type]
    if (!winner || claimed.has(winner.id)) continue
    result.set(winner.id, { type, ...ALBUM_BADGE_META[type] })
    claimed.add(winner.id)
  }
  return result
}

/**
 * Collection titles are stored with a short year prefix, e.g. "23' Munich/Vienna".
 * Render them as "Munich/Vienna · 2023" for clarity. Titles that don't match the
 * prefix pattern are returned unchanged.
 */
export function formatCollectionTitle(title: string): string {
  const match = title.match(/^(\d{2})'\s*(.+)$/)
  if (!match) return title
  return `${match[2]} · 20${match[1]}`
}

function orderClause(sort: SortOrder, prefix = ''): string {
  const p = prefix ? `${prefix}.` : ''
  return sort === 'recent' ? `${p}created_at DESC` : `${p}views DESC, ${p}created_at DESC`
}

type RawRow = Record<string, unknown>

function rowToPhoto(row: RawRow): Photo {
  let tags: string[] = []
  try { tags = JSON.parse((row.tags as string) || '[]') } catch { /* empty */ }

  const blurHash = (row.blur_hash as string) || ''
  return {
    id: row.id as string,
    title: (row.title as string) || '',
    description: (row.description as string) || '',
    altDescription: (row.alt_description as string) || '',
    url: (row.url_regular as string) || '',
    urlThumb: (row.url_small as string) || '',
    urlRaw: (row.url_raw as string) || '',
    width: (row.width as number) || 0,
    height: (row.height as number) || 0,
    color: (row.color as string) || '#888888',
    blurHash,
    blurDataURL: blurHashToDataURL(blurHash),
    views: (row.views as number) || 0,
    downloads: (row.downloads as number) || 0,
    likes: (row.likes as number) || 0,
    createdAt: (row.created_at as string) || '',
    exif: {
      make: (row.exif_make as string) || null,
      model: (row.exif_model as string) || null,
      exposureTime: (row.exif_exposure_time as string) || null,
      aperture: (row.exif_aperture as string) || null,
      focalLength: (row.exif_focal_length as string) || null,
      iso: (row.exif_iso as string) || null,
    },
    location: {
      name: (row.location_name as string) || null,
      city: (row.location_city as string) || null,
      country: (row.location_country as string) || null,
    },
    tags,
    photographer: {
      name: (row.photographer_name as string) || 'João Rodrigues',
      username: (row.photographer_username as string) || '',
      profileUrl: (row.photographer_url as string) || null,
    },
    unsplashUrl: (row.unsplash_url as string) || null,
  }
}

export function getPhotos(opts: {
  page?: number
  perPage?: number
  sort?: SortOrder
}): { photos: Photo[]; hasMore: boolean } {
  const { page = 1, perPage = 30, sort = 'popular' } = opts
  const rows = getDb()
    .prepare(`SELECT * FROM photos ORDER BY ${orderClause(sort)} LIMIT ? OFFSET ?`)
    .all(perPage + 1, (page - 1) * perPage) as RawRow[]
  return { photos: rows.slice(0, perPage).map(rowToPhoto), hasMore: rows.length > perPage }
}

export function searchPhotos(opts: {
  query: string
  page?: number
  perPage?: number
  sort?: SortOrder
  collectionId?: string
}): { photos: Photo[]; hasMore: boolean } {
  const { query, page = 1, perPage = 30, sort = 'popular', collectionId } = opts
  const offset = (page - 1) * perPage

  try {
    let sql = 'SELECT p.* FROM photos p'
    const params: (string | number)[] = []
    const where: string[] = []

    if (query) {
      sql += ' JOIN photos_fts fts ON p.rowid = fts.rowid'
      where.push('photos_fts MATCH ?')
      // Wrap in FTS5 phrase quotes; escape embedded double-quotes by doubling them
      params.push(`"${query.replace(/"/g, '""')}"`)
    }

    if (collectionId) {
      sql += ' JOIN photo_collections pc ON p.id = pc.photo_id'
      where.push('pc.collection_id = ?')
      params.push(collectionId)
    }

    if (where.length) sql += ` WHERE ${where.join(' AND ')}`
    sql += ` ORDER BY ${orderClause(sort, 'p')} LIMIT ? OFFSET ?`
    params.push(perPage + 1, offset)

    const rows = getDb().prepare(sql).all(...params) as RawRow[]
    return { photos: rows.slice(0, perPage).map(rowToPhoto), hasMore: rows.length > perPage }
  } catch (err) {
    console.error('[searchPhotos] query failed:', err)
    return { photos: [], hasMore: false }
  }
}

export function getCollectionPhotos(opts: {
  collectionId: string
  page?: number
  perPage?: number
  sort?: SortOrder
}): { photos: Photo[]; hasMore: boolean } {
  const { collectionId, page = 1, perPage = 30, sort = 'recent' } = opts
  const rows = getDb()
    .prepare(
      `SELECT p.* FROM photos p
       JOIN photo_collections pc ON p.id = pc.photo_id
       WHERE pc.collection_id = ?
       ORDER BY ${orderClause(sort, 'p')}
       LIMIT ? OFFSET ?`,
    )
    .all(collectionId, perPage + 1, (page - 1) * perPage) as RawRow[]
  return { photos: rows.slice(0, perPage).map(rowToPhoto), hasMore: rows.length > perPage }
}

const COLLECTION_STATS_SQL = `
  COALESCE(
    (SELECT p.url_regular FROM photos p
     JOIN photo_collections pc ON pc.photo_id = p.id
     WHERE pc.collection_id = c.id ORDER BY p.views DESC LIMIT 1),
    c.cover_photo_url
  ) AS cover_photo_url,
  COALESCE(
    (SELECT SUM(p.views) FROM photos p
     JOIN photo_collections pc ON pc.photo_id = p.id
     WHERE pc.collection_id = c.id),
    0
  ) AS total_views,
  COALESCE(
    (SELECT SUM(p.downloads) FROM photos p
     JOIN photo_collections pc ON pc.photo_id = p.id
     WHERE pc.collection_id = c.id),
    0
  ) AS total_downloads
`

function rowToCollection(r: RawRow): Collection {
  return {
    id: r.id as string,
    title: formatCollectionTitle(r.title as string),
    slug: (r.slug as string) || '',
    description: (r.description as string) || '',
    totalPhotos: (r.total_photos as number) || 0,
    coverPhotoUrl: (r.cover_photo_url as string) || null,
    publishedAt: (r.published_at as string) || '',
    updatedAt: (r.updated_at as string) || '',
    totalViews: (r.total_views as number) || 0,
    totalDownloads: (r.total_downloads as number) || 0,
  }
}

export function getAllCollections(): Collection[] {
  const rows = getDb()
    .prepare(
      `SELECT c.id, c.title, c.slug, c.description, c.total_photos, c.published_at, c.updated_at,
        ${COLLECTION_STATS_SQL}
      FROM collections c ORDER BY c.published_at DESC`,
    )
    .all() as RawRow[]
  return rows.map(rowToCollection)
}

export function getCollectionBySlug(slug: string): Collection | null {
  const row = getDb()
    .prepare(
      `SELECT c.id, c.title, c.slug, c.description, c.total_photos, c.published_at, c.updated_at,
        ${COLLECTION_STATS_SQL}
      FROM collections c WHERE c.slug = ? LIMIT 1`,
    )
    .get(slug) as RawRow | undefined
  if (!row) return null
  return rowToCollection(row)
}

export interface TripStop {
  name: string
  lat: number
  lon: number
  photos: number
}

/** A collection seen as a trip: where it went, for the travel room's map. */
export interface Trip {
  id: string
  slug: string
  /** Display title, e.g. "Italy · 2025". */
  title: string
  place: string
  year: number | null
  totalPhotos: number
  coverPhotoUrl: string | null
  /** Clusters of geotagged photos, biggest first. Empty if nothing is geotagged. */
  stops: TripStop[]
}

// Photos within the same half-degree cell (~50km) count as one stop.
const STOP_GRID_DEGREES = 0.5

/**
 * Every collection as a trip, with its photos' GPS positions clustered into
 * stops. Newest trips first, by the year prefix in the title.
 */
export function getTrips(): Trip[] {
  const rawTitles = new Map(
    (getDb().prepare('SELECT id, title FROM collections').all() as RawRow[]).map((r) => [
      r.id as string,
      r.title as string,
    ]),
  )
  const located = getDb()
    .prepare(
      `SELECT pc.collection_id AS cid, p.location_city AS city, p.location_name AS name,
        p.location_latitude AS lat, p.location_longitude AS lon
      FROM photos p JOIN photo_collections pc ON pc.photo_id = p.id
      WHERE p.location_latitude IS NOT NULL AND p.location_longitude IS NOT NULL
        AND NOT (p.location_latitude = 0 AND p.location_longitude = 0)`,
    )
    .all() as RawRow[]

  type Cluster = { lat: number; lon: number; count: number; names: Map<string, number> }
  const clusters = new Map<string, Map<string, Cluster>>()
  for (const row of located) {
    const cid = row.cid as string
    const lat = row.lat as number
    const lon = row.lon as number
    const key = `${Math.round(lat / STOP_GRID_DEGREES)}:${Math.round(lon / STOP_GRID_DEGREES)}`
    const byKey = clusters.get(cid) ?? new Map<string, Cluster>()
    clusters.set(cid, byKey)
    const cluster = byKey.get(key) ?? { lat: 0, lon: 0, count: 0, names: new Map() }
    byKey.set(key, cluster)
    cluster.lat += lat
    cluster.lon += lon
    cluster.count++
    // Prefer the city; fall back to the first part of the place name ("Pico, Açores, …").
    const name = (row.city as string) || ((row.name as string) || '').split(',')[0].trim()
    if (name) cluster.names.set(name, (cluster.names.get(name) ?? 0) + 1)
  }

  const trips = getAllCollections().map((collection): Trip => {
    const match = (rawTitles.get(collection.id) ?? '').match(/^(\d{2})'\s*(.+)$/)
    const stops = [...(clusters.get(collection.id)?.values() ?? [])]
      .map((c) => ({
        name: [...c.names.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '',
        lat: c.lat / c.count,
        lon: c.lon / c.count,
        photos: c.count,
      }))
      .sort((a, b) => b.photos - a.photos)
    return {
      id: collection.id,
      slug: collection.slug,
      title: collection.title,
      place: match ? match[2] : collection.title,
      year: match ? 2000 + Number(match[1]) : null,
      totalPhotos: collection.totalPhotos,
      coverPhotoUrl: collection.coverPhotoUrl,
      stops,
    }
  })

  // getAllCollections is already newest-published first and sort is stable,
  // so trips from the same year keep that order.
  return trips.sort((a, b) => (b.year ?? 0) - (a.year ?? 0))
}

/** A geotagged photo for the kitchen's "Where was this taken?" game. */
export interface GeoPhoto {
  id: string
  url: string
  alt: string
  place: string
  lat: number
  lon: number
  tripSlug: string
  tripTitle: string
  width: number
  height: number
  /** The photo's average colour, behind it while it loads and around it when it doesn't fill its frame. */
  color: string
}

/** The most-viewed geotagged photos, each with the trip it belongs to. */
export function getGeoPhotos(limit = 80): GeoPhoto[] {
  const rows = getDb()
    .prepare(
      `SELECT p.id, p.url_regular, p.url_small, p.width, p.height, p.color, p.alt_description,
        p.location_city, p.location_name,
        p.location_latitude AS lat, p.location_longitude AS lon,
        MIN(c.slug) AS trip_slug, MIN(c.title) AS trip_title
      FROM photos p
      JOIN photo_collections pc ON pc.photo_id = p.id
      JOIN collections c ON c.id = pc.collection_id
      WHERE p.location_latitude IS NOT NULL AND p.location_longitude IS NOT NULL
        AND NOT (p.location_latitude = 0 AND p.location_longitude = 0)
      GROUP BY p.id
      ORDER BY p.views DESC
      LIMIT ?`,
    )
    .all(limit) as RawRow[]
  return rows.map((r) => ({
    id: r.id as string,
    // The game shows the photo large, so it gets the 1080px version rather than the 400px one.
    url: (r.url_regular as string) || (r.url_small as string) || '',
    alt: (r.alt_description as string) || 'Travel photograph',
    place: (r.location_city as string) || ((r.location_name as string) || '').split(',')[0].trim(),
    lat: r.lat as number,
    lon: r.lon as number,
    tripSlug: r.trip_slug as string,
    tripTitle: formatCollectionTitle(r.trip_title as string),
    width: (r.width as number) || 4,
    height: (r.height as number) || 3,
    color: (r.color as string) || '#2a2233',
  }))
}

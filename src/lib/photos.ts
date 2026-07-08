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

const RECENT_BADGE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000

/** Timestamp for the "recent" badge, or 0 (no signal) once the album is older than a month. */
function recentBadgeValue(publishedAt: string): number {
  const ts = toTimestamp(publishedAt)
  if (ts === 0 || Date.now() - ts > RECENT_BADGE_WINDOW_MS) return 0
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
    recent: pickBadgeWinner(collections, (c) => recentBadgeValue(c.publishedAt)),
    popular: pickBadgeWinner(collections, (c) => c.totalViews),
    downloads: pickBadgeWinner(collections, (c) => c.totalDownloads),
    updated: pickBadgeWinner(collections, (c) => toTimestamp(c.updatedAt)),
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

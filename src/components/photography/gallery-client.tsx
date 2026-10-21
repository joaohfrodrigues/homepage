'use client'

import { useState, useEffect, useRef, useCallback, useTransition } from 'react'
import { Search } from 'lucide-react'
import { PhotoGrid } from './photo-grid'
import { Lightbox } from './lightbox'
import { useHistoryLayer } from '@/components/house/house-navigation'
import type { Photo, SortOrder } from '@/lib/photos'

interface Props {
  initialPhotos: Photo[]
  initialHasMore: boolean
  collectionId?: string
}

export function GalleryClient({ initialPhotos, initialHasMore, collectionId }: Props) {
  const [photos, setPhotos] = useState<Photo[]>(initialPhotos)
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortOrder>('popular')
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [isPending, startTransition] = useTransition()
  const sentinelRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isLoadingMore = useRef(false)
  // Track page in a ref so the IntersectionObserver never re-registers just because a page loaded
  const pageRef = useRef(1)

  // Back closes the lightbox rather than the page under it.
  const closeLightbox = useCallback(() => setLightboxIndex(null), [])
  useHistoryLayer(lightboxIndex !== null, closeLightbox)

  const fetchPhotos = useCallback(
    async (opts: { q: string; s: SortOrder; p: number; append: boolean }) => {
      const { q, s, p, append } = opts
      const params = new URLSearchParams({
        q,
        sort: s,
        page: String(p),
        perPage: '30',
        ...(collectionId ? { collectionId } : {}),
      })
      const res = await fetch(`/api/photos?${params}`)
      if (!res.ok) return
      const data: { photos: Photo[]; hasMore: boolean } = await res.json()
      setPhotos((prev) => (append ? [...prev, ...data.photos] : data.photos))
      setHasMore(data.hasMore)
      pageRef.current = p
    },
    [collectionId],
  )

  // Search/sort change resets to page 1
  const handleQueryChange = (value: string) => {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      pageRef.current = 1
      startTransition(async () => { await fetchPhotos({ q: value, s: sort, p: 1, append: false }) })
    }, 350)
  }

  const handleSortChange = (value: SortOrder) => {
    setSort(value)
    pageRef.current = 1
    startTransition(async () => { await fetchPhotos({ q: query, s: value, p: 1, append: false }) })
  }

  // Infinite scroll via IntersectionObserver.
  // Does NOT depend on `page`/`hasMore` — page is tracked via pageRef to avoid the observer
  // re-registering (and immediately re-firing) after every successful page load. The sentinel
  // element is conditionally rendered when hasMore is true, so its DOM removal naturally
  // deactivates the observer when no more pages exist.
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoadingMore.current) {
          isLoadingMore.current = true
          fetchPhotos({ q: query, s: sort, p: pageRef.current + 1, append: true }).finally(() => {
            isLoadingMore.current = false
          })
        }
      },
      { rootMargin: '400px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [query, sort, fetchPhotos])

  return (
    <>
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            type="search"
            placeholder="Search photos…"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-md border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            aria-label="Search photos"
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-md border border-input overflow-hidden text-sm">
            {(['popular', 'recent'] as SortOrder[]).map((s) => (
              <button
                key={s}
                onClick={() => handleSortChange(s)}
                className={`px-3 py-2 capitalize transition-colors ${
                  sort === s
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background text-muted-foreground hover:text-foreground hover:bg-accent'
                }`}
                aria-pressed={sort === s}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className={`transition-opacity duration-200 ${isPending ? 'opacity-50 pointer-events-none' : ''}`}>
        <PhotoGrid photos={photos} onPhotoClick={setLightboxIndex} />
      </div>

      {/* Infinite scroll sentinel — rendered only while more pages exist */}
      {hasMore && <div ref={sentinelRef} className="h-1" aria-hidden />}

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <Lightbox
          photos={photos}
          index={lightboxIndex}
          onClose={closeLightbox}
          onNavigate={setLightboxIndex}
        />
      )}
    </>
  )
}

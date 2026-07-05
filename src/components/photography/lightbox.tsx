'use client'

import { useEffect, useRef } from 'react'
import type { TouchEvent } from 'react'
import Image from 'next/image'
import { X, ChevronLeft, ChevronRight, Camera, MapPin, ExternalLink } from 'lucide-react'
import type { Photo } from '@/lib/photos'

interface Props {
  photos: Photo[]
  index: number
  onClose: () => void
  onNavigate: (index: number) => void
}

function ExifRow({ label, value }: { label: string; value: string | null }) {
  if (!value) return null
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="text-right truncate">{value}</span>
    </div>
  )
}

export function Lightbox({ photos, index, onClose, onNavigate }: Props) {
  const photo = photos[index]
  const closeRef = useRef<HTMLButtonElement>(null)
  const touchStartX = useRef<number | null>(null)

  function onTouchStart(e: TouchEvent) {
    touchStartX.current = e.touches[0].clientX
  }

  function onTouchEnd(e: TouchEvent) {
    if (touchStartX.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    touchStartX.current = null
    if (Math.abs(dx) < 50) return
    if (dx < 0 && index < photos.length - 1) onNavigate(index + 1)
    if (dx > 0 && index > 0) onNavigate(index - 1)
  }

  useEffect(() => {
    closeRef.current?.focus()
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key === 'ArrowLeft' && index > 0) onNavigate(index - 1)
      if (e.key === 'ArrowRight' && index < photos.length - 1) onNavigate(index + 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, photos.length, onClose, onNavigate])

  // Prevent background scroll; restore exactly what was there before (not unconditionally blank)
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  if (!photo) return null

  const hasExif = photo.exif.make || photo.exif.model || photo.exif.focalLength || photo.exif.aperture || photo.exif.exposureTime || photo.exif.iso
  const locationParts = [photo.location.city, photo.location.country].filter(Boolean)
  const locationLabel = photo.location.name || locationParts.join(', ')

  return (
    <div
      data-testid="lightbox"
      role="dialog"
      aria-modal="true"
      aria-label="Photo lightbox"
      className="fixed inset-0 z-50 flex bg-black/95"
      onClick={onClose}
    >
      {/* Close */}
      <button
        ref={closeRef}
        onClick={onClose}
        className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
        aria-label="Close lightbox"
      >
        <X size={20} />
      </button>

      {/* Previous */}
      {index > 0 && (
        <button
          onClick={(e) => { e.stopPropagation(); onNavigate(index - 1) }}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          aria-label="Previous photo"
        >
          <ChevronLeft size={24} />
        </button>
      )}

      {/* Next */}
      {index < photos.length - 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); onNavigate(index + 1) }}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          aria-label="Next photo"
        >
          <ChevronRight size={24} />
        </button>
      )}

      {/* Main area: image + info */}
      <div
        className="flex flex-col lg:flex-row w-full h-full overflow-auto lg:overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Image */}
        <div
          className="flex-1 flex items-center justify-center p-4 lg:p-12 min-h-0"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <div className="relative max-w-full max-h-[70vh] lg:max-h-full">
            <Image
              src={photo.url}
              alt={photo.altDescription || photo.title || 'Photograph'}
              width={photo.width || 1080}
              height={photo.height || 720}
              className="max-h-[70vh] lg:max-h-[85vh] w-auto max-w-full object-contain"
              placeholder={photo.blurDataURL ? 'blur' : 'empty'}
              blurDataURL={photo.blurDataURL || undefined}
              priority
              sizes="100vw"
            />
          </div>
        </div>

        {/* Info panel */}
        <div className="w-full lg:w-72 xl:w-80 shrink-0 bg-background/5 text-white overflow-y-auto p-6 flex flex-col gap-5">
          {/* Title / description */}
          {(photo.title || photo.description) && (
            <div className="flex flex-col gap-1">
              {photo.title && <h2 className="font-semibold text-lg leading-snug">{photo.title}</h2>}
              {photo.description && <p className="text-sm text-white/70">{photo.description}</p>}
            </div>
          )}

          {/* EXIF */}
          {hasExif && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 text-white/50 text-xs uppercase tracking-widest">
                <Camera size={12} />
                <span>Camera</span>
              </div>
              <div className="flex flex-col gap-1.5 text-white/90">
                {(photo.exif.make || photo.exif.model) && (
                  <ExifRow
                    label="Camera"
                    value={[photo.exif.make, photo.exif.model].filter(Boolean).join(' ')}
                  />
                )}
                <ExifRow label="Focal length" value={photo.exif.focalLength ? `${photo.exif.focalLength} mm` : null} />
                <ExifRow label="Aperture" value={photo.exif.aperture ? `f/${photo.exif.aperture}` : null} />
                <ExifRow label="Shutter" value={photo.exif.exposureTime ? `${photo.exif.exposureTime}s` : null} />
                <ExifRow label="ISO" value={photo.exif.iso} />
              </div>
            </div>
          )}

          {/* Location */}
          {locationLabel && (
            <div className="flex items-start gap-2 text-sm text-white/80">
              <MapPin size={14} className="mt-0.5 shrink-0" />
              <span>{locationLabel}</span>
            </div>
          )}

          {/* Unsplash attribution */}
          <div className="mt-auto pt-4 border-t border-white/10 text-xs text-white/50 flex flex-col gap-1">
            <span>Photo by{' '}
              <a
                href={photo.photographer.profileUrl || `https://unsplash.com/@${photo.photographer.username}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/70 hover:text-white underline"
              >
                {photo.photographer.name}
              </a>
            </span>
            {photo.unsplashUrl && (
              <a
                href={photo.unsplashUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 hover:text-white/70 transition-colors"
              >
                <ExternalLink size={10} />
                View on Unsplash
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

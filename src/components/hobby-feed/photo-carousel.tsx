'use client'

import Image from 'next/image'
import { useEffect, useState, type ReactNode } from 'react'

type PhotoCarouselImage = {
  src: string
  alt: string
}

const ROTATE_INTERVAL_MS = 4000

export function PhotoCarousel({
  images,
  aspectRatio,
  overlay,
}: {
  images: PhotoCarouselImage[]
  aspectRatio: string
  overlay?: ReactNode
}) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (images.length <= 1) return
    const id = setInterval(() => {
      setIndex((current) => (current + 1) % images.length)
    }, ROTATE_INTERVAL_MS)
    return () => clearInterval(id)
  }, [images.length])

  if (images.length === 0) return null

  return (
    <div className={`relative overflow-hidden bg-[#2a2233] ${aspectRatio}`}>
      {images.map((image, i) => (
        <Image
          key={`${image.src}-${i}`}
          src={image.src}
          alt={image.alt}
          fill
          unoptimized={/^https?:\/\//.test(image.src)}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className={`object-cover transition-opacity duration-700 ${i === index ? 'opacity-100' : 'opacity-0'}`}
        />
      ))}
      {overlay && (
        // A solid ink caption plate, like the windows' title bars, rather than a gradient.
        <div className="absolute inset-x-0 bottom-0 border-t-2 border-[#2a2233] bg-[#2a2233]/85 px-3 py-2 text-[#f4ecd8]">
          {overlay}
        </div>
      )}
    </div>
  )
}

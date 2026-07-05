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
    <div className={`relative overflow-hidden rounded-lg bg-muted ${aspectRatio}`}>
      {images.map((image, i) => (
        <Image
          key={`${image.src}-${i}`}
          src={image.src}
          alt={image.alt}
          fill
          unoptimized={/^https?:\/\//.test(image.src)}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className={`object-cover transition-transform duration-700 ease-out group-hover:scale-110 ${
            i === index ? 'opacity-100' : 'opacity-0'
          } transition-[opacity,transform]`}
        />
      ))}
      {overlay ? (
        <>
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent transition-opacity duration-500 group-hover:opacity-40" />
          <div className="absolute inset-x-0 bottom-0 p-4 transition-opacity duration-500 group-hover:opacity-40">
            {overlay}
          </div>
        </>
      ) : (
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 via-black/0 to-black/0 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
      )}
    </div>
  )
}

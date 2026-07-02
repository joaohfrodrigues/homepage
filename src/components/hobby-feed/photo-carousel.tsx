'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'

type PhotoCarouselImage = {
  src: string
  alt: string
}

const ROTATE_INTERVAL_MS = 4000

export function PhotoCarousel({ images }: { images: PhotoCarouselImage[] }) {
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
    <div className="relative aspect-[4/3] overflow-hidden rounded-md bg-muted">
      {images.map((image, i) => (
        <Image
          key={`${image.src}-${i}`}
          src={image.src}
          alt={image.alt}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className={`object-cover transition-[opacity,transform] duration-700 group-hover:scale-105 ${
            i === index ? 'opacity-100' : 'opacity-0'
          }`}
        />
      ))}
    </div>
  )
}

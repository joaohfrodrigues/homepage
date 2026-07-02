'use client'

import { RowsPhotoAlbum } from 'react-photo-album'
import 'react-photo-album/rows.css'
import type { Photo as AlbumPhotoBase } from 'react-photo-album'
import type { Photo } from '@/lib/photos'
import { PhotoImage, PhotoOverlay } from './photo-card'

interface AlbumPhoto extends AlbumPhotoBase {
  original: Photo
}

interface Props {
  photos: Photo[]
  onPhotoClick: (index: number) => void
}

export function PhotoGrid({ photos, onPhotoClick }: Props) {
  if (photos.length === 0) {
    return <p className="text-center text-muted-foreground py-12">No photos found.</p>
  }

  // react-photo-album lays out photos in stable, in-order rows: appended pages
  // are placed after existing ones and never re-shuffle prior photos.
  const albumPhotos: AlbumPhoto[] = photos.map((p) => ({
    key: p.id,
    src: p.url,
    width: p.width || 1080,
    height: p.height || 720,
    alt: p.altDescription || p.title || 'Photograph by Joao Rodrigues',
    original: p,
  }))

  return (
    <RowsPhotoAlbum
      photos={albumPhotos}
      spacing={8}
      targetRowHeight={(width) => (width < 640 ? 170 : width < 1024 ? 220 : 260)}
      onClick={({ index }) => onPhotoClick(index)}
      componentsProps={{
        button: {
          className:
            'group overflow-hidden rounded-sm bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        },
      }}
      render={{
        image: (props, { photo, index }) => (
          <PhotoImage
            photo={(photo as AlbumPhoto).original}
            priority={index < 8}
            className={props.className}
            style={props.style}
          />
        ),
        extras: (_, { photo }) => <PhotoOverlay photo={(photo as AlbumPhoto).original} />,
      }}
    />
  )
}

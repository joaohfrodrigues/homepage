import type { Metadata } from 'next'
import { buildOpenGraphMetadata } from '@/lib/site-config'

const description = 'Films and TV shows from the Plex library.'

export const metadata: Metadata = {
  title: 'Watching',
  description,
  ...buildOpenGraphMetadata({
    type: 'website',
    title: 'Watching',
    description,
    url: '/watching',
  }),
}

export default function WatchingPage() {
  return (
    <div className="container mx-auto max-w-2xl px-4 py-24 text-center">
      <h1 className="text-4xl heading-lego mb-3">Watching</h1>
      <p className="text-muted-foreground text-lg">
        Films and TV shows from the Plex library — coming soon.
      </p>
    </div>
  )
}

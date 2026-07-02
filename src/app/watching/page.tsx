import type { Metadata } from 'next'
import { buildOpenGraphMetadata } from '@/lib/site-config'
import { PageHeader } from '@/components/ui/page-header'

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
    <div className="container mx-auto max-w-2xl px-4 py-24">
      <PageHeader
        title="Watching"
        description="Films and TV shows from the Plex library — coming soon."
      />
    </div>
  )
}

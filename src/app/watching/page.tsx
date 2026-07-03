import type { Metadata } from 'next'
import { buildOpenGraphMetadata } from '@/lib/site-config'
import { PageHeader } from '@/components/ui/page-header'
import { PageContainer } from '@/components/ui/page-container'

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
    <PageContainer width="narrow" className="py-24">
      <PageHeader
        title="Watching"
        description="Films and TV shows from the Plex library — coming soon."
      />
    </PageContainer>
  )
}

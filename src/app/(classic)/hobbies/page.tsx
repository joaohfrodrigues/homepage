import type { Metadata } from 'next'
import { getHobbyFeed, getHobbyFilterCategories } from '@/lib/hobby-feed'
import { buildOpenGraphMetadata } from '@/lib/site-config'
import { HobbyFeedView } from '@/components/hobby-feed/hobby-feed-view'
import { PageHeader } from '@/components/ui/page-header'
import { PageContainer } from '@/components/ui/page-container'

const description = "Out and about."

export const metadata: Metadata = {
  title: 'Hobbies',
  description,
  ...buildOpenGraphMetadata({
    type: 'website',
    title: 'Hobbies',
    description,
    url: '/hobbies',
  }),
}

export default async function HobbiesPage({
  searchParams,
}: {
  searchParams: Promise<{ hobby?: string; gear?: string }>
}) {
  const params = await searchParams
  const initialSelectedHobbies = params.hobby ? params.hobby.split(',').filter(Boolean) : []
  const initialGearOnly = params.gear === '1'

  const feed = await getHobbyFeed()
  const filterCategories = getHobbyFilterCategories(feed)

  return (
    <PageContainer as="main" className="py-16">
      <PageHeader title="Hobbies" description={description} className="mb-10" />

      <HobbyFeedView
        feed={feed}
        filterCategories={filterCategories}
        initialSelectedHobbies={initialSelectedHobbies}
        initialGearOnly={initialGearOnly}
      />
    </PageContainer>
  )
}

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import { getPage } from '@/lib/pages'
import { PersonJsonLd } from '@/components/person-jsonld'
import { buildOpenGraphMetadata } from '@/lib/site-config'
import { LegoBricksIllustration } from '@/components/ui/lego-bricks-illustration'
import { PageHeader } from '@/components/ui/page-header'
import { PageContainer } from '@/components/ui/page-container'

export function generateMetadata(): Metadata {
  const page = getPage('about')
  if (!page) return {}
  return {
    title: 'About',
    description: page.description,
    ...buildOpenGraphMetadata({
      type: 'website',
      title: 'About',
      description: page.description,
      url: '/about',
    }),
  }
}

export default function AboutPage() {
  const page = getPage('about')
  if (!page) notFound()

  return (
    <PageContainer width="narrow" className="py-16">
      <PersonJsonLd />
      <PageHeader
        title="About"
        icon={<LegoBricksIllustration className="h-14 w-14 text-brand shrink-0" />}
        align="left"
        className="mb-8"
      />
      <div className="prose prose-neutral dark:prose-invert max-w-none">
        <ReactMarkdown
          components={{
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            img: ({ node, ...props }: any) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                {...props}
                alt={props.alt ?? ''}
                className="rounded-xl w-full max-w-xs"
              />
            ),
          }}
        >
          {page.content}
        </ReactMarkdown>
      </div>
    </PageContainer>
  )
}

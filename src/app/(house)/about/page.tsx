import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import { getPage } from '@/lib/pages'
import { PersonJsonLd } from '@/components/person-jsonld'
import { buildOpenGraphMetadata } from '@/lib/site-config'
import { HouseOverlay } from '@/components/house/house-overlay'

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
    <HouseOverlay eyebrow="Living room" title="About João" width="narrow">
      <PersonJsonLd />
      <div className="prose prose-neutral max-w-none">
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
    </HouseOverlay>
  )
}

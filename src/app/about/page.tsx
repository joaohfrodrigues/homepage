import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import { getPage } from '@/lib/pages'
import { PersonJsonLd } from '@/components/person-jsonld'
import { buildOpenGraphMetadata } from '@/lib/site-config'

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
    <div className="container mx-auto max-w-2xl px-4 py-16">
      <PersonJsonLd />
      <h1 className="text-4xl heading-lego mb-8">About</h1>
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
    </div>
  )
}

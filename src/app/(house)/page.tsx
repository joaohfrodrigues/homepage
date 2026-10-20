import type { Metadata } from 'next'
import Link from 'next/link'
import { PersonJsonLd } from '@/components/person-jsonld'
import { buildOpenGraphMetadata } from '@/lib/site-config'

const description =
  'Personal site of João Rodrigues — walk around his house to find his photography, writing, film & TV, and music.'

export const metadata: Metadata = {
  description,
  ...buildOpenGraphMetadata({
    type: 'website',
    title: 'João Rodrigues',
    description,
    url: '/',
  }),
}

/**
 * The house itself is drawn by the (house) layout; the page only carries the
 * text version for screen readers and crawlers.
 */
export default function HomePage() {
  return (
    <div className="sr-only">
      <PersonJsonLd />
      <h1>João Rodrigues</h1>
      <p>{description}</p>
      <nav aria-label="Rooms">
        <ul>
          <li>
            <Link href="/photography">Travel map — photography by trip</Link>
          </li>
          <li>
            <Link href="/about">About João</Link>
          </li>
          <li>
            <Link href="/writing">Writing</Link>
          </li>
          <li>
            <Link href="/hobbies">Hobbies</Link>
          </li>
        </ul>
      </nav>
    </div>
  )
}

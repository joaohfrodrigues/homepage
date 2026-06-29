import type { Metadata } from 'next'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'João Rodrigues',
}

const sections = [
  {
    href: '/photography',
    label: 'Photography',
    description: 'Street, travel, and portrait photography.',
  },
  {
    href: '/writing',
    label: 'Writing',
    description: 'Articles on home servers, tech, and personal projects.',
  },
  {
    href: '/watching',
    label: 'Watching',
    description: 'Films and TV shows from the Plex library.',
  },
  {
    href: '/music',
    label: 'Music',
    description: 'Gigs and setlists from the band.',
  },
]

export default function HomePage() {
  return (
    <div className="container mx-auto px-4 py-24 flex flex-col items-center text-center gap-12">
      <div className="flex flex-col gap-4 max-w-prose">
        <h1 className="text-5xl font-bold tracking-tight">João Rodrigues</h1>
        <p className="text-xl text-muted-foreground">
          Photographer, writer, film watcher, drummer.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full max-w-4xl">
        {sections.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="group flex flex-col gap-2 rounded-lg border border-border p-6 text-left hover:bg-accent transition-colors"
          >
            <h2 className="font-semibold group-hover:text-accent-foreground">
              {section.label}
            </h2>
            <p className="text-sm text-muted-foreground">{section.description}</p>
          </Link>
        ))}
      </div>

      <Button asChild variant="outline">
        <Link href="/about">About me</Link>
      </Button>
    </div>
  )
}

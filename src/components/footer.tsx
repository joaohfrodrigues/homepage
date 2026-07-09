'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { GITHUB_URL, UNSPLASH_URL, LINKEDIN_URL } from '@/lib/site-config'
import { LegoBadgeIcon } from '@/components/ui/lego-badge-icon'

export function Footer() {
  const pathname = usePathname()

  if (pathname?.startsWith('/keystatic')) {
    return null
  }

  return (
    <footer className="border-t border-border mt-auto">
      <div className="pt-4 flex justify-center">
        <LegoBadgeIcon className="h-6 w-6 text-muted-foreground/40" />
      </div>
      <div className="container mx-auto px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} João Rodrigues
        </p>
        <div className="flex items-center gap-5">
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <i className="fa-brands fa-github text-lg leading-none" />
          </a>
          <a
            href={LINKEDIN_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="LinkedIn"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <i className="fa-brands fa-linkedin text-lg leading-none" />
          </a>
          <a
            href={UNSPLASH_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Unsplash"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <i className="fa-brands fa-unsplash text-lg leading-none" />
          </a>
          <Link
            href="/keystatic"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Keystatic
          </Link>
          <Link
            href="/about"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            About
          </Link>
        </div>
      </div>
    </footer>
  )
}

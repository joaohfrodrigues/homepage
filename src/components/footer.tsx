import Link from 'next/link'
import { Github } from 'lucide-react'
import { GITHUB_URL, UNSPLASH_URL } from '@/lib/site-config'

function BrickRow() {
  return (
    <svg
      viewBox="0 0 240 24"
      preserveAspectRatio="none"
      aria-hidden="true"
      className="h-5 w-full max-w-xs mx-auto text-muted-foreground/40"
    >
      <rect x="0" y="8" width="72" height="14" rx="2" fill="none" stroke="currentColor" />
      <circle cx="18" cy="8" r="4" fill="none" stroke="currentColor" />
      <circle cx="54" cy="8" r="4" fill="none" stroke="currentColor" />
      <rect x="80" y="8" width="40" height="14" rx="2" fill="none" stroke="currentColor" />
      <circle cx="100" cy="8" r="4" fill="none" stroke="currentColor" />
      <rect x="128" y="8" width="112" height="14" rx="2" fill="none" stroke="currentColor" />
      <circle cx="156" cy="8" r="4" fill="none" stroke="currentColor" />
      <circle cx="184" cy="8" r="4" fill="none" stroke="currentColor" />
      <circle cx="212" cy="8" r="4" fill="none" stroke="currentColor" />
    </svg>
  )
}

export function Footer() {
  return (
    <footer className="border-t border-border mt-auto">
      <div className="pt-4">
        <BrickRow />
      </div>
      <div className="container mx-auto px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} Joao Rodrigues
        </p>
        <div className="flex items-center gap-5">
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <Github size={18} />
          </a>
          <a
            href={UNSPLASH_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Unsplash
          </a>
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

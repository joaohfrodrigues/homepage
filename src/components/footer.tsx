import Link from 'next/link'
import { Github } from 'lucide-react'
import { GITHUB_URL, UNSPLASH_URL } from '@/lib/site-config'

export function Footer() {
  return (
    <footer className="border-t border-border mt-auto">
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

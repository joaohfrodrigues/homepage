'use client'

import Link from 'next/link'
import { Menu, X } from 'lucide-react'
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { LegoBricksIllustration } from '@/components/ui/lego-bricks-illustration'
import { cn } from '@/lib/utils'

const navLinks = [
  { href: '/writing', label: 'Writing' },
  { href: '/photography', label: 'Photography' },
  { href: '/hobbies', label: 'Hobbies' },
  { href: '/watching', label: 'Watching' },
]

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 flex h-16 items-center justify-between">
        <Link
          href="/"
          className="group relative flex items-center gap-1.5 font-semibold text-lg tracking-tight"
        >
          <LegoBricksIllustration className="h-4 w-4 text-brand opacity-0 -translate-y-0.5 scale-75 transition-all duration-150 group-hover:opacity-100 group-hover:translate-y-0 group-hover:scale-100" />
          Joao Rodrigues
        </Link>

        <nav className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => {
            const isActive = pathname?.startsWith(link.href)
            return (
              <Link
                key={link.href}
                href={link.href}
                className="group relative flex flex-col items-center gap-1 text-sm text-muted-foreground hover:text-brand transition-colors"
              >
                {link.label}
                <LegoBricksIllustration
                  className={cn(
                    'h-4 w-4 text-brand transition-opacity duration-150',
                    isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                  )}
                />
              </Link>
            )
          })}
        </nav>

        <button
          className="md:hidden p-2 rounded-md hover:bg-accent transition-colors"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileMenuOpen}
        >
          {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden border-t border-border bg-background">
          <nav className="container mx-auto px-4 py-4 flex flex-col gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'py-2 text-sm transition-colors flex items-center gap-2',
                  pathname?.startsWith(link.href)
                    ? 'text-brand'
                    : 'text-muted-foreground hover:text-brand'
                )}
                onClick={() => setMobileMenuOpen(false)}
              >
                {pathname?.startsWith(link.href) && (
                  <LegoBricksIllustration className="h-4 w-4 text-brand" />
                )}
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  )
}

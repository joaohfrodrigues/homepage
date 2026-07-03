import Link from 'next/link'

interface BackLinkProps {
  href: string
  label: string
}

export function BackLink({ href, label }: BackLinkProps) {
  return (
    <Link
      href={href}
      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
    >
      ← {label}
    </Link>
  )
}

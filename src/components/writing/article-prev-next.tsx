import Link from 'next/link'

interface AdjacentArticle {
  href: string
  title: string
}

interface ArticlePrevNextProps {
  prev?: AdjacentArticle
  next?: AdjacentArticle
}

export function ArticlePrevNext({ prev, next }: ArticlePrevNextProps) {
  return (
    <nav
      className="mt-16 pt-8 border-t border-border grid grid-cols-2 gap-4"
      aria-label="Article navigation"
    >
      <div>
        {prev && (
          <Link href={prev.href} className="group flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">← Previous</span>
            <span className="text-sm font-medium group-hover:underline underline-offset-4">
              {prev.title}
            </span>
          </Link>
        )}
      </div>
      <div className="text-right">
        {next && (
          <Link href={next.href} className="group flex flex-col gap-1 items-end">
            <span className="text-xs text-muted-foreground">Next →</span>
            <span className="text-sm font-medium group-hover:underline underline-offset-4">
              {next.title}
            </span>
          </Link>
        )}
      </div>
    </nav>
  )
}

import Link from 'next/link'
import { formatDate } from '@/lib/format-date'

interface ArticleListItemProps {
  href: string
  title: string
  publishedAt: string
  description?: string
}

export function ArticleListItem({ href, title, publishedAt, description }: ArticleListItemProps) {
  return (
    <li>
      <article>
        <time className="text-sm text-muted-foreground">{formatDate(publishedAt)}</time>
        <h3 className="text-xl font-semibold mt-1 mb-2">
          <Link href={href} className="hover:underline underline-offset-4">
            {title}
          </Link>
        </h3>
        {description && (
          <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
        )}
      </article>
    </li>
  )
}

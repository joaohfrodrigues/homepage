import Link from 'next/link'
import { formatDate } from '@/lib/format-date'
import { ProjectPill } from './project-pill'

interface ArticleListItemProps {
  href: string
  title: string
  publishedAt: string
  description?: string
  project?: { slug: string; title: string } | null
}

export function ArticleListItem({
  href,
  title,
  publishedAt,
  description,
  project,
}: ArticleListItemProps) {
  return (
    <li>
      <article>
        <div className="flex items-center gap-2">
          <time className="text-sm text-muted-foreground">{formatDate(publishedAt)}</time>
          {project && <ProjectPill slug={project.slug} title={project.title} />}
        </div>
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

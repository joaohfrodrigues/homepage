import { formatDate } from '@/lib/format-date'
import { cn } from '@/lib/utils'

interface ArticleMetaProps {
  publishedAt: string
  readingTime: number
  className?: string
}

export function ArticleMeta({ publishedAt, readingTime, className }: ArticleMetaProps) {
  return (
    <div className={cn('flex items-center gap-4 text-sm text-muted-foreground', className)}>
      <time>{formatDate(publishedAt)}</time>
      <span>{readingTime} min read</span>
    </div>
  )
}

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface PageHeaderProps {
  title: string
  description?: string
  eyebrow?: string
  icon?: ReactNode
  size?: 'default' | 'hero' | 'compact'
  align?: 'center' | 'left'
  className?: string
}

const titleSizes = {
  default: 'text-4xl',
  hero: 'text-5xl',
  compact: 'text-3xl',
}

export function PageHeader({
  title,
  description,
  eyebrow,
  icon,
  size = 'default',
  align = 'center',
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        'flex flex-col gap-3',
        align === 'center' ? 'items-center text-center' : 'items-start',
        className
      )}
    >
      <div className={cn('flex items-start gap-4', icon && 'w-full justify-between')}>
        <div>
          {eyebrow && (
            <p className="text-sm text-muted-foreground mb-2 uppercase tracking-widest">
              {eyebrow}
            </p>
          )}
          <h1 className={cn(titleSizes[size], 'heading-lego')}>{title}</h1>
        </div>
        {icon}
      </div>
      {description && (
        <p className={cn('text-muted-foreground', size === 'hero' ? 'text-xl' : 'text-lg')}>
          {description}
        </p>
      )}
    </header>
  )
}

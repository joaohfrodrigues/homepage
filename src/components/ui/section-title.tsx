import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface SectionTitleProps {
  children: ReactNode
  action?: ReactNode
  className?: string
}

export function SectionTitle({ children, action, className }: SectionTitleProps) {
  return (
    <div
      className={cn('flex items-baseline justify-between mb-6 border-b border-border pb-3', className)}
    >
      <h2 className="text-lg font-lego">{children}</h2>
      {action}
    </div>
  )
}

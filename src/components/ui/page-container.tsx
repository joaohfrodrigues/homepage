import type { ElementType, ReactNode } from 'react'
import { cn } from '@/lib/utils'

const widths = {
  narrow: 'max-w-2xl',
  wide: 'max-w-5xl',
}

interface PageContainerProps {
  children: ReactNode
  width?: keyof typeof widths
  as?: ElementType
  className?: string
}

export function PageContainer({
  children,
  width = 'wide',
  as: Component = 'div',
  className,
}: PageContainerProps) {
  return (
    <Component className={cn('container mx-auto px-4', widths[width], className)}>
      {children}
    </Component>
  )
}

import { cn } from '@/lib/utils'

export function Stud({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={cn('h-2 w-2', className)}
    >
      <circle cx="8" cy="8" r="7" fill="currentColor" />
      <circle cx="6" cy="6" r="2" fill="white" fillOpacity="0.35" />
    </svg>
  )
}

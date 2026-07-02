import { cn } from '@/lib/utils'

export function BuildingBlocksIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn('h-10 w-10', className)}
    >
      <path d="M24,22H6c-0.6,0-1,0.4-1,1v5c0,0.6,0.4,1,1,1h18c0.6,0,1-0.4,1-1v-5C25,22.4,24.6,22,24,22z" />
      <path d="M10,22H6v-2c0-0.6,0.4-1,1-1h2c0.6,0,1,0.4,1,1V22z" />
      <path d="M25,15H14c-0.6,0-1,0.4-1,1v5c0,0.6,0.4,1,1,1h11c0.6,0,1-0.4,1-1v-5C26,15.4,25.6,15,25,15z" />
      <path d="M25,15h-4v-2c0-0.6,0.4-1,1-1h2c0.6,0,1,0.4,1,1V15z" />
      <path d="M17,8H6C5.4,8,5,8.4,5,9v5c0,0.6,0.4,1,1,1h11c0.6,0,1-0.4,1-1V9C18,8.4,17.6,8,17,8z" />
      <path d="M10,8H6V6c0-0.6,0.4-1,1-1h2c0.6,0,1,0.4,1,1V8z" />
      <path d="M17,8h-4V6c0-0.6,0.4-1,1-1h2c0.6,0,1,0.4,1,1V8z" />
    </svg>
  )
}

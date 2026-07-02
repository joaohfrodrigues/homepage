import { BuildingBlocksIcon } from '@/components/ui/building-blocks-icon'

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-3 text-center py-12 text-muted-foreground">
      <BuildingBlocksIcon className="h-10 w-10 opacity-40" />
      <p>{message}</p>
    </div>
  )
}

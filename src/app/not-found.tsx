import Link from 'next/link'
import { BuildingBlocksIcon } from '@/components/ui/building-blocks-icon'

export default function NotFound() {
  return (
    <div className="container mx-auto max-w-2xl px-4 py-24 flex flex-col items-center gap-4 text-center">
      <BuildingBlocksIcon className="h-14 w-14 text-muted-foreground opacity-40" />
      <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
      <p className="text-muted-foreground">
        The piece you&rsquo;re looking for isn&rsquo;t here.
      </p>
      <Link href="/" className="text-sm hover:text-brand transition-colors underline-offset-4 hover:underline">
        Back home
      </Link>
    </div>
  )
}

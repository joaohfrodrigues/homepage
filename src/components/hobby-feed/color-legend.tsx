import type { TileColor } from '@/lib/tile-colors'

export function ColorLegend({ items }: { items: { slug: string; title: string; color: TileColor }[] }) {
  return (
    <div className="mb-10 flex flex-wrap gap-x-5 gap-y-2">
      {items.map((item) => (
        <div key={item.slug} className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className={`h-2.5 w-2.5 rounded-sm ${item.color.swatch}`} />
          {item.title}
        </div>
      ))}
    </div>
  )
}

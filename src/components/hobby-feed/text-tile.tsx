import { CARD_ASPECT_RATIO } from '@/lib/aspect-ratio'

export function TextTile({
  title,
  description,
}: {
  title: string
  description?: string | null
}) {
  return (
    <div
      className={`relative flex flex-col overflow-hidden rounded-lg bg-muted p-5 transition-transform duration-500 ease-out group-hover:scale-[1.02] ${CARD_ASPECT_RATIO}`}
    >
      <div className="mt-auto">
        <p className="line-clamp-4 font-serif text-2xl leading-tight tracking-tight">{title}</p>
        {description && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{description}</p>}
      </div>
    </div>
  )
}

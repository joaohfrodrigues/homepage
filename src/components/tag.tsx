import { tagColor } from '@/lib/tag-colors'

export function Tag({ label }: { label: string }) {
  const { bg, text } = tagColor(label)
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${bg} ${text}`}
    >
      {label}
    </span>
  )
}

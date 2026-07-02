import { tagColor } from '@/lib/tag-colors'

export function Tag({ label }: { label: string }) {
  const { bg, text } = tagColor(label)
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${bg} ${text}`}
    >
      {label}
    </span>
  )
}

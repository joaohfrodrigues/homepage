import { tagColor } from '@/lib/tag-colors'

export function Tag({ label }: { label: string }) {
  const { bg, text } = tagColor(label)
  return (
    <span
      className={`font-pixel inline-flex items-center px-1.5 py-0.5 text-[11px] uppercase leading-none tracking-wider shadow-[0_0_0_1px_#2a2233] ${bg} ${text}`}
    >
      {label}
    </span>
  )
}

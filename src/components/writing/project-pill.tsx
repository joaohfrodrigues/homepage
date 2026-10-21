import Link from 'next/link'

// A small fixed palette, assigned deterministically per project slug so the
// same project always gets the same color without needing to store one.
const PALETTE = [
  'bg-blue-500/10 text-blue-700 border-blue-500/20',
  'bg-emerald-500/10 text-emerald-700 border-emerald-500/20',
  'bg-violet-500/10 text-violet-700 border-violet-500/20',
  'bg-amber-500/10 text-amber-700 border-amber-500/20',
  'bg-rose-500/10 text-rose-700 border-rose-500/20',
  'bg-cyan-500/10 text-cyan-700 border-cyan-500/20',
]

function paletteIndex(slug: string): number {
  let hash = 0
  for (const char of slug) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return hash % PALETTE.length
}

export function ProjectPill({ slug, title }: { slug: string; title: string }) {
  return (
    <Link
      href={`/writing/projects/${slug}`}
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium leading-none hover:opacity-80 transition-opacity ${PALETTE[paletteIndex(slug)]}`}
    >
      {title}
    </Link>
  )
}

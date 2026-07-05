export function Tag({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white backdrop-blur-sm">
      {label}
    </span>
  )
}

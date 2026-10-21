'use client'

import type { HobbyFilterCategory } from '@/lib/hobby-feed'
import { tagColor } from '@/lib/tag-colors'
import { cn } from '@/lib/utils'

export function HobbyFilterBar({
  categories,
  selectedHobbies,
  gearOnly,
  onToggleHobby,
  onToggleGearOnly,
  onClear,
}: {
  categories: HobbyFilterCategory[]
  selectedHobbies: ReadonlySet<string>
  gearOnly: boolean
  onToggleHobby: (slug: string) => void
  onToggleGearOnly: () => void
  onClear: () => void
}) {
  const hasActiveFilter = selectedHobbies.size > 0 || gearOnly

  return (
    <div className="mb-8 flex flex-wrap items-center gap-2">
      {categories.map(({ slug, label }) => {
        const isSelected = selectedHobbies.has(slug)
        const { bg, text } = tagColor(label)
        return (
          <button
            key={slug}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onToggleHobby(slug)}
            className={cn(
              'font-pixel px-3 py-1 text-sm uppercase tracking-wide transition-colors',
              isSelected ? `${bg} ${text} shadow-[0_0_0_2px_#2a2233]` : 'text-[#6d6359] shadow-[0_0_0_2px_rgb(42_34_51/0.3)]'
            )}
          >
            {label}
          </button>
        )
      })}

      <button
        type="button"
        aria-pressed={gearOnly}
        onClick={onToggleGearOnly}
        className={cn(
          'font-pixel ml-2 px-3 py-1 text-sm uppercase tracking-wide transition-colors',
          gearOnly
            ? 'bg-[#2a2233] text-[#f4ecd8] shadow-[0_0_0_2px_#2a2233]'
            : 'text-[#6d6359] shadow-[0_0_0_2px_rgb(42_34_51/0.3)]'
        )}
      >
        Gear only
      </button>

      {hasActiveFilter && (
        <button
          type="button"
          onClick={onClear}
          className="ml-2 text-sm text-muted-foreground underline underline-offset-2"
        >
          Clear
        </button>
      )}
    </div>
  )
}

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
              'rounded-full border border-transparent px-3.5 py-1.5 font-lego text-sm uppercase tracking-wide transition-colors',
              isSelected ? `${bg} ${text}` : 'border-muted-foreground/30 text-muted-foreground'
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
          'ml-2 rounded-full border border-transparent px-3.5 py-1.5 font-lego text-sm uppercase tracking-wide transition-colors',
          gearOnly ? 'bg-foreground text-background' : 'border-muted-foreground/30 text-muted-foreground'
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

'use client'

import { useEffect, useRef } from 'react'
import { CHAR_H, DEFAULT_OUTFIT, OUTFIT_OPTIONS, drawCharacter, type Outfit } from '@/game/pixels'
import { cn } from '@/lib/utils'
import { PanelWindow } from './panel-window'

interface Props {
  outfit: Outfit
  onChange: (outfit: Outfit) => void
  onClose: () => void
}

const PARTS: { key: keyof Outfit; label: string }[] = [
  { key: 'cap', label: 'Cap' },
  { key: 'jacket', label: 'Jacket' },
  { key: 'hair', label: 'Hair' },
]

/** The bedroom wardrobe: recolour the visitor, previewed with the game's own sprite. */
export function WardrobePanel({ outfit, onChange, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, 48, CHAR_H)
    drawCharacter(ctx, 0, 0, 'guest', 'down', 'idle', outfit)
    drawCharacter(ctx, 16, 0, 'guest', 'side', 'idle', outfit)
    drawCharacter(ctx, 32, 0, 'guest', 'up', 'idle', outfit)
  }, [outfit])

  return (
    <PanelWindow eyebrow="Bedroom · wardrobe" title="Change outfit" width="narrow" onClose={onClose}>
      <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
        <div className="shrink-0 border-4 border-[#2a2233] bg-[#c9d6c3] p-3">
          <canvas
            ref={canvasRef}
            width={48}
            height={CHAR_H}
            className="h-[96px] w-[192px]"
            style={{ imageRendering: 'pixelated' }}
            aria-label="Preview of your outfit"
            role="img"
          />
        </div>
        <div className="flex w-full flex-col gap-4">
          {PARTS.map((part) => (
            <fieldset key={part.key}>
              <legend className="font-pixel mb-1 text-sm">{part.label}</legend>
              <div className="flex flex-wrap gap-2">
                {OUTFIT_OPTIONS[part.key].map((option) => {
                  const selected = outfit[part.key] === option.value
                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-label={`${part.label}: ${option.label}`}
                      aria-pressed={selected}
                      title={option.label}
                      onClick={() => onChange({ ...outfit, [part.key]: option.value })}
                      className={cn(
                        'h-8 w-8 border-2 border-[#2a2233] outline-none focus-visible:ring-2 focus-visible:ring-[#c9a227]',
                        selected && 'ring-2 ring-[#c9a227] ring-offset-2 ring-offset-[#f6efdf]',
                      )}
                      style={{ background: option.value }}
                    />
                  )
                })}
              </div>
            </fieldset>
          ))}
          <button type="button" className="pixel-button self-start" onClick={() => onChange(DEFAULT_OUTFIT)}>
            Back to the usual
          </button>
        </div>
      </div>
    </PanelWindow>
  )
}

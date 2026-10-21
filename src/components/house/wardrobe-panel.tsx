'use client'

import { useEffect, useRef, useState } from 'react'
import {
  CHARACTERS_URL,
  CHAR_H,
  CHAR_W,
  DEFAULT_OUTFIT,
  OPTIONAL_PARTS,
  PARTS,
  drawCharacter,
  findPiece,
  randomOutfit,
  type Outfit,
  type PartName,
} from '@/game/characters'
import type { Direction } from '@/game/layout'
import { cn } from '@/lib/utils'
import { PanelWindow } from './panel-window'

interface Props {
  outfit: Outfit
  onChange: (outfit: Outfit) => void
  onClose: () => void
}

const TABS: { part: PartName; label: string }[] = [
  { part: 'hair', label: 'Hair' },
  { part: 'outfit', label: 'Clothes' },
  { part: 'hat', label: 'Hat' },
  { part: 'face', label: 'Face' },
  { part: 'skin', label: 'Skin' },
]
const PREVIEW: Direction[] = ['down', 'right', 'up', 'left']

/** The bedroom wardrobe: dress the visitor from the game's own character pieces. */
export function WardrobePanel({ outfit, onChange, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [atlas, setAtlas] = useState<HTMLImageElement | null>(null)
  const [tab, setTab] = useState<PartName>('hair')

  useEffect(() => {
    const image = new Image()
    image.onload = () => setAtlas(image)
    image.src = CHARACTERS_URL
  }, [])

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx || !atlas) return
    ctx.clearRect(0, 0, PREVIEW.length * CHAR_W, CHAR_H)
    PREVIEW.forEach((direction, i) => drawCharacter(ctx, atlas, i * CHAR_W, 0, outfit, direction, 'idle', 0))
  }, [atlas, outfit])

  const styles = PARTS[tab]
  const current = findPiece(tab, outfit[tab])
  const optional = OPTIONAL_PARTS.includes(tab)
  const label = TABS.find((t) => t.part === tab)!.label

  /** Switching style keeps the colour slot where the new style has one. */
  const pickStyle = (style: number | null) => {
    if (style === null) return onChange({ ...outfit, [tab]: null })
    const variants = styles[style].variants
    onChange({ ...outfit, [tab]: (variants[current?.variant ?? 0] ?? variants[0]).id })
  }

  return (
    <PanelWindow eyebrow="Bedroom · Wardrobe" title="Change outfit" width="narrow" onClose={onClose}>
      <div className="flex flex-col items-center gap-5">
        <div className="border-4 border-[#2a2233] bg-[#c9d6c3] p-3">
          <canvas
            ref={canvasRef}
            width={PREVIEW.length * CHAR_W}
            height={CHAR_H}
            className="h-[128px] w-[256px]"
            style={{ imageRendering: 'pixelated' }}
            aria-label="Preview of your outfit"
            role="img"
          />
        </div>

        <div className="w-full">
          <div role="tablist" aria-label="Wardrobe" className="flex flex-wrap gap-1 border-b-2 border-[#2a2233]">
            {TABS.map((t) => (
              <button
                key={t.part}
                type="button"
                role="tab"
                aria-selected={tab === t.part}
                onClick={() => setTab(t.part)}
                className={cn(
                  'font-pixel -mb-[2px] border-2 border-transparent px-3 py-1 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#c9a227]',
                  tab === t.part && 'border-[#2a2233] border-b-[#f6efdf] bg-[#f6efdf]',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div role="tabpanel" aria-label={label} className="flex min-h-46 flex-col gap-4 pt-4">
            {(styles.length > 1 || optional) && (
              <fieldset>
                <legend className="font-pixel mb-1 text-sm">Style</legend>
                <div className="flex flex-wrap gap-2">
                  {optional && (
                    <StyleButton selected={!current} onClick={() => pickStyle(null)}>
                      None
                    </StyleButton>
                  )}
                  {styles.map((style, i) => (
                    <StyleButton key={style.label} selected={current?.style === i} onClick={() => pickStyle(i)}>
                      {style.label}
                    </StyleButton>
                  ))}
                </div>
              </fieldset>
            )}
            {current && (
              <fieldset>
                <legend className="font-pixel mb-1 text-sm">Colour</legend>
                <div className="flex flex-wrap gap-2">
                  {styles[current.style].variants.map((variant, i) => (
                    <button
                      key={variant.id}
                      type="button"
                      aria-label={`${label} colour ${i + 1}`}
                      aria-pressed={current.variant === i}
                      onClick={() => onChange({ ...outfit, [tab]: variant.id })}
                      className={cn(
                        'h-8 w-8 border-2 border-[#2a2233] outline-none focus-visible:ring-2 focus-visible:ring-[#c9a227]',
                        current.variant === i && 'ring-2 ring-[#c9a227] ring-offset-2 ring-offset-[#f6efdf]',
                      )}
                      style={{ background: variant.swatch }}
                    />
                  ))}
                </div>
              </fieldset>
            )}
          </div>
        </div>

        <div className="flex w-full flex-wrap gap-2">
          <button type="button" className="pixel-button" onClick={() => onChange(randomOutfit())}>
            Surprise me
          </button>
          <button type="button" className="pixel-button" onClick={() => onChange(DEFAULT_OUTFIT)}>
            Back to the usual
          </button>
        </div>
      </div>
    </PanelWindow>
  )
}

function StyleButton({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        'font-pixel border-2 border-[#2a2233] px-2 py-1 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#c9a227]',
        selected ? 'bg-[#2a2233] text-[#f6efdf]' : 'bg-[#f6efdf]',
      )}
    >
      {children}
    </button>
  )
}

'use client'

import { useEffect, useId, useRef, useState } from 'react'
import {
  CHARACTERS_URL,
  CHAR_H,
  CHAR_W,
  OPTIONAL_PARTS,
  PARTS,
  drawCharacter,
  findPiece,
  randomOutfit,
  type CharacterName,
  type Outfit,
  type PartName,
} from '@/game/characters'
import type { Direction } from '@/game/layout'
import { cn } from '@/lib/utils'
import { PanelWindow } from './panel-window'
import * as sfx from './sfx'
import { readStats, updateStats } from './visitor-stats'

interface Props {
  looks: Record<CharacterName, Outfit>
  /** What "Back to the usual" goes back to, for each of them. */
  usual: Record<CharacterName, Outfit>
  onChange: (who: CharacterName, look: Outfit) => void
  /** Makes the current look this browser's usual. */
  onSetUsual: (who: CharacterName) => void
  /** Dresses João for every visitor with the owner's pass; resolves with a problem, or null once saved. */
  onPublish: (pass: string) => Promise<string | null>
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
/** ↑ ↑ ↓ ↓ ← → ← → B A, which opens João's side of the wardrobe. */
const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a']

const sameLook = (a: Outfit, b: Outfit) => (Object.keys(PARTS) as PartName[]).every((part) => a[part] === b[part])

/** Listens for the Konami code while the wardrobe is open. */
function useKonamiCode(onEntered: () => void) {
  const entered = useRef(onEntered)
  useEffect(() => {
    entered.current = onEntered
  })
  useEffect(() => {
    let progress = 0
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea, [contenteditable]')) return
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key
      if (key === KONAMI[progress]) progress++
      // A third ↑ still leaves the last two as the start of the code.
      else if (!(key === 'ArrowUp' && progress === 2)) progress = key === KONAMI[0] ? 1 : 0
      if (progress === KONAMI.length) {
        progress = 0
        entered.current()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

/**
 * The bedroom wardrobe: dress the visitor from the game's own character pieces.
 * After the Konami code it dresses João too, and his owner can save that look
 * for every visitor.
 */
export function WardrobePanel({ looks, usual, onChange, onSetUsual, onPublish, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [atlas, setAtlas] = useState<HTMLImageElement | null>(null)
  const [tab, setTab] = useState<PartName>('hair')
  const [unlocked, setUnlocked] = useState(() => readStats().cheats > 0)
  const [who, setWho] = useState<CharacterName>('guest')
  const [saved, setSaved] = useState<CharacterName | null>(null)

  useKonamiCode(() => {
    sfx.powerUp()
    updateStats((stats) => stats.cheats++)
    setUnlocked(true)
    setWho('joao')
  })

  useEffect(() => {
    const image = new Image()
    image.onload = () => setAtlas(image)
    image.src = CHARACTERS_URL
  }, [])

  const outfit = looks[who]

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
  const isUsual = sameLook(outfit, usual[who])

  const change = (look: Outfit) => {
    setSaved(null)
    onChange(who, look)
  }

  /** Switching style keeps the colour slot where the new style has one. */
  const pickStyle = (style: number | null) => {
    if (style === null) return change({ ...outfit, [tab]: null })
    const variants = styles[style].variants
    change({ ...outfit, [tab]: (variants[current?.variant ?? 0] ?? variants[0]).id })
  }

  return (
    <PanelWindow
      eyebrow="Bedroom · Wardrobe"
      title={who === 'joao' ? 'Dress João' : 'Change outfit'}
      width="narrow"
      onClose={onClose}
    >
      <div className="flex flex-col items-center gap-5">
        {unlocked && (
          <div role="group" aria-label="Who to dress" className="flex gap-2">
            {(['guest', 'joao'] as const).map((name) => (
              <StyleButton
                key={name}
                selected={who === name}
                onClick={() => {
                  setWho(name)
                  setSaved(null)
                }}
              >
                {name === 'guest' ? 'You' : 'João'}
              </StyleButton>
            ))}
          </div>
        )}

        <div className="border-4 border-[#2a2233] bg-[#c9d6c3] p-3">
          <canvas
            ref={canvasRef}
            width={PREVIEW.length * CHAR_W}
            height={CHAR_H}
            className="h-[128px] w-[256px]"
            style={{ imageRendering: 'pixelated' }}
            aria-label={who === 'joao' ? 'Preview of João’s outfit' : 'Preview of your outfit'}
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
                      onClick={() => change({ ...outfit, [tab]: variant.id })}
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

        <div className="w-full">
          <div className="flex w-full flex-wrap gap-2">
            <button type="button" className="pixel-button" onClick={() => change(randomOutfit())}>
              Surprise me
            </button>
            <button type="button" className="pixel-button" onClick={() => change(usual[who])} disabled={isUsual}>
              Back to the usual
            </button>
            <button
              type="button"
              className="pixel-button"
              disabled={isUsual}
              onClick={() => {
                onSetUsual(who)
                setSaved(who)
              }}
            >
              Set as new default
            </button>
          </div>
          <p className="mt-2 text-xs text-[#6d6359]" aria-live="polite">
            {saved === who
              ? `Saved. This is ${who === 'joao' ? 'João’s' : 'your'} usual in this browser now.`
              : who === 'joao'
                ? 'João keeps this look until you leave, unless you set it as his default here.'
                : null}
          </p>
        </div>

        {who === 'joao' && <OwnerForm onPublish={onPublish} />}
      </div>
    </PanelWindow>
  )
}

/** The owner's pass, to save João's look for everyone. Nothing is sent until the button is pressed. */
function OwnerForm({ onPublish }: Pick<Props, 'onPublish'>) {
  const inputId = useId()
  const [pass, setPass] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  return (
    <details className="w-full border-t-2 border-dashed border-[#2a2233] pt-3">
      <summary className="font-pixel cursor-pointer text-sm">Are you João?</summary>
      <form
        className="mt-3"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!pass) return
          setBusy(true)
          const problem = await onPublish(pass)
          setBusy(false)
          if (problem) return setMessage({ ok: false, text: problem })
          sfx.chime()
          setPass('')
          setMessage({ ok: true, text: 'Saved. Every visitor sees João in this look now (give it a minute).' })
        }}
      >
        <label htmlFor={inputId} className="mb-2 block text-sm">
          Enter the house pass to dress João like this for every visitor.
        </label>
        <div className="flex flex-wrap gap-2">
          <input
            id={inputId}
            type="password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            autoComplete="current-password"
            placeholder="House pass"
            aria-invalid={message?.ok === false}
            className="min-w-0 flex-1 basis-40 border-2 border-[#2a2233] bg-[#fbf6ea] px-2 py-1 outline-none focus-visible:ring-2 focus-visible:ring-[#c9a227]"
          />
          <button type="submit" className="pixel-button" disabled={busy || !pass}>
            {busy ? 'Saving…' : 'Save for everyone'}
          </button>
        </div>
        <p className="mt-2 text-xs text-[#6d6359]" aria-live="polite">
          {message?.text}
        </p>
      </form>
    </details>
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

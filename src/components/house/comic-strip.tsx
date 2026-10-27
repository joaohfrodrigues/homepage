'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { CHARACTERS_URL, CHAR_W, drawCharacter, type CharacterName, type Outfit } from '@/game/characters'
import type { Direction } from '@/game/layout'

/** The close-ups that cut into a night at the fridge. */
export type ComicId = 'cheers' | 'doze' | 'wake'

interface Panel {
  /** A close-up of someone's head, in the look they wear in the house. */
  who?: { character: 'guest' | 'joao'; facing: Direction; eyesClosed?: boolean }
  bubble?: string
  /** Sound-effect lettering across the panel. */
  sfx?: string
  /** Two Super Bocks meeting in the middle. */
  bottles?: boolean
  /** Panel colour behind the halftone dots; dark for lights-out. */
  tone: string
}

const STRIPS: Record<ComicId, { label: string; panels: Panel[] }> = {
  cheers: {
    label: 'Saúde!',
    panels: [
      { who: { character: 'guest', facing: 'right' }, bubble: 'Saúde!', tone: '#f2c14e' },
      { who: { character: 'joao', facing: 'left' }, bubble: 'Saúde!', tone: '#7fc4b8' },
      { bottles: true, sfx: 'CLINK!', tone: '#e86a4f' },
    ],
  },
  doze: {
    label: 'Nodding off',
    panels: [
      { who: { character: 'guest', facing: 'down' }, bubble: 'Just… resting my eyes…', tone: '#c9a3d9' },
      { who: { character: 'guest', facing: 'down', eyesClosed: true }, sfx: 'Zzz…', tone: '#8a7fb8' },
      { sfx: '…', tone: '#141019' },
    ],
  },
  wake: {
    label: 'Waking up',
    panels: [
      { sfx: '…', tone: '#141019' },
      { who: { character: 'joao', facing: 'down' }, bubble: 'Hey. Hey! You alive?', tone: '#9ec1e0' },
      { who: { character: 'guest', facing: 'down', eyesClosed: true }, bubble: 'Ughhh…', tone: '#f2d38a' },
    ],
  },
}

/** Each panel lands this long after the last; the strip then holds before it closes itself. */
const PANEL_MS = 1100
const HOLD_MS = 2200
/** Under reduced motion every panel is there at once, held a little longer. */
const STILL_MS = 4500

/** The close-up's crop of a 16x32 character frame: from the top of a cap down to the shoulders. */
const HEAD_TOP = 7
const HEAD_H = 20

interface Props {
  id: ComicId
  looks: Record<CharacterName, Outfit>
  onDone: () => void
}

/**
 * A comic-book strip over the house: panels slam in one by one, then it closes
 * on its own. A click or any key shows the rest at once or moves on; Escape
 * skips it. Under reduced motion the panels are simply there.
 */
export function ComicStrip({ id, looks, onDone }: Props) {
  const strip = STRIPS[id]
  const [still] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [shown, setShown] = useState(still ? strip.panels.length : 1)
  const [atlas, setAtlas] = useState<HTMLImageElement | null>(null)
  const done = useRef(onDone)
  useEffect(() => {
    done.current = onDone
  })
  const all = shown >= strip.panels.length

  useEffect(() => {
    const image = new Image()
    image.onload = () => setAtlas(image)
    image.src = CHARACTERS_URL
  }, [])

  useEffect(() => {
    const timer = all
      ? setTimeout(() => done.current(), still ? STILL_MS : HOLD_MS)
      : setTimeout(() => setShown((n) => n + 1), PANEL_MS)
    return () => clearTimeout(timer)
  }, [all, shown, still])

  const advance = useCallback(() => {
    if (all) done.current()
    else setShown(strip.panels.length)
  }, [all, strip.panels.length])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.repeat) return
      e.preventDefault()
      e.stopPropagation()
      if (e.key === 'Escape') done.current()
      else advance()
    }
    // Capturing, so the house's own keys (and Escape for other layers) don't see it.
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [advance])

  return (
    <div
      role="dialog"
      aria-label={`Comic: ${strip.label}`}
      className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-[#141019]/70 px-4"
      onClick={advance}
    >
      <div className="grid w-full max-w-3xl grid-cols-3 gap-2 sm:gap-4">
        {strip.panels.map((panel, i) => (
          <ComicPanel key={i} panel={panel} index={i} visible={i < shown} still={still} atlas={atlas} looks={looks} />
        ))}
      </div>
      <p className="font-pixel text-xs text-[#a69cba] sm:text-sm">Click, tap or press a key to continue</p>
    </div>
  )
}

function ComicPanel({
  panel,
  index,
  visible,
  still,
  atlas,
  looks,
}: {
  panel: Panel
  index: number
  visible: boolean
  still: boolean
  atlas: HTMLImageElement | null
  looks: Record<CharacterName, Outfit>
}) {
  const dark = panel.tone === '#141019'
  // A slight, alternating tilt, like panels pasted onto a page.
  const tilt = [-1.5, 1, -0.5][index % 3]
  return (
    <div
      aria-hidden={!visible}
      className={`relative aspect-[4/5] overflow-hidden border-[3px] border-[#120e18] shadow-[4px_4px_0_#120e18] sm:border-4 ${
        visible ? (still ? '' : 'animate-[comic-panel-in_220ms_steps(4)]') : 'invisible'
      }`}
      style={{
        transform: `rotate(${tilt}deg)`,
        backgroundColor: panel.tone,
        // Halftone dots, as in print.
        backgroundImage: dark ? undefined : 'radial-gradient(rgb(0 0 0 / 0.16) 1.2px, transparent 1.6px)',
        backgroundSize: '7px 7px',
      }}
    >
      {panel.who && <Portrait {...panel.who} atlas={atlas} looks={looks} />}
      {panel.bottles && <Bottles />}
      {panel.bubble && (
        <div className="font-pixel absolute inset-x-1.5 top-1.5 border-2 border-[#120e18] bg-[#fffaf0] px-1.5 py-1 text-center text-[10px] leading-tight text-[#2a2233] sm:inset-x-3 sm:top-3 sm:px-2 sm:text-sm">
          {panel.bubble}
          <span
            className="absolute -bottom-[7px] left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-r-2 border-b-2 border-[#120e18] bg-[#fffaf0]"
            aria-hidden
          />
        </div>
      )}
      {panel.sfx && (
        <p
          className={`font-pixel absolute inset-x-0 text-center text-xl tracking-wide sm:text-4xl ${
            panel.who || panel.bottles ? 'bottom-2 sm:bottom-4' : 'top-1/2 -translate-y-1/2'
          } ${dark ? 'text-[#a69cba]' : 'text-[#ffe066]'}`}
          style={dark ? undefined : { textShadow: '2px 2px 0 #120e18, -1px -1px 0 #120e18, 1px -1px 0 #120e18, -1px 1px 0 #120e18' }}
        >
          {panel.sfx}
        </p>
      )}
    </div>
  )
}

/** Someone's head and shoulders from the character atlas, drawn big and blocky. */
function Portrait({
  character,
  facing,
  eyesClosed,
  atlas,
  looks,
}: NonNullable<Panel['who']> & { atlas: HTMLImageElement | null; looks: Record<CharacterName, Outfit> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const look = looks[character]

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx || !atlas) return
    ctx.clearRect(0, 0, CHAR_W, HEAD_H)
    drawCharacter(ctx, atlas, 0, -HEAD_TOP, look, facing, 'idle', 0, { eyesClosed })
  }, [atlas, look, facing, eyesClosed])

  return (
    <canvas
      ref={canvasRef}
      width={CHAR_W}
      height={HEAD_H}
      role="img"
      aria-label={character === 'guest' ? 'You' : 'João'}
      className="absolute bottom-0 left-1/2 w-[88%] -translate-x-1/2"
      style={{ imageRendering: 'pixelated' }}
    />
  )
}

/** Two pixel-art Super Bocks tipped towards each other, necks touching. */
function Bottles() {
  const bottle = (
    <svg viewBox="0 0 8 22" className="h-full w-auto" shapeRendering="crispEdges" aria-hidden>
      <rect x="3" y="0" width="2" height="1" fill="#e8c95a" />
      <rect x="3" y="1" width="2" height="5" fill="#4a2a12" />
      <rect x="2" y="6" width="4" height="2" fill="#4a2a12" />
      <rect x="1" y="8" width="6" height="14" fill="#5c3517" />
      <rect x="1" y="11" width="6" height="6" fill="#c8102e" />
      <rect x="2" y="13" width="4" height="2" fill="#e8c95a" />
      <rect x="2" y="9" width="1" height="11" fill="#8a5a30" />
    </svg>
  )
  return (
    <div className="absolute inset-x-0 top-[12%] flex h-[62%] justify-center">
      <div className="h-full origin-top translate-x-[34%] rotate-[22deg]">{bottle}</div>
      <div className="h-full origin-top -translate-x-[34%] -rotate-[22deg]">{bottle}</div>
    </div>
  )
}

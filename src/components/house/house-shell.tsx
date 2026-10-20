'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Map as MapIcon, Moon, Sun } from 'lucide-react'
import { HouseBridge, type Hint, type InteractAction, type PanelId } from '@/game/bridge'
import { getRoom, type RoomId } from '@/game/layout'
import { DEFAULT_OUTFIT, type Outfit } from '@/game/pixels'
import { getHobbyTopic } from '@/game/topics'
import type { HouseData } from '@/lib/house'
import { BicaPanel } from './bica-panel'
import { DialogueBox } from './dialogue-box'
import { buildDialogue, type DialogueChoice, type DialogueKey } from './dialogues'
import { DirectoryPanel } from './directory-panel'
import { GeoGuessPanel } from './geoguess-panel'
import { WardrobePanel } from './wardrobe-panel'

const OUTFIT_KEY = 'house:outfit'

/** The house starts at night between 8pm and 7am, visitor's local time. */
function isNightNow(): boolean {
  const hour = new Date().getHours()
  return hour >= 20 || hour < 7
}

function readOutfit(): Outfit {
  try {
    const saved = window.localStorage.getItem(OUTFIT_KEY)
    return saved ? { ...DEFAULT_OUTFIT, ...JSON.parse(saved) } : DEFAULT_OUTFIT
  } catch {
    return DEFAULT_OUTFIT
  }
}

interface Props {
  data: HouseData
  children: React.ReactNode
}

/** Which room to drop the visitor in when they land on a deep link. */
function startRoomFor(pathname: string): RoomId {
  if (pathname.startsWith('/hobbies/')) {
    const topic = getHobbyTopic(pathname.slice('/hobbies/'.length))
    if (topic) return topic.room
  }
  if (pathname.startsWith('/photography')) return 'study'
  if (pathname.startsWith('/about')) return 'living'
  return 'hall'
}

/**
 * Hosts the Phaser house and everything React draws over it: HUD, dialogue,
 * directory and the overlay pages passed in as children. Lives in the (house)
 * layout so the game keeps running while the visitor opens and closes pages.
 */
export function HouseShell({ data, children }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement>(null)
  const initialPathname = useRef(pathname)
  const [bridge] = useState(() => new HouseBridge())
  const [ready, setReady] = useState(false)
  const [hint, setHint] = useState<Hint | null>(null)
  const [room, setRoom] = useState<RoomId | null>(null)
  const [dialogue, setDialogue] = useState<DialogueKey | null>(null)
  const [panel, setPanel] = useState<PanelId | null>(null)
  const [showControls, setShowControls] = useState(true)
  // Night and outfit only matter once the game has booted client-side, so
  // reading the clock and localStorage in the initializers can't cause a
  // hydration mismatch.
  const [night, setNight] = useState(() => typeof window !== 'undefined' && isNightNow())
  const [outfit, setOutfit] = useState(() => (typeof window !== 'undefined' ? readOutfit() : DEFAULT_OUTFIT))
  const initialLook = useRef({ night, outfit })
  // Only read once the game is ready (client-side), so SSR's `false` never reaches the DOM.
  const [coarsePointer] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches,
  )

  const overlayOpen = pathname !== '/'
  const inputEnabled = !overlayOpen && dialogue === null && panel === null

  // Boot Phaser once; it survives navigation between overlay pages.
  useEffect(() => {
    let cancelled = false
    let game: { destroy: (removeCanvas: boolean) => void } | null = null
    ;(async () => {
      const fontFamily =
        getComputedStyle(document.documentElement).getPropertyValue('--font-pixel').trim() || 'monospace'
      // Phaser rasterizes text once, so the pixel font has to be loaded first.
      await document.fonts?.load(`8px ${fontFamily}`).catch(() => undefined)
      const { createHouseGame } = await import('@/game/create-game')
      if (cancelled || !containerRef.current) return
      game = createHouseGame(containerRef.current, {
        bridge,
        trips: data.trips,
        startRoom: startRoomFor(initialPathname.current),
        fontFamily,
        ...initialLook.current,
      })
    })()
    return () => {
      cancelled = true
      game?.destroy(true)
    }
  }, [bridge, data.trips])

  const handleInteract = useCallback(
    (action: InteractAction) => {
      if (action.type === 'navigate') router.push(action.href, { scroll: false })
      else if (action.type === 'dialogue') setDialogue(action.id)
      else setPanel(action.panel)
    },
    [router],
  )

  useEffect(() => {
    const offs = [
      bridge.game.on('ready', () => setReady(true)),
      bridge.game.on('hint', setHint),
      bridge.game.on('room', setRoom),
      bridge.game.on('moved', () => setShowControls(false)),
      bridge.game.on('interact', handleInteract),
    ]
    return () => offs.forEach((off) => off())
  }, [bridge, handleInteract])

  useEffect(() => {
    if (ready) bridge.ui.emit('inputEnabled', inputEnabled)
  }, [bridge, ready, inputEnabled])

  // M toggles the directory from anywhere in the house (but not over a page or game).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (overlayOpen || dialogue !== null || (panel !== null && panel !== 'directory')) return
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea, [contenteditable]')) return
      if (e.key === 'm' || e.key === 'M') {
        e.preventDefault()
        setPanel((open) => (open === 'directory' ? null : 'directory'))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [overlayOpen, dialogue, panel])

  const teleport = useCallback(
    (target: RoomId) => {
      setPanel(null)
      bridge.ui.emit('teleport', target)
    },
    [bridge],
  )

  const changeNight = useCallback(
    (on: boolean) => {
      setNight(on)
      bridge.ui.emit('night', { on, animate: true })
    },
    [bridge],
  )

  const changeOutfit = useCallback(
    (next: Outfit) => {
      setOutfit(next)
      bridge.ui.emit('outfit', next)
      try {
        window.localStorage.setItem(OUTFIT_KEY, JSON.stringify(next))
      } catch {
        // Private mode: the outfit lasts until the tab closes.
      }
    },
    [bridge],
  )

  function choose(choice: DialogueChoice) {
    switch (choice.kind) {
      case 'link':
        setDialogue(null)
        router.push(choice.href, { scroll: false })
        break
      case 'external':
        window.open(choice.href, '_blank', 'noopener,noreferrer')
        break
      case 'next':
        setDialogue(choice.id)
        break
      case 'panel':
        setDialogue(null)
        setPanel(choice.panel)
        break
      case 'night':
        setDialogue(null)
        changeNight(choice.on)
        break
      case 'close':
        setDialogue(null)
        break
    }
  }

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#141019] text-[#f4ecd8]">
      <div ref={containerRef} className="absolute inset-0 [&_canvas]:[image-rendering:pixelated]" aria-hidden />

      {!ready && (
        <div className="font-pixel absolute inset-0 flex items-center justify-center text-lg text-[#a69cba]">
          <span className="animate-pulse">Unlocking the front door…</span>
        </div>
      )}

      {ready && (
        <>
          <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-3 sm:p-4">
            <div className="font-pixel bg-[#2a2233]/90 px-3 py-1.5 shadow-[0_3px_0_#120e18]">
              <span className="flex items-center gap-1.5 text-sm leading-tight sm:text-base">
                João&rsquo;s house
                {night ? <Moon size={12} aria-label="Night" /> : <Sun size={12} aria-label="Day" />}
              </span>
              {room && <span className="block text-xs leading-tight text-[#e8c95a]">{getRoom(room).name}</span>}
            </div>
            <button
              type="button"
              className="pixel-button pointer-events-auto"
              onClick={() => setPanel('directory')}
              aria-keyshortcuts="M"
            >
              <MapIcon size={14} />
              Directory
              <kbd className="hidden text-xs text-[#a69cba] sm:inline">M</kbd>
            </button>
          </div>

          {inputEnabled && hint && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center p-4 pb-6">
              {hint.hover ? (
                <div className="font-pixel bg-[#2a2233]/90 px-3 py-1.5 text-sm shadow-[0_3px_0_#120e18]">
                  {hint.label}
                </div>
              ) : (
                <button
                  type="button"
                  className="pixel-button pointer-events-auto"
                  onClick={() => bridge.ui.emit('interactFacing')}
                >
                  <kbd className="bg-[#f4ecd8] px-1.5 text-xs text-[#2a2233]">{coarsePointer ? 'Tap' : 'E'}</kbd>
                  {hint.label}
                </button>
              )}
            </div>
          )}

          {inputEnabled && !hint && showControls && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center p-4 pb-6">
              <div className="font-pixel max-w-md bg-[#2a2233]/90 px-4 py-2 text-center text-sm shadow-[0_3px_0_#120e18]">
                {coarsePointer
                  ? 'Tap the floor to walk, tap things to look at them.'
                  : 'Walk with WASD or the arrow keys (or click the floor). E to interact, M for the directory.'}
              </div>
            </div>
          )}
        </>
      )}

      {dialogue && (
        <DialogueBox
          key={dialogue}
          dialogue={buildDialogue(dialogue, data, { night })}
          onChoose={choose}
          onClose={() => setDialogue(null)}
        />
      )}

      {panel === 'directory' && (
        <DirectoryPanel
          currentRoom={room}
          night={night}
          onTeleport={teleport}
          onContact={() => {
            teleport('hall')
            setDialogue('letterbox')
          }}
          onPanel={setPanel}
          onToggleNight={() => {
            setPanel(null)
            changeNight(!night)
          }}
          onClose={() => setPanel(null)}
        />
      )}
      {panel === 'wardrobe' && (
        <WardrobePanel outfit={outfit} onChange={changeOutfit} onClose={() => setPanel(null)} />
      )}
      {panel === 'bica' && <BicaPanel onClose={() => setPanel(null)} />}
      {panel === 'geoguess' && <GeoGuessPanel photos={data.geoPhotos} onClose={() => setPanel(null)} />}

      {children}
    </div>
  )
}

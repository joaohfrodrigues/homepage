'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { BookOpen, Gamepad2, Map as MapIcon, Moon, Pointer, Sun } from 'lucide-react'
import { HouseBridge, type Hint, type InteractAction, type PanelId } from '@/game/bridge'
import { getRoom, type RoomId } from '@/game/layout'
import { DEFAULT_OUTFIT, cleanOutfit, type Outfit } from '@/game/characters'
import { getHobbyTopic } from '@/game/topics'
import { cn } from '@/lib/utils'
import type { HouseData } from '@/lib/house'
import { BicaPanel } from './bica-panel'
import { DialogueBox } from './dialogue-box'
import { buildDialogue, type DialogueChoice, type DialogueKey } from './dialogues'
import { DirectoryPanel } from './directory-panel'
import { GeoGuessPanel } from './geoguess-panel'
import { GuestbookPanel } from './guestbook-panel'
import { HouseNavigationContext } from './house-navigation'
import { TouchControls } from './touch-controls'
import { countVisit, flushStats, updateStats } from './visitor-stats'
import { WardrobePanel } from './wardrobe-panel'
import { WelcomeCard } from './welcome-card'

const OUTFIT_KEY = 'house:outfit'
/** 'pad' when a touch visitor switched the on-screen joystick on; tapping is the default. */
const CONTROLS_KEY = 'house:controls'
/** Set once a visitor has dismissed the first-visit welcome card. */
const WELCOMED_KEY = 'house:welcomed'

/** The house starts at night between 8pm and 7am, visitor's local time. */
function isNightNow(): boolean {
  const hour = new Date().getHours()
  return hour >= 20 || hour < 7
}

function readPadPreference(): boolean {
  try {
    // Only the switch writes this key, so visitors who never touched it have nothing stored.
    return window.localStorage.getItem(CONTROLS_KEY) === 'pad'
  } catch {
    return false
  }
}

function readWelcomed(): boolean {
  try {
    return window.localStorage.getItem(WELCOMED_KEY) !== null
  } catch {
    return false
  }
}

function readOutfit(): Outfit {
  try {
    const saved = window.localStorage.getItem(OUTFIT_KEY)
    // Saves from before the Modern Interiors characters held colours; those fall back to the default.
    return saved ? cleanOutfit(JSON.parse(saved)) : DEFAULT_OUTFIT
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
  if (pathname.startsWith('/photography') || pathname.startsWith('/writing')) return 'study'
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
  // Touch screens walk by tapping unless the visitor switched the on-screen joystick on.
  const [padPreferred, setPadPreferred] = useState(() => typeof window !== 'undefined' && readPadPreference())
  const usePad = coarsePointer && padPreferred
  // A first visit to the house itself gets a hello; a deep link already knows where it's going.
  const [welcome, setWelcome] = useState(
    () => typeof window !== 'undefined' && pathname === '/' && !readWelcomed(),
  )

  const overlayOpen = pathname !== '/'
  const inputEnabled = !overlayOpen && dialogue === null && panel === null && !welcome

  // A page opening (from the directory, say) takes the place of any panel, so
  // closing the page goes straight back to the house.
  const [shownPathname, setShownPathname] = useState(pathname)
  if (pathname !== shownPathname) {
    setShownPathname(pathname)
    if (overlayOpen) {
      setPanel(null)
      setWelcome(false)
    }
  }

  // The page before this one, to tell whether closing it can just step back.
  const previousPathname = useRef<string | null>(null)
  const currentPathname = useRef(pathname)
  useEffect(() => {
    if (pathname === currentPathname.current) return
    previousPathname.current = currentPathname.current
    currentPathname.current = pathname
  }, [pathname])

  const leaveTo = useCallback(
    (href: string) => {
      if (previousPathname.current === href) router.back()
      // Replacing keeps the closed page out of history, so Back doesn't reopen it.
      else if (href === '/') router.replace('/', { scroll: false })
      else router.push(href, { scroll: false })
    },
    [router],
  )

  // Boot Phaser once; it survives navigation between overlay pages.
  useEffect(() => {
    let cancelled = false
    let game: { destroy: (removeCanvas: boolean) => void } | null = null
    ;(async () => {
      const root = getComputedStyle(document.documentElement)
      const fontFamily =
        [root.getPropertyValue('--font-pixel-digits'), root.getPropertyValue('--font-pixel'), 'monospace']
          .map((family) => family.trim())
          .filter(Boolean)
          .join(', ')
      // Phaser rasterizes text once, so the pixel font has to be loaded first,
      // digits included (their face only loads when asked for a digit).
      await document.fonts?.load(`8px ${fontFamily}`, 'A0').catch(() => undefined)
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

  // The guestbook's tallies, kept in this browser only.
  useEffect(() => {
    countVisit()
    const offs = [
      bridge.game.on('room', (id) => updateStats((stats) => (stats.rooms[id] = (stats.rooms[id] ?? 0) + 1))),
      bridge.game.on('step', () => updateStats((stats) => stats.steps++)),
      bridge.game.on('interact', (action) => {
        if (action.type !== 'dialogue') return
        if (action.id === 'joao') updateStats((stats) => stats.chats++)
        else if (action.id === 'bathroom') updateStats((stats) => stats.knocks++)
        else if (action.id === 'zeno') updateStats((stats) => stats.pets++)
        else if (action.id === 'litterbox-dirty') updateStats((stats) => stats.scoops++)
      }),
    ]
    window.addEventListener('pagehide', flushStats)
    return () => {
      offs.forEach((off) => off())
      window.removeEventListener('pagehide', flushStats)
      flushStats()
    }
  }, [bridge])

  useEffect(() => {
    if (ready) bridge.ui.emit('inputEnabled', inputEnabled)
  }, [bridge, ready, inputEnabled])

  useEffect(() => {
    if (ready) bridge.ui.emit('tapToMove', !usePad)
  }, [bridge, ready, usePad])

  const togglePad = useCallback(() => {
    // Bring the controls tip back so it says how the new mode works.
    setShowControls(true)
    setPadPreferred((on) => {
      try {
        window.localStorage.setItem(CONTROLS_KEY, on ? 'tap' : 'pad')
      } catch {
        // Private mode: the choice lasts until the tab closes.
      }
      return !on
    })
  }, [])

  // M toggles the directory and G the guestbook from anywhere in the house (but not over a page or game).
  useEffect(() => {
    const shortcuts: Record<string, PanelId> = { m: 'directory', g: 'guestbook' }
    function onKey(e: KeyboardEvent) {
      if (overlayOpen || welcome || dialogue !== null || (panel !== null && panel !== 'directory' && panel !== 'guestbook')) return
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea, [contenteditable]')) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const target = shortcuts[e.key.toLowerCase()]
      if (target) {
        e.preventDefault()
        setPanel((open) => (open === target ? null : target))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [overlayOpen, welcome, dialogue, panel])

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
      if (on) updateStats((stats) => stats.naps++)
      bridge.ui.emit('night', { on, animate: true })
    },
    [bridge],
  )

  const dismissWelcome = useCallback(() => {
    setWelcome(false)
    try {
      window.localStorage.setItem(WELCOMED_KEY, '1')
    } catch {
      // Private mode: the card comes back on the next visit.
    }
  }, [])

  const changeOutfit = useCallback(
    (next: Outfit) => {
      setOutfit(next)
      bridge.ui.emit('outfit', next)
      updateStats((stats) => stats.outfits++)
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
            <div className="font-pixel bg-[#2a2233]/90 px-3 py-1.5 whitespace-nowrap shadow-[0_3px_0_#120e18]">
              <span className="flex items-center gap-1.5 text-sm leading-tight sm:text-base">
                João&rsquo;s house
                {night ? <Moon size={12} aria-label="Night" /> : <Sun size={12} aria-label="Day" />}
              </span>
              {room && <span className="block text-xs leading-tight text-[#e8c95a]">{getRoom(room).name}</span>}
            </div>
            <div className="flex gap-2">
              {coarsePointer && (
                <button
                  type="button"
                  className={cn('pixel-button pointer-events-auto', usePad && 'text-[#e8c95a]')}
                  onClick={togglePad}
                  aria-pressed={usePad}
                  aria-label="On-screen joystick"
                  title={usePad ? 'Switch to tapping the floor to walk' : 'Switch to the on-screen joystick'}
                >
                  {usePad ? <Gamepad2 size={14} /> : <Pointer size={14} />}
                  <span aria-hidden className="hidden sm:inline">
                    {usePad ? 'Pad' : 'Tap'}
                  </span>
                </button>
              )}
              <button
                type="button"
                className="pixel-button pointer-events-auto"
                onClick={() => setPanel('guestbook')}
                aria-keyshortcuts="G"
                aria-label="Guestbook"
              >
                <BookOpen size={14} />
                <span className="hidden sm:inline">Guestbook</span>
                <kbd className="hidden text-xs text-[#a69cba] sm:inline">G</kbd>
              </button>
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
          </div>

          {inputEnabled && usePad && <TouchControls bridge={bridge} actionLabel={hint?.label ?? null} />}

          {/* With the joystick on, the A button carries the hint itself. */}
          {inputEnabled && hint && !usePad && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center p-4 pb-6">
              {hint.hover ? (
                <div className="font-pixel bg-[#2a2233]/90 px-3 py-1.5 text-sm shadow-[0_3px_0_#120e18]">{hint.label}</div>
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
            <div
              className={cn(
                'pointer-events-none absolute inset-x-0 bottom-0 flex justify-center p-4 pb-6',
                usePad && 'bottom-40',
              )}
            >
              <div className="font-pixel max-w-md bg-[#2a2233]/90 px-4 py-2 text-center text-sm shadow-[0_3px_0_#120e18]">
                {usePad
                  ? 'Drag on the left side to walk and press A to look at things, or tap them.'
                  : coarsePointer
                  ? 'Tap the floor to walk, tap things to look. The hand up top swaps in a joystick.'
                  : 'Walk with WASD or the arrow keys (or click the floor). E to interact, M for the directory, G for the guestbook.'}
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
          touch={coarsePointer}
        />
      )}

      {ready && welcome && <WelcomeCard onClose={dismissWelcome} />}

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
      {panel === 'guestbook' && <GuestbookPanel onClose={() => setPanel(null)} />}

      <HouseNavigationContext.Provider value={leaveTo}>{children}</HouseNavigationContext.Provider>
    </div>
  )
}

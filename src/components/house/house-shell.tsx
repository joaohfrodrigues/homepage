'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Map as MapIcon } from 'lucide-react'
import { HouseBridge, type Hint, type InteractAction } from '@/game/bridge'
import { getRoom, type RoomId } from '@/game/layout'
import type { HouseData } from '@/lib/house'
import { DialogueBox } from './dialogue-box'
import { buildDialogue, type DialogueChoice, type DialogueKey } from './dialogues'
import { DirectoryPanel } from './directory-panel'

interface Props {
  data: HouseData
  children: React.ReactNode
}

/** Which room to drop the visitor in when they land on a deep link. */
function startRoomFor(pathname: string): RoomId {
  if (pathname.startsWith('/photography')) return 'study'
  if (pathname.startsWith('/about')) return 'living'
  return 'entry'
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
  const [directoryOpen, setDirectoryOpen] = useState(false)
  const [showControls, setShowControls] = useState(true)
  // Only read once the game is ready (client-side), so SSR's `false` never reaches the DOM.
  const [coarsePointer] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches,
  )

  const overlayOpen = pathname !== '/'
  const inputEnabled = !overlayOpen && dialogue === null && !directoryOpen

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
      else setDirectoryOpen(true)
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

  // M toggles the directory from anywhere in the house (but not over a page).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (overlayOpen || dialogue !== null) return
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea, [contenteditable]')) return
      if (e.key === 'm' || e.key === 'M') {
        e.preventDefault()
        setDirectoryOpen((open) => !open)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [overlayOpen, dialogue])

  const teleport = useCallback(
    (target: RoomId) => {
      setDirectoryOpen(false)
      bridge.ui.emit('teleport', target)
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
      case 'directory':
        setDialogue(null)
        setDirectoryOpen(true)
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
              <span className="block text-sm leading-tight sm:text-base">João&rsquo;s house</span>
              {room && <span className="block text-xs leading-tight text-[#e8c95a]">{getRoom(room).name}</span>}
            </div>
            <button
              type="button"
              className="pixel-button pointer-events-auto"
              onClick={() => setDirectoryOpen(true)}
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
          dialogue={buildDialogue(dialogue, data)}
          onChoose={choose}
          onClose={() => setDialogue(null)}
        />
      )}

      {directoryOpen && (
        <DirectoryPanel
          currentRoom={room}
          onTeleport={teleport}
          onContact={() => {
            teleport('entry')
            setDialogue('letterbox')
          }}
          onClose={() => setDirectoryOpen(false)}
        />
      )}

      {children}
    </div>
  )
}

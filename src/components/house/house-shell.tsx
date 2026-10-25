'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BookOpen, Cloud, CloudLightning, CloudRain, Map as MapIcon, Moon, Music, Sun, Volume2, VolumeX } from 'lucide-react'
import { HouseBridge, type Hint, type InteractAction, type PanelId, type VisitTarget } from '@/game/bridge'
import { getRoom, type RoomId, type UnlockId } from '@/game/layout'
import { completeStep, missionEvent, unlocksOf } from '@/game/missions'
import { DEFAULT_OUTFIT, cleanOutfit, type Outfit } from '@/game/characters'
import { currentSeason } from '@/game/seasons'
import { getHobbyTopic } from '@/game/topics'
import type { HouseData } from '@/lib/house'
import { isNight, nextSun, offsetToLisbonTime, skyAt, type Sky } from '@/lib/sun'
import { isWeather, type Weather } from '@/lib/weather'
import { setSoundOn, useSound } from './audio'
import { BicaPanel } from './bica-panel'
import { ComicStrip, type ComicId } from './comic-strip'
import { DialogueBox } from './dialogue-box'
import { buildDialogue, type Binge, type DialogueChoice, type DialogueKey } from './dialogues'
import { DirectoryPanel } from './directory-panel'
import { GeoGuessPanel } from './geoguess-panel'
import { GuestbookPanel } from './guestbook-panel'
import { HouseNavigationContext, openPage, useHistoryLayer } from './house-navigation'
import { ScoresPanel } from './scores-panel'
import {
  BEER_DIZZY,
  BEER_TIPSY,
  BUZZING_AT,
  CAFFEINE_OVERDOSE,
  DIZZY_AT,
  DOZE_AT,
  HANGOVER,
  HANGOVER_TREATED_MS,
  OVERDOSE_AT,
  TIPSY_AT,
  beer,
  caffeine,
  hangover,
} from './intoxication'
import {
  buildMissionDialogue,
  isMissionDialogue,
  missionReplyKey,
  withMissionChoices,
  type MissionDialogueKey,
} from './mission-dialogues'
import { stop as stopRecord } from './record-player'
import { RecordPlayerPanel, useRecordPlayer } from './record-player-panel'
import * as sfx from './sfx'
import { StickerToast } from './sticker-toast'
import { TouchControls } from './touch-controls'
import { countVisit, flushStats, onStickerEarned, readStats, updateStats, type BicaResult } from './visitor-stats'
import { WardrobePanel } from './wardrobe-panel'
import { WelcomeCard } from './welcome-card'

const OUTFIT_KEY = 'house:outfit'
/** Set once a visitor has dismissed the first-visit welcome card. */
const WELCOMED_KEY = 'house:welcomed'

/** How often the house checks where Lisbon's sun has got to. */
const SKY_TICK_MS = 60_000
/** A nap until evening wakes you once dusk is over; a night's sleep, in daylight. */
const AFTER_SUNSET_MS = 45 * 60_000
const AFTER_SUNRISE_MS = 60 * 60_000

/** `?time=21:15` previews that time of day in Lisbon; the clock runs on from there. */
function readTimePreview(): number {
  const preview = new URLSearchParams(window.location.search).get('time')
  return (preview && offsetToLisbonTime(preview, new Date())) || 0
}

/** `?weather=rain` (or clear, cloudy, storm) previews a sky without waiting for one. */
function readWeatherPreview(): Weather | null {
  const preview = new URLSearchParams(window.location.search).get('weather')
  return isWeather(preview) ? preview : null
}

const WEATHER_ICONS = {
  cloudy: { Icon: Cloud, label: 'Cloudy in Lisbon' },
  rain: { Icon: CloudRain, label: 'Raining in Lisbon' },
  storm: { Icon: CloudLightning, label: 'Storm over Lisbon' },
} as const

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

/** What missions have opened, in a stable order so unchanged sets compare equal. */
function readUnlocks(): UnlockId[] {
  return [...unlocksOf(readStats())].sort()
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
  const [dialogue, setDialogue] = useState<DialogueKey | MissionDialogueKey | null>(null)
  const [comic, setComic] = useState<ComicId | null>(null)
  const [panel, setPanel] = useState<PanelId | null>(null)
  // Between a directory pick and the guest reaching its item, which then opens a page or panel.
  const [visiting, setVisiting] = useState(false)
  const [showControls, setShowControls] = useState(true)
  // The sky and outfit only matter once the game has booted client-side, so
  // reading the clock and localStorage in the initializers can't cause a
  // hydration mismatch. The house keeps Lisbon's time, moved on by any naps.
  const [startOffset] = useState(() => (typeof window !== 'undefined' ? readTimePreview() : 0))
  const clockOffset = useRef(startOffset)
  const lisbonNow = useCallback(() => new Date(Date.now() + clockOffset.current), [])
  const [sky, setSky] = useState<Sky>(() =>
    typeof window !== 'undefined' ? skyAt(new Date(Date.now() + startOffset)) : { night: 0, warmth: 0, moon: 0 },
  )
  const night = isNight(sky)
  // A nap fades to black on its way to the new light; the clock's own ticks ease in.
  const fadeToSky = useRef(false)
  const [outfit, setOutfit] = useState(() => (typeof window !== 'undefined' ? readOutfit() : DEFAULT_OUTFIT))
  const [unlocks, setUnlocks] = useState<UnlockId[]>(() => (typeof window !== 'undefined' ? readUnlocks() : []))
  // The holidays go by the visitor's calendar, not Lisbon's; `?season=` previews one.
  const [season] = useState(() => (typeof window !== 'undefined' ? currentSeason(window.location.search) : null))
  const initialLook = useRef({ sky, outfit, unlocks, season })
  const [weatherPreview] = useState(() => (typeof window !== 'undefined' ? readWeatherPreview() : null))
  const [weather, setWeather] = useState<Weather>(weatherPreview ?? 'clear')
  // Only read once the game is ready (client-side), so SSR's `false` never reaches the DOM.
  const [coarsePointer] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches,
  )
  // A first visit to the house itself gets a hello; a deep link already knows where it's going.
  const [welcome, setWelcome] = useState(
    () => typeof window !== 'undefined' && pathname === '/' && !readWelcomed(),
  )
  const record = useRecordPlayer()
  const { on: soundOn } = useSound()

  const overlayOpen = pathname !== '/'
  const inputEnabled = !overlayOpen && dialogue === null && comic === null && panel === null && !welcome

  // A page opening (from the directory, say) takes the place of any panel, so
  // closing the page goes straight back to the house.
  const [shownPathname, setShownPathname] = useState(pathname)
  if (pathname !== shownPathname) {
    setShownPathname(pathname)
    if (overlayOpen) {
      setPanel(null)
      setDialogue(null)
      setWelcome(false)
    }
  }

  // What to open once the guest reaches the item the directory sent them to.
  const pendingVisit = useRef<{ target: VisitTarget; then: () => void } | null>(null)

  // Back closes the panel or dialogue instead of leaving the house. The
  // welcome card has no entry of its own: it is the page the visitor landed
  // on, so Back from it leaves like Back from any first page.
  useHistoryLayer(dialogue !== null || panel !== null || visiting, () => {
    setPanel(null)
    setDialogue(null)
    setVisiting(false)
    pendingVisit.current = null
  })

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
      stopRecord()
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

  // Sound effects; each is silent until the visitor has clicked or pressed a key.
  useEffect(() => {
    const offs = [
      bridge.game.on('step', sfx.step),
      bridge.game.on('heartbeat', sfx.heartbeat),
      bridge.game.on('gull', sfx.gull),
      bridge.game.on('interact', (action) => {
        if (action.type === 'panel' && action.panel === 'leaderboards') sfx.rustle()
        else if (action.type !== 'dialogue') sfx.pop()
        else if (action.id === 'zeno') sfx.meow()
        else if (action.id === 'bathroom') sfx.doorRattle()
        else if (action.id === 'cabinet') sfx.cabinet()
        else sfx.blip()
      }),
      onStickerEarned(sfx.chime),
    ]
    return () => offs.forEach((off) => off())
  }, [bridge])

  // The guestbook's tallies, kept in this browser only.
  useEffect(() => {
    countVisit()
    const offs = [
      bridge.game.on('room', (id) => updateStats((stats) => (stats.rooms[id] = (stats.rooms[id] ?? 0) + 1))),
      bridge.game.on('step', () => updateStats((stats) => stats.steps++)),
      bridge.game.on('interact', (action) => {
        if (action.type !== 'dialogue') return
        if (action.id === 'joao') updateStats((stats) => stats.chats++)
        else if (action.id === 'bathroom') updateStats((stats) => stats.doorTries++)
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

  // Lisbon's real sky, unless a preview asked for another; clear if it can't be had.
  useEffect(() => {
    if (weatherPreview) return
    let cancelled = false
    fetch('/api/weather')
      .then((response) => (response.ok ? response.json() : null))
      .then((body: { weather?: unknown } | null) => {
        if (!cancelled && isWeather(body?.weather)) setWeather(body.weather)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [weatherPreview])

  useEffect(() => {
    if (ready) bridge.ui.emit('weather', weather)
  }, [bridge, ready, weather])

  // Follow Lisbon's sun as the visit goes on.
  useEffect(() => {
    const tick = window.setInterval(() => setSky(skyAt(lisbonNow())), SKY_TICK_MS)
    return () => window.clearInterval(tick)
  }, [lisbonNow])

  useEffect(() => {
    if (!ready) return
    bridge.ui.emit('sky', { ...sky, animate: fadeToSky.current })
    fadeToSky.current = false
  }, [bridge, ready, sky])

  /** Moves the house's clock on to `then`, as a nap does. */
  const skipTo = useCallback(
    (then: Date) => {
      clockOffset.current += then.getTime() - lisbonNow().getTime()
      setSky(skyAt(then))
    },
    [lisbonNow],
  )

  // Missions open parts of the house (and a guestbook reset shuts them again).
  useEffect(() => {
    if (ready) bridge.ui.emit('unlocks', unlocks)
  }, [bridge, ready, unlocks])

  /** Picks up anything a mission step just opened, or a reset just shut. */
  const syncUnlocks = useCallback(() => {
    const next = readUnlocks()
    setUnlocks((current) => (current.join() === next.join() ? current : next))
  }, [])

  /** Closing a dialogue opens whatever a mission choice in it unlocked, so it happens in view (the door swinging open). */
  const closeDialogue = useCallback(() => {
    setDialogue(null)
    syncUnlocks()
  }, [syncUnlocks])

  /** A perfect bica can be a mission step; what that step says shows under the cup. */
  const bicaResult = useCallback(
    (result: BicaResult) => {
      if (result !== 'perfect') return undefined
      let note: string | undefined
      updateStats((stats) => (note = missionEvent(stats, 'perfect-bica').find((step) => step.feedback)?.feedback))
      syncUnlocks()
      return note
    },
    [syncUnlocks],
  )

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

  useEffect(
    () =>
      bridge.game.on('arrived', (target) => {
        const pending = pendingVisit.current
        if (pending?.target !== target) return
        pendingVisit.current = null
        setVisiting(false)
        pending.then()
      }),
    [bridge],
  )

  const visit = useCallback(
    (target: VisitTarget, then: () => void) => {
      setPanel(null)
      setVisiting(true)
      pendingVisit.current = { target, then }
      bridge.ui.emit('visit', target)
    },
    [bridge],
  )

  const changeNight = useCallback(
    (on: boolean) => {
      // Sleep through to after dusk, or to the next morning.
      const now = lisbonNow()
      fadeToSky.current = true
      skipTo(
        on
          ? new Date(nextSun('sunset', now).getTime() + AFTER_SUNSET_MS)
          : new Date(nextSun('sunrise', now).getTime() + AFTER_SUNRISE_MS),
      )
      sfx.lightSwitch()
      if (on) updateStats((stats) => stats.naps++)
      // A nap sleeps off the coffee, the beers and the hangover.
      caffeine.clear()
      beer.clear()
      hangover.clear()
      bridge.ui.emit('effect', { source: 'caffeine', effect: null })
      bridge.ui.emit('effect', { source: 'beer', effect: null })
      bridge.ui.emit('effect', { source: 'hangover', effect: null })
    },
    [bridge, lisbonNow, skipTo],
  )

  // Ten bicas in five minutes: the guest starts vibrating, and João notices.
  const pulledBica = useCallback(
    (lately: number) => {
      if (lately < OVERDOSE_AT) return
      bridge.ui.emit('effect', { source: 'caffeine', effect: CAFFEINE_OVERDOSE })
      if (lately > OVERDOSE_AT) return
      updateStats((stats) => stats.overdoses++)
      setPanel(null)
      setDialogue('caffeine-overdose')
    },
    [bridge],
  )

  // The night that ended on the sofa, kept for João to recount when the guest wakes.
  const [binge, setBinge] = useState<Binge | null>(null)

  // Tipsy at three beers, dizzy at five; at seven the guest dozes off and wakes on the sofa.
  const drinkBeer = useCallback(() => {
    updateStats((stats) => stats.beers++)
    const lately = beer.add()
    sfx.beer(lately >= DIZZY_AT)
    if (lately >= DOZE_AT) {
      setDialogue(null)
      updateStats((stats) => stats.dozes++)
      setBinge({
        beers: lately,
        minutes: Math.max(1, Math.round(beer.span() / 60_000)),
        bicas: caffeine.count(),
      })
      // Sleeping it off clears everything, and it's morning when they wake.
      beer.clear()
      caffeine.clear()
      setComic('doze')
      return
    }
    if (lately >= TIPSY_AT) {
      bridge.ui.emit('effect', { source: 'beer', effect: lately >= DIZZY_AT ? BEER_DIZZY : BEER_TIPSY })
    }
    // The first round that goes to your head gets a close-up of the toast.
    setDialogue(lately === TIPSY_AT ? null : 'beer')
    if (lately === TIPSY_AT) setComic('cheers')
  }, [bridge])

  // Each close-up has its sound: the toast, the snoring, the birds next morning.
  useEffect(() => {
    if (comic === 'cheers') sfx.clink()
    else if (comic === 'doze') sfx.snore()
    else if (comic === 'wake') sfx.birdsong()
  }, [comic])

  // The scene brings the morning in behind the fade; the day/night toggle follows only then.
  useEffect(
    () =>
      bridge.game.on('dozed', () => {
        skipTo(new Date(nextSun('sunrise', lisbonNow()).getTime() + AFTER_SUNRISE_MS))
        setComic('wake')
      }),
    [bridge, lisbonNow, skipTo],
  )

  // What follows each close-up: the fade to the sofa after nodding off, João's chat after waking.
  const finishComic = useCallback(() => {
    setComic(null)
    if (comic === 'doze') {
      bridge.ui.emit('effect', { source: 'beer', effect: null })
      bridge.ui.emit('effect', { source: 'caffeine', effect: null })
      bridge.ui.emit('doze')
    } else if (comic === 'wake') {
      bridge.ui.emit('effect', { source: 'hangover', effect: HANGOVER })
      hangover.start()
      setDialogue('sofa-wake')
    }
  }, [bridge, comic])

  // The paracetamol from the bathroom cabinet: the hangover lifts after a little while.
  const takeParacetamol = useCallback(() => {
    updateStats((stats) => stats.paracetamols++)
    sfx.paracetamol()
    hangover.clear()
    bridge.ui.emit('effect', { source: 'hangover', effect: { ...HANGOVER, ms: HANGOVER_TREATED_MS } })
    setDialogue('paracetamol')
  }, [bridge])

  // Built when it opens, so a count running out mid-chat doesn't change the lines.
  const shownDialogue = useMemo(
    () =>
      dialogue &&
      (isMissionDialogue(dialogue)
        ? buildMissionDialogue(dialogue, readStats())
        : withMissionChoices(
            buildDialogue(dialogue, data, {
              night,
              weather,
              buzzing: caffeine.count() >= BUZZING_AT,
              beers: beer.count(),
              binge,
              hungover: hangover.active(),
              stats: readStats(),
              season,
            }),
            dialogue,
            readStats(),
          )),
    [dialogue, data, night, weather, binge, season],
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
        openPage(router, choice.href)
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
      case 'beer':
        drinkBeer()
        break
      case 'paracetamol':
        takeParacetamol()
        break
      case 'close':
        closeDialogue()
        break
      case 'mission': {
        const step = choice.step
        if (step === undefined) {
          setDialogue(`mission-hint:${choice.mission}` as const)
          break
        }
        // What the step opens waits for its reply to close (see closeDialogue).
        let done = false
        updateStats((stats) => (done = completeStep(stats, choice.mission, step)))
        // The shoulder that frees the stuck bathroom door.
        if (done && choice.mission === 'bathroom' && step === 'shove') sfx.doorBurst()
        setDialogue(missionReplyKey(choice.mission, step))
        break
      }
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
                {weather !== 'clear' && <WeatherIcon weather={weather} />}
              </span>
              {room && <span className="block text-xs leading-tight text-[#e8c95a]">{getRoom(room).name}</span>}
            </div>
            <div className="flex gap-2">
              {record.playing && (
                <button type="button" className="pixel-button pointer-events-auto" onClick={stopRecord} aria-label="Stop the music">
                  <Music size={14} />
                  <span className="hidden sm:inline">Stop music</span>
                </button>
              )}
              <button
                type="button"
                className="pixel-button pointer-events-auto"
                onClick={() => setSoundOn(!soundOn)}
                aria-pressed={!soundOn}
                aria-label={soundOn ? 'Mute sounds' : 'Unmute sounds'}
                title={soundOn ? 'Mute sounds' : 'Unmute sounds'}
              >
                {soundOn ? <Volume2 size={14} /> : <VolumeX size={14} />}
              </button>
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

          {inputEnabled && coarsePointer && <TouchControls bridge={bridge} />}

          {inputEnabled && hint && (
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
            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center p-4 pb-6">
              <div className="font-pixel max-w-md bg-[#2a2233]/90 px-4 py-2 text-center text-sm shadow-[0_3px_0_#120e18]">
                {coarsePointer
                  ? 'Drag anywhere to walk, or tap the floor. Tap a thing to walk up to it, then tap it again to use it.'
                  : 'Walk with WASD or the arrow keys (or click the floor). E to interact, M for the directory, G for the guestbook.'}
              </div>
            </div>
          )}
        </>
      )}

      {dialogue && shownDialogue && (
        <DialogueBox
          key={dialogue}
          dialogue={shownDialogue}
          onChoose={choose}
          onClose={closeDialogue}
          touch={coarsePointer}
        />
      )}

      {ready && welcome && <WelcomeCard onClose={dismissWelcome} />}

      {panel === 'directory' && (
        <DirectoryPanel
          currentRoom={room}
          night={night}
          unlocks={unlocks}
          onTeleport={teleport}
          onVisit={visit}
          onContact={() => setDialogue('letterbox')}
          onPanel={setPanel}
          onToggleNight={() => changeNight(!night)}
          onClose={() => setPanel(null)}
        />
      )}
      {panel === 'wardrobe' && (
        <WardrobePanel outfit={outfit} onChange={changeOutfit} onClose={() => setPanel(null)} />
      )}
      {panel === 'bica' && (
        <BicaPanel onResult={bicaResult} onPull={pulledBica} onClose={() => setPanel(null)} />
      )}
      {panel === 'geoguess' && <GeoGuessPanel photos={data.geoPhotos} onClose={() => setPanel(null)} />}
      {panel === 'guestbook' && <GuestbookPanel onReset={syncUnlocks} onClose={() => setPanel(null)} />}
      {panel === 'leaderboards' && <ScoresPanel onClose={() => setPanel(null)} />}
      {panel === 'recordplayer' && <RecordPlayerPanel onClose={() => setPanel(null)} />}

      {/* Not behind `ready`: it has to be listening before the visit below is counted. */}
      {comic && <ComicStrip key={comic} id={comic} outfit={outfit} onDone={finishComic} />}
      <StickerToast onOpen={() => setPanel('guestbook')} />

      <HouseNavigationContext.Provider value={leaveTo}>{children}</HouseNavigationContext.Provider>
    </div>
  )
}

function WeatherIcon({ weather }: { weather: Exclude<Weather, 'clear'> }) {
  const { Icon, label } = WEATHER_ICONS[weather]
  return <Icon size={12} aria-label={label} />
}

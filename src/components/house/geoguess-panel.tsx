'use client'

import Link from 'next/link'
import { useCallback, useState } from 'react'
import { distanceKm, fitView, isInView, projectToMap, unprojectFromMap, type LatLon } from '@/game/map-projection'
import type { GeoPhoto } from '@/lib/photos'
import { PanelWindow } from './panel-window'
import { PinIcon } from './travel-map'
import { readStats, updateStats } from './visitor-stats'
import { MAP_ASPECT, WorldMap, mapPosition, useMapView } from './world-map'

interface Props {
  photos: GeoPhoto[]
  onClose: () => void
}

const ROUNDS = 5

function pickRound(photos: GeoPhoto[]): GeoPhoto[] {
  const pool = [...photos]
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  // Prefer one photo per trip so a round isn't five shots of the same street.
  const seen = new Set<string>()
  const varied = pool.filter((photo) => !seen.has(photo.tripSlug) && seen.add(photo.tripSlug))
  return [...varied, ...pool.filter((photo) => !varied.includes(photo))].slice(0, ROUNDS)
}

/** 1000 for a direct hit, fading out over a few hundred km. */
function score(km: number): number {
  return Math.round(1000 * Math.exp(-km / 400))
}

/**
 * The fridge magnets: a photo from one of the trips, and the visitor drops a
 * pin on the map where they think it was taken. Five rounds, scored by distance.
 */
export function GeoGuessPanel({ photos, onClose }: Props) {
  const [round, setRound] = useState(() => pickRound(photos))
  const [index, setIndex] = useState(0)
  const [guess, setGuess] = useState<LatLon | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [scores, setScores] = useState<number[]>([])
  // Only ever rendered client-side (it opens from the game), so localStorage is safe here.
  const [best, setBest] = useState(() => readStats().geoBest)
  const { view, setView, fitted } = useMapView(photos)

  const finished = scores.length === ROUNDS && revealed && index === ROUNDS - 1
  const photo = round[index]
  const total = scores.reduce((sum, s) => sum + s, 0)
  const actual = photo ? projectToMap(photo.lat, photo.lon, view) : null
  const guessAt = guess ? projectToMap(guess.lat, guess.lon, view) : null
  const km = photo && guess ? distanceKm(guess, photo) : null

  const confirm = useCallback(() => {
    if (!guess || revealed || km === null) return
    const points = score(km)
    const nextScores = [...scores, points]
    setScores(nextScores)
    setRevealed(true)
    // Pull back far enough to show both the guess and the answer.
    if (!isInView(guess.lat, guess.lon, view) || !isInView(photo.lat, photo.lon, view)) {
      setView(fitView([guess, photo], MAP_ASPECT))
    }
    const sum = nextScores.length === ROUNDS ? nextScores.reduce((a, b) => a + b, 0) : null
    if (sum !== null && sum > best) setBest(sum)
    updateStats((stats) => {
      stats.geoGuesses++
      stats.geoTotalKm += km
      stats.geoClosestKm = Math.min(stats.geoClosestKm ?? Infinity, km)
      stats.geoWorstKm = Math.max(stats.geoWorstKm ?? 0, km)
      if (sum !== null) {
        stats.geoRounds++
        stats.geoBest = Math.max(stats.geoBest, sum)
      }
    })
  }, [guess, revealed, km, scores, best, view, setView, photo])

  function next() {
    setGuess(null)
    setRevealed(false)
    setIndex((i) => i + 1)
  }

  function restart() {
    setRound(pickRound(photos))
    setIndex(0)
    setScores([])
    setGuess(null)
    setRevealed(false)
  }

  function placePin(x: number, y: number) {
    if (revealed) return
    setGuess(unprojectFromMap(x, y, view))
  }

  // Keyboard play: arrows nudge the pin (starting from the middle), Enter confirms.
  function onMapKey(e: React.KeyboardEvent) {
    const step = 0.015
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      confirm()
      return
    }
    const move = moves[e.key]
    if (!move || revealed) return
    e.preventDefault()
    const from = guessAt ?? { x: 0.5, y: 0.5 }
    setGuess(unprojectFromMap(Math.min(1, Math.max(0, from.x + move[0])), Math.min(1, Math.max(0, from.y + move[1])), view))
  }

  if (photos.length === 0) {
    return (
      <PanelWindow eyebrow="Kitchen · Fridge magnets" title="Where was this taken?" onClose={onClose}>
        <p>No geotagged photos yet — check back after the next trip.</p>
      </PanelWindow>
    )
  }

  return (
    <PanelWindow eyebrow="Kitchen · Fridge magnets" title="Where was this taken?" onClose={onClose}>
      <div className="font-pixel mb-3 flex justify-between text-sm text-[#6d6359]">
        <span>
          Photo {index + 1} of {ROUNDS}
        </span>
        <span>
          Score {total} · Best {best}
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={photo.id}
          src={photo.url}
          alt={photo.alt}
          className="aspect-[4/3] w-full border-4 border-[#2a2233] bg-[#2a2233] object-cover"
        />
        <div>
          <WorldMap
            view={view}
            fitted={fitted}
            onViewChange={setView}
            onMapClick={placePin}
            role="application"
            tabIndex={0}
            aria-label="World map. Click, or use the arrow keys, to place your guess; Enter to confirm; + and - to zoom."
            onKeyDown={onMapKey}
            className="cursor-crosshair outline-none focus-visible:ring-2 focus-visible:ring-[#c9a227]"
          >
            {revealed && guessAt && actual && (
              <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
                <line
                  x1={guessAt.x * 100}
                  y1={guessAt.y * 100}
                  x2={actual.x * 100}
                  y2={actual.y * 100}
                  stroke="#2a2233"
                  strokeWidth={2}
                  strokeDasharray="4 3"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
            )}
            {guessAt && (
              <span
                className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 border-2 border-[#2a2233] bg-[#f4ecd8]"
                style={mapPosition(guessAt)}
                aria-hidden
              />
            )}
            {revealed && actual && (
              <span
                className="pointer-events-none absolute -translate-x-1/2 -translate-y-full"
                style={mapPosition(actual)}
                aria-hidden
              >
                <PinIcon />
              </span>
            )}
          </WorldMap>
          <p className="mt-2 text-xs text-[#6d6359]">Click the map (or use the arrow keys) to drop your guess. Drag to pan; pinch or Ctrl/⌘-scroll to zoom.</p>
        </div>
      </div>

      <div className="mt-4 flex min-h-[3rem] flex-wrap items-center justify-between gap-3" aria-live="polite">
        {revealed && km !== null ? (
          <p className="text-sm">
            <span className="font-pixel">
              {photo.place || photo.tripTitle} — {Math.round(km)} km off, +{scores[index]} points.
            </span>{' '}
            <Link href={`/photography/${photo.tripSlug}`} scroll={false} onClick={onClose} className="text-[#8e2a20] underline underline-offset-4">
              See the {photo.tripTitle} trip →
            </Link>
          </p>
        ) : (
          <p className="text-sm text-[#6d6359]">{guess ? 'Happy with that?' : 'Where do you reckon?'}</p>
        )}
        {finished ? (
          <button type="button" className="pixel-button" onClick={restart}>
            {total} / {ROUNDS * 1000} — play again
          </button>
        ) : revealed ? (
          <button type="button" className="pixel-button" onClick={next}>
            Next photo →
          </button>
        ) : (
          <button type="button" className="pixel-button" onClick={confirm} disabled={!guess}>
            Guess
          </button>
        )}
      </div>
    </PanelWindow>
  )
}

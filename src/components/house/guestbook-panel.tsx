'use client'

import { useState } from 'react'
import { getRoom, type RoomId } from '@/game/layout'
import { cn } from '@/lib/utils'
import { PanelWindow } from './panel-window'
import {
  ACHIEVEMENTS,
  metresWalked,
  readStats,
  resetStats,
  totalBicas,
  type BicaResult,
  type VisitorStats,
} from './visitor-stats'

interface Props {
  onClose: () => void
}

/** Same colours as the zones on the coffee machine's pressure gauge. */
const BICA_ROWS: { result: BicaResult; label: string; color: string }[] = [
  { result: 'perfect', label: 'Perfect', color: '#c9a227' },
  { result: 'good', label: 'Decent', color: '#d8b45a' },
  { result: 'under', label: 'Watery', color: '#9fc3d6' },
  { result: 'over', label: 'Bitter', color: '#8e2f35' },
]

/** The hall and corridor are left out: every walk between rooms passes through them. */
const STAT_ROOMS: RoomId[] = ['living', 'kitchen', 'study', 'bedroom']

/** Grams of ground coffee in a single bica. */
const GRAMS_PER_BICA = 7

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

function formatKm(km: number): string {
  return Math.round(km).toLocaleString('en-GB')
}

/** Metres under a kilometre, then kilometres to one decimal. */
function distance(metres: number): { value: string; unit: string } {
  return metres < 1000 ? { value: String(metres), unit: 'm' } : { value: (metres / 1000).toFixed(1), unit: 'km' }
}

/** Numbers always use the pixel font, including inside running text. */
function Num({ children }: { children: React.ReactNode }) {
  return <span className="font-pixel">{children}</span>
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-4 border-[#2a2233] bg-[#fbf6ea] p-4" aria-label={title}>
      <h3 className="font-pixel mb-3 text-xs uppercase tracking-widest text-[#8e2a20]">{title}</h3>
      {children}
    </section>
  )
}

/**
 * A headline figure: digits large in the pixel font, any unit smaller beside
 * them so it doesn't crowd the number. Words (a room name) get a smaller size.
 */
function Stat({ value, unit, label, word }: { value: React.ReactNode; unit?: string; label: string; word?: boolean }) {
  return (
    <div>
      <p className={cn('font-pixel leading-none', word ? 'text-lg' : 'text-2xl')}>
        {value}
        {unit && <span className="ml-1 text-sm text-[#6d6359]">{unit}</span>}
      </p>
      <p className="mt-1 text-xs text-[#6d6359]">{label}</p>
    </div>
  )
}

/** Horizontal bars, each labelled with its count, so the colour never has to carry the meaning. */
function Bars({ rows }: { rows: { label: string; value: number; color: string }[] }) {
  const max = Math.max(1, ...rows.map((row) => row.value))
  return (
    <ul className="space-y-1.5 text-sm">
      {rows.map((row) => (
        <li key={row.label} className="grid grid-cols-[6.5rem_1fr_2.5rem] items-center gap-2" title={`${row.label}: ${row.value}`}>
          <span className="truncate">{row.label}</span>
          <span className="h-3">
            {row.value > 0 && (
              <span
                className="block h-full border-2 border-[#2a2233]"
                style={{ width: `${(row.value / max) * 100}%`, background: row.color }}
              />
            )}
          </span>
          <span className="font-pixel text-right text-sm">{row.value}</span>
        </li>
      ))}
    </ul>
  )
}

function Intro({ stats }: { stats: VisitorStats }) {
  const since = stats.firstVisit ? (
    <>
      you first signed in on <Num>{formatDate(stats.firstVisit)}</Num>
    </>
  ) : (
    'you just signed in'
  )
  return stats.visits > 1 ? (
    <>
      {since}, and this is visit number <Num>{stats.visits}</Num>.
    </>
  ) : (
    <>{since}. Welcome — this is your first visit.</>
  )
}

/**
 * The hall guestbook: the visitor's own stats and best scores, plus a page of
 * stickers to collect. Everything comes from this browser's localStorage.
 */
export function GuestbookPanel({ onClose }: Props) {
  // A snapshot: walking keeps changing the live stats, but nobody walks with this open.
  const [stats, setStats] = useState(() => structuredClone(readStats()))
  const [confirmReset, setConfirmReset] = useState(false)

  const rooms = STAT_ROOMS.map((id) => ({ id, label: getRoom(id).name, value: stats.rooms[id] ?? 0, color: '#2a2233' })).sort(
    (a, b) => b.value - a.value,
  )
  const favourite = rooms.find((room) => room.value > 0)
  const bicas = totalBicas(stats)
  const walked = distance(metresWalked(stats))
  const earned = ACHIEVEMENTS.filter((achievement) => achievement.earned(stats))

  function reset() {
    if (!confirmReset) {
      setConfirmReset(true)
      return
    }
    resetStats()
    setStats(structuredClone(readStats()))
    setConfirmReset(false)
  }

  return (
    <PanelWindow eyebrow="Entrance hall · Guestbook" title="Guestbook" onClose={onClose}>
      <p className="mb-5 text-sm text-[#6d6359]">
        Dear visitor — <Intro stats={stats} />
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Section title="Around the house">
          <div className="mb-4 grid grid-cols-2 gap-3">
            <Stat value={walked.value} unit={walked.unit} label="walked indoors" />
            <Stat value={favourite?.label ?? '—'} label="favourite room" word={favourite !== undefined} />
          </div>
          <p className="mb-2 text-xs text-[#6d6359]">Times you walked into each room</p>
          <Bars rows={rooms} />
        </Section>

        <Section title="Coffee machine">
          <div className="mb-4 grid grid-cols-2 gap-3">
            <Stat value={bicas} label={bicas === 1 ? 'bica pulled' : 'bicas pulled'} />
            <Stat value={stats.bicaBestStreak} label="best perfect streak" />
          </div>
          <Bars rows={BICA_ROWS.map((row) => ({ label: row.label, value: stats.bicas[row.result], color: row.color }))} />
          {bicas > 0 && (
            <p className="mt-3 text-xs text-[#6d6359]">That&rsquo;s about <Num>{bicas * GRAMS_PER_BICA} g</Num> of ground coffee.</p>
          )}
        </Section>

        <Section title="Fridge magnets">
          <div className="grid grid-cols-2 gap-3">
            <Stat value={stats.geoBest} label="best score (of 5000)" />
            <Stat value={stats.geoRounds} label={stats.geoRounds === 1 ? 'round played' : 'rounds played'} />
            <Stat
              value={stats.geoClosestKm === null ? '—' : formatKm(stats.geoClosestKm)}
              unit={stats.geoClosestKm === null ? undefined : 'km'}
              label="closest guess"
            />
            <Stat
              value={stats.geoGuesses > 0 ? formatKm(stats.geoTotalKm / stats.geoGuesses) : '—'}
              unit={stats.geoGuesses > 0 ? 'km' : undefined}
              label="off, on average"
            />
          </div>
          {stats.geoWorstKm !== null && stats.geoWorstKm > 500 && (
            <p className="mt-3 text-xs text-[#6d6359]">
              Worst guess: <Num>{formatKm(stats.geoWorstKm)} km</Num> off. Happens to the best of us.
            </p>
          )}
        </Section>

        <Section title="Odds and ends">
          <div className="grid grid-cols-2 gap-3">
            <Stat value={stats.chats} label="chats with João" />
            <Stat value={stats.knocks} label="knocks on the bathroom door" />
            <Stat value={stats.pets} label="pets for Zeno" />
            <Stat value={stats.scoops} label="litter boxes scooped" />
            <Stat value={stats.naps} label="naps until evening" />
            <Stat value={stats.outfits} label="outfit changes" />
            <Stat value={stats.beers} label={stats.beers === 1 ? 'beer from the fridge' : 'beers from the fridge'} />
          </div>
        </Section>
      </div>

      <section className="mt-6" aria-label="Stickers">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h3 className="font-pixel text-xs uppercase tracking-widest text-[#8e2a20]">Stickers</h3>
          <p className="font-pixel text-xs text-[#6d6359]">
            {earned.length} of {ACHIEVEMENTS.length}
          </p>
        </div>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {ACHIEVEMENTS.map((achievement) => {
            const got = earned.includes(achievement)
            return (
              <li
                key={achievement.id}
                className={cn(
                  'flex gap-2 border-2 p-2 text-sm',
                  got ? 'border-[#2a2233] bg-[#ebe0c8]' : 'border-dashed border-[#b5aa94] text-[#8a7f70]',
                )}
              >
                <span aria-hidden className={cn('font-pixel', got ? 'text-[#c9a227]' : '')}>
                  {got ? '★' : '?'}
                </span>
                <span>
                  <span className="font-pixel block text-xs">
                    {achievement.title}
                    <span className="sr-only">{got ? ' (earned)' : ' (locked)'}</span>
                  </span>
                  <span className="block text-xs">{achievement.hint}</span>
                </span>
              </li>
            )
          })}
        </ul>
      </section>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t-2 border-dashed border-[#b5aa94] pt-4">
        <p className="text-xs text-[#6d6359]">Kept only in this browser. Nothing here is sent anywhere.</p>
        <button
          type="button"
          className="pixel-button"
          onClick={reset}
          onBlur={() => setConfirmReset(false)}
        >
          {confirmReset ? 'Sure? Click again' : 'Tear out this page'}
        </button>
      </div>
    </PanelWindow>
  )
}

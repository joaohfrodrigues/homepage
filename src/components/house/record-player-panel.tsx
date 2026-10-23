'use client'

import { useSyncExternalStore } from 'react'
import { Play, Square, Volume2, VolumeX } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getServerSoundOn, isSoundOn, setSoundOn, subscribeSound } from './audio'
import { PanelWindow } from './panel-window'
import { getServerState, getState, play, setMuted, setVolume, stop, subscribe } from './record-player'

interface Props {
  onClose: () => void
}

export function useRecordPlayer() {
  return useSyncExternalStore(subscribe, getState, getServerState)
}

/**
 * The living room's turntable: puts a lo-fi loop on (only when asked), with
 * volume and mute. The music keeps playing after the window closes.
 */
export function RecordPlayerPanel({ onClose }: Props) {
  const { playing, volume, muted } = useRecordPlayer()
  const soundOn = useSyncExternalStore(subscribeSound, isSoundOn, getServerSoundOn)

  return (
    <PanelWindow title="Record player" eyebrow="Living room" onClose={onClose} width="narrow">
      <div className="flex items-center gap-5">
        {/* The record: grooves, a terracotta label and a spindle; it spins while playing. */}
        <div
          className={cn(
            'relative h-24 w-24 shrink-0 rounded-full border-4 border-[#2a2233] bg-[repeating-radial-gradient(circle,#1c1722_0_3px,#2f2838_3px_5px)]',
            playing && 'motion-safe:animate-[spin_1.8s_linear_infinite]',
          )}
          aria-hidden
        >
          <div className="absolute inset-[34%] rounded-full bg-[#c4643a]" />
          <div className="absolute inset-[46%] rounded-full bg-[#f4ecd8]" />
          <div className="absolute left-1/2 top-[38%] h-1.5 w-1 -translate-x-1/2 bg-[#f4ecd8]/80" />
        </div>
        <div className="text-sm">
          <p className="font-pixel">Lisbon after dark</p>
          <p className="text-[#6d6359]">A short lo-fi loop, played live by your browser.</p>
          <p className="font-pixel mt-2 text-xs text-[#6d6359]" aria-live="polite">
            {playing ? (muted ? 'Playing (muted)' : 'Now playing') : 'Needle up'}
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button type="button" className="pixel-button" aria-pressed={playing} onClick={playing ? stop : play}>
          {playing ? <Square size={14} /> : <Play size={14} />}
          {playing ? 'Stop the record' : 'Play the record'}
        </button>
        <button
          type="button"
          className="pixel-button"
          aria-pressed={muted}
          aria-label={muted ? 'Unmute' : 'Mute'}
          onClick={() => setMuted(!muted)}
        >
          {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
        </button>
        <label className="font-pixel flex grow items-center gap-2 text-xs">
          Volume
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round((muted ? 0 : volume) * 100)}
            onChange={(e) => setVolume(Number(e.target.value) / 100)}
            className="grow accent-[#8e2a20]"
          />
        </label>
      </div>
      {!soundOn && (
        <p className="mt-4 text-sm">
          All the house&rsquo;s sounds are off.{' '}
          <button type="button" className="underline" onClick={() => setSoundOn(true)}>
            Turn them on
          </button>
        </p>
      )}
      <p className="mt-4 text-xs text-[#6d6359]">The record stops when you switch to another tab.</p>
    </PanelWindow>
  )
}

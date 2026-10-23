/**
 * The house's one AudioContext, shared by the record player and the sound
 * effects. It's only made once the visitor has clicked or pressed a key
 * (browsers won't play anything before that), everything goes through one
 * output, set by the game's volume (the record player's slider) and muted by
 * the HUD's sound button, and the audio device goes back to sleep when nothing
 * has played for a moment. Volume and mute are remembered in localStorage;
 * sound is on by default.
 */

import { useSyncExternalStore } from 'react'

const SETTINGS_KEY = 'house:sound'
/** How long after the last sound effect the context is suspended. */
const IDLE_MS = 3000
/** The volume a first visit starts at, where every sound plays at the level it was tuned to. */
const DEFAULT_VOLUME = 0.7
/** How far the arrow keys move the volume. */
export const VOLUME_STEP = 0.1

export interface Audio {
  ctx: AudioContext
  /** The shared output: the game's volume, or silence when muted. */
  out: GainNode
}

export interface SoundSettings {
  on: boolean
  /** 0 to 1. */
  volume: number
}

let audio: Audio | null = null
let noise: AudioBuffer | null = null
let holds = 0
let idleTimer: number | null = null

const SERVER_SETTINGS: SoundSettings = { on: true, volume: DEFAULT_VOLUME }

let settings: SoundSettings | null = null
const listeners = new Set<() => void>()

const clamp = (volume: number) => Math.min(Math.max(volume, 0), 1)

function readSettings(): SoundSettings {
  try {
    const saved = JSON.parse(window.localStorage.getItem(SETTINGS_KEY) ?? 'null') as Partial<SoundSettings> | null
    return {
      on: saved?.on !== false,
      volume: typeof saved?.volume === 'number' ? clamp(saved.volume) : DEFAULT_VOLUME,
    }
  } catch {
    return SERVER_SETTINGS
  }
}

export function getSound(): SoundSettings {
  settings ??= readSettings()
  return settings
}

export const isSoundOn = () => getSound().on

/** The output's gain: the default volume plays every sound at its own level. */
const gainFor = ({ on, volume }: SoundSettings) => (on ? volume / DEFAULT_VOLUME : 0)

function update(patch: Partial<SoundSettings>) {
  settings = { ...getSound(), ...patch }
  if (audio) audio.out.gain.setTargetAtTime(gainFor(settings), audio.ctx.currentTime, 0.05)
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    // Private mode: the settings last until the tab closes.
  }
  listeners.forEach((fn) => fn())
}

export function setSoundOn(on: boolean) {
  update({ on })
}

/** Sets the game's volume; turning it up (or down) also unmutes. */
export function setVolume(volume: number) {
  update({ volume: clamp(Math.round(volume * 100) / 100), on: true })
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function useSound(): SoundSettings {
  return useSyncExternalStore(subscribe, getSound, () => SERVER_SETTINGS)
}

function scheduleSleep() {
  if (idleTimer !== null) window.clearTimeout(idleTimer)
  idleTimer = window.setTimeout(() => {
    idleTimer = null
    if (holds === 0) void audio?.ctx.suspend()
  }, IDLE_MS)
}

/**
 * The context, woken up and ready to play, or null before the visitor has
 * interacted with the page (or where there's no Web Audio).
 */
export function wake(): Audio | null {
  if (typeof AudioContext === 'undefined') return null
  if (!audio) {
    // Without a click or key press first the context would start suspended, with a console warning.
    if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return null
    const ctx = new AudioContext()
    const out = ctx.createGain()
    out.gain.value = gainFor(getSound())
    out.connect(ctx.destination)
    audio = { ctx, out }
  }
  if (audio.ctx.state !== 'running') void audio.ctx.resume()
  scheduleSleep()
  return audio
}

/** Keeps the context awake (the record is playing) until `release()`. */
export function hold() {
  holds++
}

export function release() {
  holds = Math.max(holds - 1, 0)
  scheduleSleep()
}

/** Two seconds of white noise, made once and shared. */
export function noiseBuffer(ctx: AudioContext): AudioBuffer {
  if (noise) return noise
  noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
  const data = noise.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  return noise
}

const samples = new Map<string, Promise<AudioBuffer | null>>()

/** A recorded sound from `public/house/sounds/`, fetched and decoded once; null if it won't load. */
export function sample(ctx: AudioContext, name: string): Promise<AudioBuffer | null> {
  let loading = samples.get(name)
  if (!loading) {
    loading = fetch(`/house/sounds/${name}.mp3`)
      .then((response) => (response.ok ? response.arrayBuffer() : Promise.reject(new Error(response.statusText))))
      .then((data) => ctx.decodeAudioData(data))
      .catch(() => null)
    samples.set(name, loading)
  }
  return loading
}

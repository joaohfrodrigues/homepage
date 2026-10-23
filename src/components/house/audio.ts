/**
 * The house's one AudioContext, shared by the record player and the sound
 * effects. It's only made once the visitor has clicked or pressed a key
 * (browsers won't play anything before that), everything goes through one
 * output that the HUD's sound button mutes, and the audio device goes back to
 * sleep when nothing has played for a moment. The sound setting is remembered
 * in localStorage and is on by default.
 */

const SETTINGS_KEY = 'house:sound'
/** How long after the last sound effect the context is suspended. */
const IDLE_MS = 3000

export interface Audio {
  ctx: AudioContext
  /** The shared output, muted by the sound button. */
  out: GainNode
}

let audio: Audio | null = null
let noise: AudioBuffer | null = null
let holds = 0
let idleTimer: number | null = null

let soundOn: boolean | null = null
const listeners = new Set<() => void>()

function readSoundOn(): boolean {
  try {
    return window.localStorage.getItem(SETTINGS_KEY) !== 'off'
  } catch {
    return true
  }
}

export function isSoundOn(): boolean {
  soundOn ??= readSoundOn()
  return soundOn
}

export function setSoundOn(on: boolean) {
  soundOn = on
  if (audio) audio.out.gain.setTargetAtTime(on ? 1 : 0, audio.ctx.currentTime, 0.05)
  try {
    window.localStorage.setItem(SETTINGS_KEY, on ? 'on' : 'off')
  } catch {
    // Private mode: the setting lasts until the tab closes.
  }
  listeners.forEach((fn) => fn())
}

export function subscribeSound(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export const getServerSoundOn = () => true

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
    out.gain.value = isSoundOn() ? 1 : 0
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

/**
 * The living room record player: a short lo-fi loop synthesised with the Web
 * Audio API, so there's no audio file to download or license. It never starts
 * on its own (only from `play()`, called from a click) and stops when the tab
 * is hidden. Its volume is the game's (see audio.ts).
 */

import { hold, noiseBuffer, release, wake } from './audio'

export interface RecordPlayerState {
  playing: boolean
}

/** The music's level against the sound effects, at any game volume. */
const MUSIC_LEVEL = 0.5

const BPM = 72
const BEAT = 60 / BPM
const BAR = BEAT * 4
/** How far ahead notes are scheduled, and how often the scheduler wakes up. */
const LOOKAHEAD = 0.6
const TICK_MS = 200

// Fmaj7, Em7, Dm7, Cmaj7: one bar each, as MIDI notes.
const CHORDS = [
  [53, 57, 60, 64],
  [52, 55, 59, 62],
  [50, 53, 57, 60],
  [48, 52, 55, 59],
]
// A lazy melody over the four bars: [bar, beat, note, beats long].
const MELODY: [number, number, number, number][] = [
  [0, 0.5, 72, 1],
  [0, 2, 69, 1.5],
  [1, 1, 67, 1],
  [1, 2.5, 71, 1.5],
  [2, 0.5, 69, 1],
  [2, 2, 65, 1.5],
  [3, 1, 64, 1],
  [3, 2.5, 67, 2],
]

const hz = (note: number) => 440 * 2 ** ((note - 69) / 12)

const SERVER_STATE: RecordPlayerState = { playing: false }

let state: RecordPlayerState | null = null
const listeners = new Set<() => void>()

let ctx: AudioContext | null = null
let master: GainNode | null = null
let session: { bus: GainNode; timer: number; nextBar: number; bar: number } | null = null

function current(): RecordPlayerState {
  state ??= { playing: false }
  return state
}

function update(patch: Partial<RecordPlayerState>) {
  state = { ...current(), ...patch }
  listeners.forEach((fn) => fn())
}

/** One note with a soft attack and release, on two slightly detuned oscillators. */
function tone(audio: AudioContext, out: AudioNode, note: number, start: number, length: number, level: number, type: OscillatorType) {
  const gain = audio.createGain()
  gain.gain.setValueAtTime(0, start)
  gain.gain.linearRampToValueAtTime(level, start + Math.min(0.08, length / 3))
  gain.gain.setTargetAtTime(0, start + length * 0.7, length * 0.15)
  gain.connect(out)
  for (const detune of [-6, 6]) {
    const osc = audio.createOscillator()
    osc.type = type
    osc.frequency.value = hz(note)
    osc.detune.value = detune
    osc.connect(gain)
    osc.start(start)
    osc.stop(start + length + 0.5)
  }
}

function kick(audio: AudioContext, out: AudioNode, start: number) {
  const osc = audio.createOscillator()
  const gain = audio.createGain()
  osc.frequency.setValueAtTime(110, start)
  osc.frequency.exponentialRampToValueAtTime(42, start + 0.18)
  gain.gain.setValueAtTime(0.5, start)
  gain.gain.exponentialRampToValueAtTime(0.001, start + 0.3)
  osc.connect(gain).connect(out)
  osc.start(start)
  osc.stop(start + 0.32)
}

/** A noise burst: a hi-hat when bright and short, the vinyl's crackle when tiny. */
function hiss(audio: AudioContext, out: AudioNode, start: number, length: number, level: number, cutoff: number) {
  const source = audio.createBufferSource()
  source.buffer = noiseBuffer(audio)
  const filter = audio.createBiquadFilter()
  filter.type = 'highpass'
  filter.frequency.value = cutoff
  const gain = audio.createGain()
  gain.gain.setValueAtTime(level, start)
  gain.gain.exponentialRampToValueAtTime(0.001, start + length)
  source.connect(filter).connect(gain).connect(out)
  source.start(start, Math.random())
  source.stop(start + length + 0.05)
}

function scheduleBar(audio: AudioContext, out: AudioNode, bar: number, start: number) {
  const chord = CHORDS[bar % CHORDS.length]
  for (const note of chord) tone(audio, out, note, start, BAR, 0.035, 'triangle')
  tone(audio, out, chord[0] - 12, start, BEAT * 1.8, 0.09, 'sine')
  tone(audio, out, chord[0] - 12, start + BEAT * 2.5, BEAT * 1.2, 0.07, 'sine')
  for (const [melodyBar, beat, note, beats] of MELODY) {
    if (melodyBar === bar % CHORDS.length) tone(audio, out, note, start + beat * BEAT, beats * BEAT, 0.04, 'sine')
  }
  kick(audio, out, start)
  kick(audio, out, start + BEAT * 2.5)
  // Swung offbeat hats.
  for (let beat = 0; beat < 4; beat++) hiss(audio, out, start + (beat + 0.58) * BEAT, 0.05, 0.05, 7000)
  for (let pop = 0; pop < 6; pop++) hiss(audio, out, start + Math.random() * BAR, 0.01, 0.06, 2500)
}

function tick() {
  if (!ctx || !session) return
  while (session.nextBar < ctx.currentTime + LOOKAHEAD) {
    scheduleBar(ctx, session.bus, session.bar, session.nextBar)
    session.bar++
    session.nextBar += BAR
  }
}

function onVisibility() {
  if (document.visibilityState === 'hidden') stop()
}

export function play() {
  if (session) return
  const audio = wake()
  if (!audio) return
  ctx = audio.ctx
  if (!master) {
    master = ctx.createGain()
    master.gain.value = MUSIC_LEVEL
    master.connect(audio.out)
  }
  hold()
  // A warm low-pass over the whole mix, faded in so the needle doesn't thump.
  const bus = ctx.createGain()
  const warmth = ctx.createBiquadFilter()
  warmth.type = 'lowpass'
  warmth.frequency.value = 1800
  bus.gain.setValueAtTime(0, ctx.currentTime)
  bus.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.4)
  bus.connect(warmth).connect(master)
  session = { bus, timer: window.setInterval(tick, TICK_MS), nextBar: ctx.currentTime + 0.1, bar: 0 }
  tick()
  document.addEventListener('visibilitychange', onVisibility)
  update({ playing: true })
}

export function stop() {
  document.removeEventListener('visibilitychange', onVisibility)
  if (session && ctx) {
    const { bus, timer } = session
    window.clearInterval(timer)
    bus.gain.cancelScheduledValues(ctx.currentTime)
    bus.gain.setTargetAtTime(0, ctx.currentTime, 0.05)
    window.setTimeout(() => bus.disconnect(), 400)
    session = null
    // Nothing left to play: the audio device can sleep.
    release()
  }
  if (current().playing) update({ playing: false })
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export const getState = current
export const getServerState = () => SERVER_STATE

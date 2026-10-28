import type { Direction, RoomId, UnlockId } from './layout'
import type { Outfit } from './characters'
import type { Weather } from '@/lib/weather'

/** Windows drawn by React over the house that aren't pages of their own. */
export type PanelId =
  | 'directory'
  | 'wardrobe'
  | 'bica'
  | 'geoguess'
  | 'guestbook'
  | 'recordplayer'
  | 'leaderboards'
  | 'terminal'

/** What happens when the visitor interacts with something in the house. */
export type InteractAction =
  | { type: 'navigate'; href: string }
  | { type: 'dialogue'; id: DialogueId }
  | { type: 'panel'; panel: PanelId }

export type DialogueId =
  | 'joao'
  | 'letterbox'
  | 'front-door'
  | 'bed'
  | 'alarm'
  | 'bathroom'
  | 'cabinet'
  | 'balcony'
  | 'zeno'
  | 'litterbox-clean'
  | 'litterbox-dirty'
  | 'fridge'

/** What a temporary effect on the guest comes from; each source has at most one going. */
export type EffectSource = 'caffeine' | 'beer' | 'hangover'

/**
 * A temporary change to how the guest walks and how the house looks, e.g. after
 * too many bicas. Effects from different sources stack. Under
 * `prefers-reduced-motion` the scene drops shake, jitter, sway and drift, and
 * holds the vignette and blur still.
 */
export interface PlayerEffect {
  /** Walking speed multiplier. */
  speed?: number
  /** Camera shake intensity, in short bursts like a heartbeat. */
  shake?: number
  /** How far, in pixels, the guest's sprite trembles. */
  jitter?: number
  /** How far, in pixels, the camera sways from side to side. */
  sway?: number
  /** Chance that a step taken with the keys or joystick veers sideways. */
  drift?: number
  /** Colour washed over the guest. */
  tint?: number
  /** How strongly the edges of the view darken, 0–1; it breathes in and out, and holds still under reduced motion. */
  vignette?: number
  /** How far the view drifts out of focus, 0–1, coming and going; held faint and steady under reduced motion. */
  blur?: number
  /** How long it lasts before wearing off on its own. */
  ms: number
}

/** Something the directory can take the guest to: an interactable's id, or João himself. */
export type VisitTarget = string

/** The interactable the player is facing or hovering, shown in the HUD. */
export interface Hint {
  label: string
  /** True when the hint comes from mouse hover rather than the facing tile. */
  hover: boolean
}

interface GameEvents {
  ready: undefined
  interact: InteractAction
  hint: Hint | null
  room: RoomId
  moved: undefined
  /** The guest was placed beside what a `visit` asked for (or it couldn't be found). */
  arrived: VisitTarget
  /** The player took a step (counted for the guestbook). */
  step: undefined
  /** The guest came to on the sofa after a `doze`. */
  dozed: undefined
  /** A beat of the pounding heart while an effect shakes (even when reduced motion keeps the camera still). */
  heartbeat: undefined
  /** A gull gliding over the house calls out. */
  gull: undefined
}

interface UiEvents {
  teleport: RoomId
  /** Stand the guest next to an item (or João), facing it; answered with `arrived`. */
  visit: VisitTarget
  inputEnabled: boolean
  /** Trigger whatever the player is currently facing (HUD button / touch). */
  interactFacing: undefined
  /** The on-screen joystick direction being held, or null once it's let go. */
  padDirection: Direction | null
  /**
   * A touch tap at these client coordinates: walks to the floor there, or up to
   * the thing there, which a second tap (once the guest is facing it) uses.
   */
  tapAt: { x: number; y: number }
  /** Lisbon's light: how far into the night (0–1) and how golden; `animate` fades through black, as after a nap. */
  sky: { night: number; warmth: number; moon: number; animate: boolean }
  /** Lisbon's sky through the windows and on the balcony. */
  weather: Weather
  outfit: Outfit
  /** João in a new look: the owner's, or one picked in the wardrobe after the Konami code. */
  joaoLook: Outfit
  /** Everything missions have opened so far; anything left out is (or goes back to being) shut. */
  unlocks: UnlockId[]
  /** Start (or, with null, end) an effect on the guest. */
  effect: { source: EffectSource; effect: PlayerEffect | null }
  /** Pass out: fade to black and wake on the living-room sofa in the morning; answered with `dozed`. */
  doze: undefined
}

type Listener<T> = (payload: T) => void

class Channel<Events extends object> {
  private listeners = new Map<keyof Events, Set<Listener<never>>>()

  on<K extends keyof Events>(event: K, fn: Listener<Events[K]>): () => void {
    let set = this.listeners.get(event)
    if (!set) {
      set = new Set()
      this.listeners.set(event, set)
    }
    set.add(fn as Listener<never>)
    return () => set.delete(fn as Listener<never>)
  }

  emit<K extends keyof Events>(event: K, ...payload: Events[K] extends undefined ? [] : [Events[K]]) {
    this.listeners.get(event)?.forEach((fn) => (fn as Listener<unknown>)(payload[0]))
  }
}

/**
 * Two-way message bus between the React shell and the Phaser scene. Kept free
 * of Phaser imports so React components can use it without pulling the engine
 * into the server/client bundle eagerly.
 */
export class HouseBridge {
  readonly game = new Channel<GameEvents>()
  readonly ui = new Channel<UiEvents>()
}

import type { Direction, RoomId, UnlockId } from './layout'
import type { Outfit } from './characters'

/** Windows drawn by React over the house that aren't pages of their own. */
export type PanelId = 'directory' | 'wardrobe' | 'bica' | 'geoguess' | 'guestbook'

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
  | 'balcony'
  | 'zeno'
  | 'litterbox-clean'
  | 'litterbox-dirty'

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
  /** Switch to night (lamps on, rooms dark) or back to day; fades when `animate`. */
  night: { on: boolean; animate: boolean }
  outfit: Outfit
  /** Everything missions have opened so far; anything left out is (or goes back to being) shut. */
  unlocks: UnlockId[]
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

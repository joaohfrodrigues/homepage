import type { RoomId } from './layout'

export type TopicId =
  | 'trips'
  | 'writing'
  | 'home-server'
  | 'camera'
  | 'watching'
  | 'drums'
  | 'running'
  | 'hiking'

/** A subject of the site and the piece of furniture that opens it. */
export interface Topic {
  id: TopicId
  room: RoomId
  /** The furniture, as the HUD names it. */
  item: string
  title: string
  /** What you see when you look at the item. */
  look: string
  href: string
  /**
   * True when `href` opens as a window inside the house. Otherwise the item
   * describes itself and links out to the classic page until it moves in.
   */
  inHouse: boolean
}

export const TOPICS: Topic[] = [
  {
    id: 'trips',
    room: 'study',
    item: 'Map table',
    title: 'Trips & photography',
    look: 'A map of Europe spread over the table, pinned wherever the camera came along.',
    href: '/photography',
    inHouse: true,
  },
  {
    id: 'writing',
    room: 'study',
    item: 'Bookshelf',
    title: 'Writing & projects',
    look: 'Shelves of notebooks and printouts: articles, and the side projects behind them.',
    href: '/writing',
    inHouse: false,
  },
  {
    id: 'home-server',
    room: 'study',
    item: 'Desk & server rack',
    title: 'Home server series',
    look: 'A Raspberry Pi blinks away in the rack: media center, VPN gateway and secure tunnel, all written up in a series.',
    href: '/writing/projects/raspberry-pi',
    inHouse: false,
  },
  {
    id: 'camera',
    room: 'study',
    item: 'Camera stand',
    title: 'Photography gear',
    look: 'A Sony a6600 on its stand, with the 35mm and 50mm f/1.8 lenses beside it.',
    href: '/hobbies?hobby=photography&gear=1',
    inHouse: false,
  },
  {
    id: 'watching',
    room: 'living',
    item: 'TV',
    title: 'Films & series',
    look: 'The TV, still warm. A sticky note lists everything recent that scored 8/10 or more.',
    href: '/hobbies?hobby=film,series',
    inHouse: false,
  },
  {
    id: 'drums',
    room: 'living',
    item: 'Drum kit',
    title: 'Drums',
    look: 'A Roland TD-02KV electronic kit, ready for the next gig with 404s.',
    href: '/hobbies?hobby=drums',
    inHouse: false,
  },
  {
    id: 'running',
    room: 'entry',
    item: 'Shoe rack & race bibs',
    title: 'Running',
    look: 'Race bibs and medals pinned above a well-worn pair of Hoka Cliftons.',
    href: '/hobbies?hobby=running',
    inHouse: false,
  },
  {
    id: 'hiking',
    room: 'entry',
    item: 'Backpack & boots',
    title: 'Hiking',
    look: 'A backpack on its hook and muddy boots below it — they have been up Pico.',
    href: '/hobbies?hobby=hiking',
    inHouse: false,
  },
]

export function getTopic(id: TopicId): Topic {
  return TOPICS.find((topic) => topic.id === id)!
}

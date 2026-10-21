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
  /** Keystatic hobby slugs whose events and gear fill this topic's window. */
  hobbies?: string[]
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
    item: 'Wall map',
    title: 'Trips & photography',
    look: 'A big map of Europe on the study wall, pinned wherever the camera came along.',
    href: '/photography',
    inHouse: true,
  },
  {
    id: 'writing',
    room: 'study',
    item: 'Bookshelves',
    title: 'Writing & projects',
    look: 'Shelves of notebooks and printouts: articles, and the side projects behind them.',
    href: '/writing',
    inHouse: true,
  },
  {
    id: 'home-server',
    room: 'study',
    item: 'Desk & Raspberry Pi',
    title: 'Home server series',
    look: 'A Raspberry Pi and its disk enclosure blink away at the end of the desk: media center, VPN gateway and secure tunnel, all written up in a series.',
    href: '/writing/projects/raspberry-pi',
    inHouse: true,
  },
  {
    id: 'camera',
    room: 'study',
    item: 'Camera on its tripod',
    title: 'Photography gear',
    look: 'A Sony a6600 on its tripod by the window, with the 35mm and 50mm f/1.8 lenses on the shelf.',
    href: '/hobbies/photography',
    hobbies: ['photography'],
    inHouse: true,
  },
  {
    id: 'watching',
    room: 'living',
    item: 'TV',
    title: 'Films & series',
    look: 'The TV, still warm. A sticky note lists everything recent that scored 8/10 or more.',
    href: '/hobbies/watching',
    hobbies: ['film', 'series'],
    inHouse: true,
  },
  {
    id: 'drums',
    room: 'study',
    item: 'Drum kit',
    title: 'Drums',
    look: 'A Roland TD-02KV electronic kit, ready for the next gig with 404s.',
    href: '/hobbies/drums',
    hobbies: ['drums'],
    inHouse: true,
  },
  {
    id: 'running',
    room: 'hall',
    item: 'Medals & running shoes',
    title: 'Running',
    look: 'Race medals and a bib hang by the door, above a well-worn pair of Hoka Cliftons.',
    href: '/hobbies/running',
    hobbies: ['running'],
    inHouse: true,
  },
  {
    id: 'hiking',
    room: 'hall',
    item: 'Backpack & boots',
    title: 'Hiking',
    look: 'A backpack on the coat stand by the door and muddy boots below it — they have been up Pico.',
    href: '/hobbies/hiking',
    hobbies: ['hiking'],
    inHouse: true,
  },
]

export function getTopic(id: TopicId): Topic {
  return TOPICS.find((topic) => topic.id === id)!
}

/** The topic behind a /hobbies/<slug> window, e.g. "running" or "watching". */
export function getHobbyTopic(slug: string): Topic | undefined {
  return TOPICS.find((topic) => topic.hobbies && topic.href === `/hobbies/${slug}`)
}

import type { DialogueId, PanelId } from '@/game/bridge'
import { isMissionComplete, type MissionId } from '@/game/missions'
import type { HouseData } from '@/lib/house'
import type { Weather } from '@/lib/weather'
import { DOZE_AT } from './intoxication'
import type { VisitorStats } from './visitor-stats'

/** Dialogue ids the game can open, plus follow-ups only reachable from a choice. */
export type DialogueKey =
  | DialogueId
  | 'joao-tip'
  | 'caffeine-overdose'
  | 'beer'
  | 'sofa-wake'
  | 'sofa-what'
  | 'sofa-count'

/** The night that ended on the sofa, for João to recount when the guest wakes. */
export interface Binge {
  beers: number
  minutes: number
  /** Bicas pulled lately on top of the beers. */
  bicas: number
}

export type DialogueChoice =
  | { label: string; kind: 'link'; href: string }
  | { label: string; kind: 'external'; href: string }
  | { label: string; kind: 'next'; id: DialogueKey }
  | { label: string; kind: 'panel'; panel: PanelId }
  | { label: string; kind: 'night'; on: boolean }
  | { label: string; kind: 'beer' }
  | { label: string; kind: 'close' }
  /** Does a mission's step (see `mission-dialogues.ts`), or with no step asks João for a hint. */
  | { label: string; kind: 'mission'; mission: MissionId; step?: string }

export interface Dialogue {
  speaker?: string
  lines: string[]
  choices: DialogueChoice[]
}

/**
 * João's pointers to whatever the visitor hasn't found yet, most worth seeing
 * first. Each one drops out once its stat says it's been done.
 */
export function joaoTips(stats: VisitorStats, night: boolean): string[] {
  const bicas = Object.values(stats.bicas).reduce((sum, n) => sum + n, 0)
  return [
    ...(bicas === 0 ? ['Fancy a coffee? The machine in the kitchen pulls a proper bica, if you get the pressure right.'] : []),
    ...(stats.geoRounds === 0
      ? ['Every magnet on the fridge is from one of my trips. Bet you can’t guess where they were taken.']
      : []),
    ...(!stats.rooms.study ? ['The study has a map with every trip I’ve photographed. My drums are in there too.'] : []),
    ...(stats.pets === 0 ? ['Have you met Zeno? Tuxedo cat. He’ll act like he doesn’t want a scratch.'] : []),
    ...(!stats.rooms.bedroom ? ['There’s a wardrobe in the bedroom if you fancy a change of clothes.'] : []),
    ...(night && !stats.rooms.balcony ? ['Step out on the balcony while it’s dark. Someone downhill usually sings fado.'] : []),
  ]
}

/** What João says once there's nothing left to point at. */
function nothingLeft(stats: VisitorStats): string {
  return isMissionComplete(stats, 'bathroom')
    ? 'Dona Rosa says obrigada for the bica, by the way. Her boiler’s still broken, so you’ll see her again.'
    : 'You’ve seen pretty much everything. Make yourself at home.'
}

export function buildDialogue(
  id: DialogueKey,
  data: HouseData,
  house: { night: boolean; weather?: Weather; buzzing?: boolean; beers?: number; binge?: Binge | null; stats: VisitorStats },
): Dialogue {
  const contactChoices: DialogueChoice[] = data.contactLinks.map((link) => ({
    label: link.label,
    kind: 'external',
    href: link.href,
  }))
  // Every turn of the wake-up conversation can end it with the glass of water.
  const morningAfter: DialogueChoice[] = [{ label: 'Water, thanks', kind: 'close' }]

  switch (id) {
    case 'joao': {
      // The chat is counted as it opens, so the first one already reads 1.
      const firstMeeting = house.stats.chats <= 1
      const buzzing = house.buzzing ? ['…you’re buzzing a bit. How many bicas was that?'] : []
      if (firstMeeting) {
        return {
          speaker: 'João',
          lines: [
            "Hey, welcome in! I'm João.",
            ...buzzing,
            'By day I build data pipelines. The rest of the time it’s photography, films and the drums.',
            'If you ever need me, my contacts are on the note on the console by the front door.',
          ],
          choices: [
            { label: 'What should I check out?', kind: 'next', id: 'joao-tip' },
            { label: 'More about me →', kind: 'link', href: '/about' },
            { label: 'See you around', kind: 'close' },
          ],
        }
      }
      const tips = joaoTips(house.stats, house.night)
      const greetings = ['Back again!', 'Oh, hey.', 'Hey, you.']
      const greeting =
        (house.beers ?? 0) >= 3
          ? 'Easy on the Super Bock, yeah?'
          : house.night
            ? 'Still up? Me too.'
            : greetings[house.stats.chats % greetings.length]
      return {
        speaker: 'João',
        lines: [greeting, ...buzzing, tips[0] ?? nothingLeft(house.stats)],
        choices: [
          ...(tips.length > 1 ? [{ label: 'Any other tips?', kind: 'next', id: 'joao-tip' } as const] : []),
          { label: 'More about me →', kind: 'link', href: '/about' },
          { label: 'See you around', kind: 'close' },
        ],
      }
    }
    case 'joao-tip': {
      // Picks up after the tip the greeting already gave, if it gave one.
      const given = house.stats.chats <= 1 ? 0 : 1
      return {
        speaker: 'João',
        lines: [joaoTips(house.stats, house.night)[given] ?? nothingLeft(house.stats)],
        choices: [
          { label: 'More about me →', kind: 'link', href: '/about' },
          { label: 'Thanks!', kind: 'close' },
        ],
      }
    }
    case 'caffeine-overdose':
      return {
        speaker: 'João',
        lines: ['Whoa. You’re vibrating.', 'Sit down, have a glass of water. The machine’s closed for a bit.'],
        choices: [{ label: 'I feel GREAT', kind: 'close' }],
      }
    case 'fridge':
      return {
        lines: ['Magnets from João’s trips all over the door. Inside: leftovers, oat milk and a row of Super Bock.'],
        choices: [
          { label: 'Look at the magnets', kind: 'panel', panel: 'geoguess' },
          { label: 'Grab a Super Bock', kind: 'beer' },
          { label: 'Close the door', kind: 'close' },
        ],
      }
    case 'beer': {
      const beers = house.beers ?? 1
      if (beers >= 5) {
        return {
          lines: ['The floor tilts a little. Was it always like that?'],
          choices: [{ label: 'Totally fine', kind: 'close' }],
        }
      }
      if (beers >= 3) {
        return { speaker: 'João', lines: ['Saúde!'], choices: [{ label: 'Saúde!', kind: 'close' }] }
      }
      return { lines: ['Ice cold. Very refreshing.'], choices: [{ label: 'Ahh', kind: 'close' }] }
    }
    case 'sofa-wake':
      return {
        speaker: 'João',
        lines: [
          'Morning, sunshine. Easy, don’t sit up too fast.',
          'There’s a glass of water by the sofa. Drink all of it.',
        ],
        choices: [
          { label: 'Ughhh… what happened??', kind: 'next', id: 'sofa-what' },
          { label: 'How many did I have?', kind: 'next', id: 'sofa-count' },
          ...morningAfter,
        ],
      }
    case 'sofa-what': {
      const bicas = house.binge?.bicas ?? 0
      return {
        speaker: 'João',
        lines: [
          'You found the Super Bock in the fridge. Then you found the rest of the Super Bock.',
          'Somewhere around the fifth you started telling Zeno how much he means to you. He was not convinced.',
          ...(bicas > 0
            ? [`You’d had ${bicas === 1 ? 'a bica' : `${bicas} bicas`} too, which made for a very energetic speech.`]
            : []),
          'Then you sat down “just for a second”, and that was that. I put a blanket on you.',
        ],
        choices: [{ label: 'How many did I have?', kind: 'next', id: 'sofa-count' }, ...morningAfter],
      }
    }
    case 'sofa-count': {
      const binge = house.binge ?? { beers: DOZE_AT, minutes: 1, bicas: 0 }
      return {
        speaker: 'João',
        lines: [
          `${binge.beers}. In about ${binge.minutes <= 1 ? 'a minute' : `${binge.minutes} minutes`}.`,
          binge.minutes <= 3 ? 'I’ve honestly never seen anything like it.' : 'Pace yourself next time, yeah?',
        ],
        choices: [{ label: 'Ughhh… what happened??', kind: 'next', id: 'sofa-what' }, ...morningAfter],
      }
    }
    case 'letterbox':
      return {
        lines: [
          'Today’s post, stacked on the console by the door.',
          'A note on top: “Best way to reach me is LinkedIn. Code lives on GitHub, photos on Unsplash.”',
        ],
        choices: [...contactChoices, { label: 'Put it back', kind: 'close' }],
      }
    case 'front-door':
      return {
        lines: ["The front door. You've only just arrived, so have a look around first!"],
        choices: [
          { label: 'Open the directory', kind: 'panel', panel: 'directory' },
          { label: 'Stay a while', kind: 'close' },
        ],
      }
    case 'bed':
      return house.night
        ? {
            lines: ['It’s late, and the bed looks very inviting.'],
            choices: [
              { label: 'Sleep until morning', kind: 'night', on: false },
              { label: 'Five more minutes', kind: 'close' },
            ],
          }
        : {
            lines: ['A neatly made double bed. The duvet looks very soft.'],
            choices: [
              { label: 'Nap until evening', kind: 'night', on: true },
              { label: 'Not now', kind: 'close' },
            ],
          }
    case 'alarm':
      return {
        lines: ['The alarm clock is set for 06:30. A sticky note on it says “long run day”.'],
        choices: [
          { label: 'See the races →', kind: 'link', href: '/hobbies/running' },
          { label: 'Snooze', kind: 'close' },
        ],
      }
    case 'bathroom':
      return {
        lines: ['*knock knock*', '“Occupied!”', '…wasn’t João in the living room?'],
        choices: [{ label: 'Better leave it', kind: 'close' }],
      }
    case 'zeno':
      return house.night
        ? {
            lines: ['Zeno blinks at you slowly from the dark. In cat, that’s a kiss.'],
            choices: [{ label: 'Blink back', kind: 'close' }],
          }
        : {
            lines: ['Zeno, the tuxedo cat, bumps his head into your hand.', 'Prrrrrrrr…'],
            choices: [{ label: 'Scratch behind the ears', kind: 'close' }],
          }
    case 'litterbox-dirty':
      return {
        lines: ['You scoop out Zeno’s litter box. He watches from a safe distance, faintly offended.'],
        choices: [{ label: 'All fresh again', kind: 'close' }],
      }
    case 'litterbox-clean':
      return {
        lines: ['Zeno’s litter box is spotless. For now.'],
        choices: [{ label: 'Leave it be', kind: 'close' }],
      }
    case 'balcony':
      return {
        lines: balconyView(house.night, house.weather ?? 'clear'),
        choices: [{ label: house.night ? 'Listen a while' : 'Back inside', kind: 'close' }],
      }
  }
}

/** The view from the balcony, by time of day and Lisbon's actual sky. */
function balconyView(night: boolean, weather: Weather): string[] {
  switch (weather) {
    case 'clear':
      return night
        ? [
            'The street lamps are on, and the river is a dark ribbon past the rooftops.',
            'Somewhere downhill, someone is singing fado.',
          ]
        : [
            'Terracotta rooftops tumble down towards the Tejo.',
            'A tram squeals round the corner below, and a neighbour’s washing flaps in the breeze.',
          ]
    case 'cloudy':
      return night
        ? [
            'No stars tonight: the clouds sit low over the rooftops, orange with the city’s light.',
            'Somewhere downhill, someone is singing fado.',
          ]
        : [
            'A grey lid of cloud sits over the city, and the Tejo has gone the colour of pewter.',
            'Across the street, a neighbour takes the washing in, just in case.',
          ]
    case 'rain':
      return night
        ? [
            'Raining in Lisbon. Again.',
            'The street lamps smear gold across the wet cobbles, and the fado downhill has moved indoors.',
          ]
        : ['Raining in Lisbon. Again.', 'The rooftops shine, and the tram below hisses through the puddles.']
    case 'storm':
      return [
        'Thunder rolls in over the Tejo, and the rain comes down sideways.',
        night
          ? 'Each flash lights up the whole city for a heartbeat.'
          : 'The tram below gives up and waits it out with its doors shut.',
      ]
  }
}

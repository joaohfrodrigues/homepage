import type { DialogueId, PanelId } from '@/game/bridge'
import { isMissionComplete, type MissionId } from '@/game/missions'
import type { Season } from '@/game/seasons'
import type { HouseData } from '@/lib/house'
import type { Weather } from '@/lib/weather'
import { DOZE_AT, TIPSY_AT } from './intoxication'
import type { VisitorStats } from './visitor-stats'

/** Dialogue ids the game can open, plus follow-ups only reachable from a choice. */
export type DialogueKey =
  | DialogueId
  | 'joao-tip'
  | 'joao-work'
  | 'caffeine-overdose'
  | 'beer'
  | 'sofa-wake'
  | 'sofa-what'
  | 'sofa-count'
  | 'paracetamol'

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
  | { label: string; kind: 'paracetamol' }
  | { label: string; kind: 'close' }
  /** Starts the recruiters' guided tour (`interview.ts`). */
  | { label: string; kind: 'interview' }
  /** Does a mission's step (see `mission-dialogues.ts`), or with no step asks João for a hint. */
  | { label: string; kind: 'mission'; mission: MissionId; step?: string }

export interface Dialogue {
  speaker?: string
  lines: string[]
  choices: DialogueChoice[]
}

/** What João has to say about the decorations, if any are up. */
const SEASON_GREETINGS: Record<Season, string> = {
  xmas: 'Feliz Natal! There’s bolo-rei on the table. Whoever finds the fava buys next year’s.',
  santos: 'Santos Populares! Smell that? Half of Lisbon is grilling sardines tonight. Take a manjerico on your way out.',
  halloween: 'Happy Halloween! Zeno agreed to the costume for exactly one treat. Mind the pumpkin by the door.',
  newyear: 'Feliz Ano Novo! Twelve raisins at midnight, one wish each. I always run out of wishes first.',
  birthday: 'You came on my birthday! Grab a balloon on your way through.',
}

/**
 * One of a few ways of saying the same thing, moving on by one with each chat,
 * so a returning visitor doesn't hear João repeat himself.
 */
function rotate<T>(options: T[], turn: number): T {
  return options[turn % options.length]
}

/** How João ends a chat, varied the same way. */
const GOODBYES = ['See you around', 'Catch you later', 'Até já!']

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
    ...(!stats.rooms.study
      ? ['The study has a map with every trip I’ve photographed, my drums, and the workstation where the day job happens.']
      : []),
    ...(stats.pets === 0 ? ['Have you met Zeno? Tuxedo cat. He’ll act like he doesn’t want a scratch.'] : []),
    ...(!stats.rooms.bedroom ? ['There’s a wardrobe in the bedroom if you fancy a change of clothes.'] : []),
    ...(night && !stats.rooms.balcony ? ['Step out on the balcony while it’s dark. Someone downhill usually sings fado.'] : []),
  ]
}

/** What João says once there's nothing left to point at: a bit of small talk, different each chat. */
function nothingLeft(stats: VisitorStats): string {
  return rotate(
    [
      ...(isMissionComplete(stats, 'bathroom')
        ? ['Thanks for sorting the bathroom door, by the way. It’ll stick again next time it rains, but now you know the knack.']
        : []),
      'You’ve seen pretty much everything. Make yourself at home.',
      'Nothing left to show you, honestly. The sofa’s yours if you want it.',
      'Still here? You might as well have another go at the fridge magnets.',
      'Zeno’s taken a liking to you. Don’t tell him I said so.',
    ],
    stats.chats,
  )
}

export function buildDialogue(
  id: DialogueKey,
  data: HouseData,
  house: {
    night: boolean
    weather?: Weather
    buzzing?: boolean
    beers?: number
    binge?: Binge | null
    /** Woke on the sofa after a binge, and it hasn't worn off (or been treated) yet. */
    hungover?: boolean
    stats: VisitorStats
    season?: Season | null
  },
): Dialogue {
  const contactChoices: DialogueChoice[] = data.contactLinks.map((link) => ({
    label: link.label,
    kind: 'external',
    href: link.href,
  }))
  // With the Work content, João offers to show the visitor round rather than just sending them to the page.
  const workChoice: DialogueChoice = data.interview
    ? { label: 'What do you do for work?', kind: 'next', id: 'joao-work' }
    : { label: 'What do you do for work?', kind: 'link', href: '/about' }
  // Every turn of the wake-up conversation can end it with the glass of water.
  const morningAfter: DialogueChoice[] = [{ label: 'Water, thanks', kind: 'close' }]

  switch (id) {
    case 'joao': {
      // The chat is counted as it opens, so the first one already reads 1.
      const firstMeeting = house.stats.chats <= 1
      const buzzing = house.buzzing ? ['…you’re buzzing a bit. How many bicas was that?'] : []
      // The decorations get a mention on the first chat and every few after, not every time.
      const seasonal = house.season && house.stats.chats % 4 === 1 ? [SEASON_GREETINGS[house.season]] : []
      if (firstMeeting) {
        return {
          speaker: 'João',
          lines: [
            "Hey, welcome in! I'm João.",
            ...seasonal,
            ...buzzing,
            'By day I build data pipelines. The rest of the time it’s photography, films and the drums.',
            'If you ever need me, my contacts are on the note on the console by the front door.',
          ],
          choices: [
            { label: 'What should I check out?', kind: 'next', id: 'joao-tip' },
            workChoice,
            { label: 'More about me', kind: 'link', href: '/about' },
            { label: GOODBYES[0], kind: 'close' },
          ],
        }
      }
      const { chats } = house.stats
      const tips = joaoTips(house.stats, house.night)
      const greeting =
        (house.beers ?? 0) >= 3
          ? 'Easy on the Super Bock, yeah?'
          : house.night
            ? rotate(['Still up? Me too.', 'Late one, eh?', 'Can’t sleep either?'], chats)
            : rotate(['Back again!', 'Oh, hey.', 'Hey, you.', 'There you are.', 'Olá! Good timing, Zeno was getting bored of me.'], chats)
      return {
        speaker: 'João',
        // Each chat starts on the next tip, so the same one doesn't open every chat until it's done.
        lines: [greeting, ...seasonal, ...buzzing, tips.length > 0 ? rotate(tips, chats) : nothingLeft(house.stats)],
        choices: [
          ...(tips.length > 1 ? [{ label: rotate(['Any other tips?', 'What else is there?'], chats), kind: 'next', id: 'joao-tip' } as const] : []),
          rotate<DialogueChoice>(
            [workChoice, { label: 'More about me', kind: 'link', href: '/about' }],
            chats,
          ),
          { label: rotate(GOODBYES, chats), kind: 'close' },
        ],
      }
    }
    case 'joao-tip': {
      // Picks up after the tip the greeting already gave, if it gave one.
      const { chats } = house.stats
      const tips = joaoTips(house.stats, house.night)
      const tip = tips.length === 0 ? nothingLeft(house.stats) : chats <= 1 ? tips[0] : rotate(tips, chats + 1)
      return {
        speaker: 'João',
        lines: [tip],
        choices: [
          { label: 'More about me', kind: 'link', href: '/about' },
          { label: rotate(['Thanks!', 'Good shout', 'On it'], chats), kind: 'close' },
        ],
      }
    }
    case 'joao-work':
      return {
        speaker: 'João',
        lines: [
          data.interview?.current
            ? `I’m a ${data.interview.current.role} at ${data.interview.current.company}. Been there since ${data.interview.current.joined}.`
            : 'I build data pipelines.',
          'Got a minute? I can show you round my desk, or you can read it all on my About page.',
        ],
        choices: [
          { label: 'Show me around', kind: 'interview' },
          { label: 'I’ll just read it', kind: 'link', href: '/about' },
          { label: 'Maybe later', kind: 'close' },
        ],
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
          isMissionComplete(house.stats, 'bathroom')
            ? 'Paracetamol’s in the cabinet over the bathroom sink.'
            : 'There’s paracetamol in the bathroom cabinet, if you can get that door open.',
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
    case 'bathroom': {
      const damp = house.weather === 'rain' || house.weather === 'storm'
      // The stats already count this try, so the third one is where João comes up.
      const nudge = house.stats.doorTries >= 3 ? 'Maybe João knows a trick.' : 'Maybe it just needs another go.'
      return {
        lines: [
          'The handle turns, but the door doesn’t budge. It’s stuck fast in its frame.',
          ...(damp ? ['All this rain can’t be helping.'] : []),
          nudge,
        ],
        choices: [{ label: 'Leave it', kind: 'close' }],
      }
    }
    case 'cabinet':
      return cabinet(house)
    case 'paracetamol':
      return {
        lines: [
          'You wash one down with a glass of water from the tap.',
          'Give it twenty minutes, and maybe skip the Super Bock for a while.',
        ],
        choices: [{ label: 'Never again', kind: 'close' }],
      }
    case 'zeno':
      return house.night
        ? {
            lines: ['Zeno blinks at you slowly from the dark. In cat, that’s a kiss.'],
            choices: [{ label: 'Blink back', kind: 'close' }],
          }
        : {
            lines: [
              house.season === 'halloween'
                ? 'Zeno, the tuxedo cat, bumps his head into your hand. His witch’s hat slips over one eye.'
                : 'Zeno, the tuxedo cat, bumps his head into your hand.',
              'Prrrrrrrr…',
            ],
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

/** The mirror cabinet over the bathroom sink, and what it has for how the guest is feeling. */
function cabinet(house: { buzzing?: boolean; beers?: number; hungover?: boolean }): Dialogue {
  const opened = 'You open the mirror cabinet over the sink.'
  const shelves = 'Toothpaste, João’s razor, plasters, factor 50 for the long runs and a box of paracetamol.'
  if (house.hungover) {
    return {
      lines: [opened, 'Your reflection looks rough. Very rough.', shelves],
      choices: [
        { label: 'Take a paracetamol', kind: 'paracetamol' },
        { label: 'Close it', kind: 'close' },
      ],
    }
  }
  if ((house.beers ?? 0) >= TIPSY_AT) {
    return {
      lines: [opened, shelves, 'Paracetamol won’t sober you up, though. Water and a lie-down will.'],
      choices: [{ label: 'Close it', kind: 'close' }],
    }
  }
  if (house.buzzing) {
    return {
      lines: [opened, shelves, 'Nothing in here for too much coffee. You’ll just have to wait it out.'],
      choices: [{ label: 'Close it', kind: 'close' }],
    }
  }
  return { lines: [opened, shelves, 'Nothing you need right now.'], choices: [{ label: 'Close it', kind: 'close' }] }
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
            'A scooter whines up the hill, then the street goes quiet again.',
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

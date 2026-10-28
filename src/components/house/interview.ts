import type { VisitTarget } from '@/game/bridge'
import type { CurrentRole } from '@/lib/work-history'

/** The Work content (content/work.yaml) the recruiters' tour is built from (see `getHouseData`). */
export interface InterviewInfo {
  headline: string
  current: CurrentRole | null
  stack: { group: string; items: string[] }[]
  projects: { title: string; blurb: string; href: string }[]
}

/** One stop of the tour: where the guest is taken, and the card shown there. */
export interface TourStop {
  /** What the guest is stood beside (an interactable's id, or João). */
  target: VisitTarget
  /** Where in the flat, for the card's eyebrow. */
  place: string
  title: string
  lines: string[]
  stack?: InterviewInfo['stack']
  link?: { label: string; href: string }
}

/** The Work projects each stop is about, by the page they link to. */
const HOME_SERVER = '/writing/projects/raspberry-pi'
const ACULTURA = '/writing/projects/acultura-te'
const THIS_SITE = '/writing/how-this-site-works'

/**
 * The interview: a minute's walk round the study and back to João for anyone
 * hiring. The Pi comes before the bookshelves so the guest isn't moved off the
 * desk and back. A stop whose project isn't in the Work content drops out.
 */
export function tourStops(info: InterviewInfo): TourStop[] {
  const { current } = info
  const job = current
    ? [
        `${current.role} at ${current.company}.`,
        // Joined and role dates both, so a recent promotion isn't read as a recent hire.
        current.roleSince === current.joined
          ? `I’ve been there since ${current.joined}.`
          : `I’ve been there since ${current.joined}, and in this role since ${current.roleSince}.`,
      ]
    : [info.headline]
  const project = (href: string) => info.projects.find((p) => p.href === href)
  const homeServer = project(HOME_SERVER)
  const acultura = project(ACULTURA)
  const thisSite = project(THIS_SITE)
  return [
    {
      target: 'work',
      place: 'Study · Workstation',
      title: 'The day job',
      lines: [...job, 'What I work with:'],
      stack: info.stack,
      link: { label: 'Full experience', href: '/about' },
    },
    ...(homeServer
      ? [
          {
            target: 'work',
            place: 'Study · End of the desk',
            title: 'The home server',
            lines: ['See the Raspberry Pi blinking at the end of the desk?', homeServer.blurb],
            link: { label: 'Read the series', href: homeServer.href },
          },
        ]
      : []),
    ...(acultura
      ? [
          {
            target: 'writing',
            place: 'Study · Bookshelves',
            title: acultura.title,
            lines: ['On the shelves, the side project I’m building now.', acultura.blurb],
            link: { label: 'How it’s built', href: acultura.href },
          },
        ]
      : []),
    ...(thisSite
      ? [
          {
            target: 'joao',
            place: 'Living room · João',
            title: 'The house itself',
            lines: ['And you’re standing in my other side project.', thisSite.blurb],
            link: { label: 'How this site works', href: thisSite.href },
          },
        ]
      : []),
  ]
}

import { AUTHOR_NAME } from '@/lib/site-config'

/** A page the terminal can list as a file or folder. */
export interface SitePage {
  slug: string
  title: string
}

/** What the workstation's terminal knows about, from the Work content and the rest of the site. */
export interface WorkstationInfo {
  headline: string
  /** The current role, e.g. "Senior Data Engineer at Critical TechWorks since May 2021, in this role since Jul 2025". */
  now: string | null
  projects: { name: string; href: string }[]
  cvUrl: string
  /** The writing: project series with their articles, then standalone articles. */
  writing: { projects: (SitePage & { articles: SitePage[] })[]; articles: SitePage[] }
  /** Photo collections, as the trips on the study's map. */
  trips: SitePage[]
  hobbies: SitePage[]
}

export type TerminalOutput =
  | { kind: 'text'; text: string }
  | { kind: 'links'; links: TerminalLink[] }

export interface TerminalLink {
  label: string
  /** Where it goes; without one it's just a name, like a file with no page of its own. */
  href?: string
  /** A file rather than a page, opened in a new tab. */
  download?: boolean
}

/** The machine a prompt is on: the desk itself, or the Pi once logged in. */
export type TerminalHost = 'desk' | 'pi'

/** One command at the prompt and what it printed. */
export interface TerminalEntry {
  host: TerminalHost
  /** The working directory the command ran in, as the prompt shows it; `~` if left out. */
  cwd?: string
  /** Typed into vim rather than at the shell. */
  vim?: boolean
  command: string
  output: TerminalOutput[]
}

/** Where the session ends up, and so where the cursor waits. */
export const SESSION_HOST = 'pi'

/**
 * The session already on the workstation's screen when the visitor sits down:
 * logged into the Raspberry Pi at the end of the desk, as the home server
 * series' terminal was. The visitor carries on from it at the prompt (see
 * `terminal-commands.ts`).
 */
export function workstationSession(info: WorkstationInfo): TerminalEntry[] {
  const session: TerminalEntry[] = [
    {
      host: 'desk',
      command: 'ssh pi',
      output: [{ kind: 'text', text: 'Raspberry Pi 5 · media center, VPN gateway and secure tunnel. Shared in ~/projects/home-server.' }],
    },
    { host: SESSION_HOST, command: 'whoami', output: [{ kind: 'text', text: `${AUTHOR_NAME}: ${info.headline}` }] },
  ]
  if (info.now) session.push({ host: SESSION_HOST, command: 'cat ~/work/now', output: [{ kind: 'text', text: info.now }] })
  if (info.projects.length > 0) {
    session.push({
      host: SESSION_HOST,
      command: 'ls ~/projects',
      output: [{ kind: 'links', links: info.projects.map(({ name, href }) => ({ label: `${name}/`, href })) }],
    })
  }
  session.push({ host: SESSION_HOST, command: 'open ~/work', output: [{ kind: 'links', links: workLinks(info) }] })
  return session
}

/** The About page (where the work lives), and the CV when there is one. */
export function workLinks(info: WorkstationInfo): TerminalLink[] {
  const work: TerminalLink[] = [{ label: 'work.html: experience, projects, stack', href: '/about' }]
  if (info.cvUrl) work.push({ label: info.cvUrl.split('/').pop()!, href: info.cvUrl, download: true })
  return work
}

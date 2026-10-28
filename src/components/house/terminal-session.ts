import { AUTHOR_NAME } from '@/lib/site-config'

/** What the workstation's terminal knows about, from the Work page's content. */
export interface WorkstationInfo {
  headline: string
  /** The current role, e.g. "Senior Data Engineer at Critical TechWorks, since Jul 2025". */
  now: string | null
  projects: { name: string; href: string }[]
  cvUrl: string
}

export type TerminalOutput =
  | { kind: 'text'; text: string }
  | { kind: 'links'; links: TerminalLink[] }

export interface TerminalLink {
  label: string
  href: string
  /** A file rather than a page, opened in a new tab. */
  download?: boolean
}

/** One command at the prompt and what it printed. */
export interface TerminalEntry {
  /** The machine the prompt is on: the desk itself, or the Pi once logged in. */
  host: 'desk' | 'pi'
  command: string
  output: TerminalOutput[]
}

/** Where the session ends up, and so where the cursor waits. */
export const SESSION_HOST = 'pi'

/**
 * The session already on the workstation's screen when the visitor sits down:
 * logged into the Raspberry Pi at the end of the desk, as the home server
 * series' terminal was. For now it's the same every time; it's kept as data so
 * the terminal can later take commands of its own.
 */
export function workstationSession(info: WorkstationInfo): TerminalEntry[] {
  const session: TerminalEntry[] = [
    {
      host: 'desk',
      command: 'ssh pi',
      output: [{ kind: 'text', text: 'Raspberry Pi 5 · media center, VPN gateway and secure tunnel. Written up in ~/projects/home-server.' }],
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
  const work: TerminalLink[] = [{ label: 'work.html: experience, projects, stack', href: '/work' }]
  if (info.cvUrl) work.push({ label: info.cvUrl.split('/').pop()!, href: info.cvUrl, download: true })
  session.push({ host: SESSION_HOST, command: 'open ~/work', output: [{ kind: 'links', links: work }] })
  return session
}

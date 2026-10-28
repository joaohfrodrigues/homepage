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
  command: string
  output: TerminalOutput[]
}

/**
 * The session already on the workstation's screen when the visitor sits down.
 * For now it's the same every time; it's kept as data so the terminal can later
 * take commands of its own.
 */
export function workstationSession(info: WorkstationInfo): TerminalEntry[] {
  const session: TerminalEntry[] = [{ command: 'whoami', output: [{ kind: 'text', text: `${AUTHOR_NAME}: ${info.headline}` }] }]
  if (info.now) session.push({ command: 'cat ~/work/now', output: [{ kind: 'text', text: info.now }] })
  if (info.projects.length > 0) {
    session.push({
      command: 'ls ~/projects',
      output: [{ kind: 'links', links: info.projects.map(({ name, href }) => ({ label: `${name}/`, href })) }],
    })
  }
  const work: TerminalLink[] = [{ label: 'work.html: experience, projects, stack', href: '/work' }]
  if (info.cvUrl) work.push({ label: info.cvUrl.split('/').pop()!, href: info.cvUrl, download: true })
  session.push({ command: 'open ~/work', output: [{ kind: 'links', links: work }] })
  return session
}

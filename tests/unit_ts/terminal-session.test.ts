/// <reference types="bun" />
import { describe, expect, test } from 'bun:test'
import { workstationSession, type WorkstationInfo } from '../../src/components/house/terminal-session'

const INFO: WorkstationInfo = {
  headline: 'Senior Data Engineer · Lisbon',
  now: 'Senior Data Engineer at Somewhere, since 2025',
  projects: [
    { name: 'acultura-te', href: '/writing/projects/acultura-te' },
    { name: 'home-server', href: '/writing/projects/raspberry-pi' },
    { name: 'this-site', href: '/writing/how-this-site-works' },
  ],
  cvUrl: '/files/cv.pdf',
}

const links = (info: WorkstationInfo, command: string) =>
  workstationSession(info)
    .find((entry) => entry.command === command)!
    .output.flatMap((output) => (output.kind === 'links' ? output.links : []))

describe('The workstation terminal', () => {
  test('logs into the Pi, then introduces João, his current job and his projects', () => {
    const session = workstationSession(INFO)
    expect(session.map((entry) => `${entry.host}$ ${entry.command}`)).toEqual([
      'desk$ ssh pi',
      'pi$ whoami',
      'pi$ cat ~/work/now',
      'pi$ ls ~/projects',
      'pi$ open ~/work',
    ])
    expect(session[1].output).toEqual([{ kind: 'text', text: 'João Rodrigues: Senior Data Engineer · Lisbon' }])
  })

  test('links the home server series on the bookshelves as a project, not a dedicated object', () => {
    expect(links(INFO, 'ls ~/projects')).toContainEqual({ label: 'home-server/', href: '/writing/projects/raspberry-pi' })
  })

  test('ends on a link to the Work page, and the CV when there is one', () => {
    expect(links(INFO, 'open ~/work')).toEqual([
      { label: 'work.html: experience, projects, stack', href: '/work' },
      { label: 'cv.pdf', href: '/files/cv.pdf', download: true },
    ])
    expect(links({ ...INFO, cvUrl: '' }, 'open ~/work').map((link) => link.href)).toEqual(['/work'])
  })

  test('skips what it does not know', () => {
    const commands = workstationSession({ ...INFO, now: null, projects: [] }).map((entry) => entry.command)
    expect(commands).toEqual(['ssh pi', 'whoami', 'open ~/work'])
  })
})

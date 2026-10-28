/// <reference types="bun" />
import { describe, expect, test } from 'bun:test'
import { workstationSession, type WorkstationInfo } from '../../src/components/house/terminal-session'

const INFO: WorkstationInfo = {
  headline: 'Senior Data Engineer · Lisbon',
  now: 'Senior Data Engineer at Somewhere, since 2025',
  projects: [
    { name: 'acultura-te', href: '/writing/projects/acultura-te' },
    { name: 'this-site', href: '/writing/how-this-site-works' },
  ],
  cvUrl: '/files/cv.pdf',
}

const links = (info: WorkstationInfo, command: string) =>
  workstationSession(info)
    .find((entry) => entry.command === command)!
    .output.flatMap((output) => (output.kind === 'links' ? output.links : []))

describe('The workstation terminal', () => {
  test('introduces João, his current job and his projects', () => {
    const session = workstationSession(INFO)
    expect(session.map((entry) => entry.command)).toEqual(['whoami', 'cat ~/work/now', 'ls ~/projects', 'open ~/work'])
    expect(session[0].output).toEqual([{ kind: 'text', text: 'João Rodrigues: Senior Data Engineer · Lisbon' }])
    expect(links(INFO, 'ls ~/projects').map((link) => link.label)).toEqual(['acultura-te/', 'this-site/'])
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
    expect(commands).toEqual(['whoami', 'open ~/work'])
  })
})

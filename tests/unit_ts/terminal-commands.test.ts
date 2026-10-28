/// <reference types="bun" />
import { describe, expect, test } from 'bun:test'
import {
  complete,
  INITIAL_STATE,
  runCommand,
  siteHome,
  type ShellContext,
  type ShellState,
} from '../../src/components/house/terminal-commands'
import type { TerminalOutput, WorkstationInfo } from '../../src/components/house/terminal-session'

const INFO: WorkstationInfo = {
  headline: 'Senior Data Engineer · Lisbon',
  now: 'Senior Data Engineer at Somewhere, since 2025',
  projects: [{ name: 'home-server', href: '/writing/projects/raspberry-pi' }],
  cvUrl: '/files/cv.pdf',
  writing: {
    projects: [{ slug: 'raspberry-pi', title: 'Home server', articles: [{ slug: 'part-1', title: 'Part 1' }] }],
    articles: [{ slug: 'how-this-site-works', title: 'How this site works' }],
  },
  trips: [{ slug: 'italy-2025', title: 'Italy · 2025' }],
  hobbies: [{ slug: 'running', title: 'Running' }],
}

const CTX: ShellContext = {
  home: siteHome(INFO),
  now: new Date('2026-10-28T12:00:00Z'),
  weather: 'rain',
  history: [],
  random: () => 0,
}

/** Runs each command in turn from the start of the session, returning the last result. */
function run(...commands: string[]) {
  let state: ShellState = INITIAL_STATE
  let result = runCommand(state, '', CTX)
  for (const command of commands) {
    result = runCommand(state, command, CTX)
    state = result.state
  }
  return result
}

const printed = (output: TerminalOutput[]) =>
  output.map((o) => (o.kind === 'text' ? o.text : o.links.map((link) => link.label).join(' '))).join('\n')
const hrefs = (output: TerminalOutput[]) => output.flatMap((o) => (o.kind === 'links' ? o.links.map((link) => link.href) : []))

describe('Getting around the site', () => {
  test('ls lists the sections as folders that link their pages, hiding dotfiles', () => {
    const { output } = run('ls')
    expect(printed(output)).toBe('about.md work/ projects/ writing/ photography/ hobbies/')
    expect(hrefs(output)).toContain('/photography')
    expect(printed(run('ls -a').output)).toContain('.plan')
  })

  test('cd moves the prompt, and ls lists what is inside', () => {
    const result = run('cd writing')
    expect(result.state.cwd).toEqual(['writing'])
    const { output } = run('cd writing', 'ls')
    expect(printed(output)).toBe('raspberry-pi/ how-this-site-works.md')
    expect(hrefs(run('cd writing/raspberry-pi', 'ls').output)).toEqual(['/writing/projects/raspberry-pi/part-1'])
    expect(run('cd writing', 'cd ..', 'pwd').output).toEqual([{ kind: 'text', text: '/home/joao' }])
  })

  test('open takes a file or folder to its page, with or without the .md', () => {
    expect(run('open photography/italy-2025').effect).toEqual({ type: 'open', href: '/photography/italy-2025', download: false })
    expect(run('cd writing', 'open how-this-site-works').effect).toMatchObject({ href: '/writing/how-this-site-works' })
    expect(run('open ~/work/cv.pdf').effect).toEqual({ type: 'open', href: '/files/cv.pdf', download: true })
  })

  test('says what went wrong, and rings the bell', () => {
    expect(run('cd /etc')).toMatchObject({ output: [{ text: 'cd: /etc: Permission denied' }], sound: 'bell' })
    expect(run('cd nowhere').output).toEqual([{ kind: 'text', text: 'cd: nowhere: No such file or directory' }])
    expect(run('cat writing').output).toEqual([{ kind: 'text', text: 'cat: writing: Is a directory' }])
    expect(printed(run('writing').output)).toContain('Did you mean cd writing?')
    expect(run('cd ..').state.cwd).toEqual([])
  })

  test('Tab completes commands and paths', () => {
    expect(complete(INITIAL_STATE, 'pw', CTX.home)).toBe('pwd ')
    expect(complete(INITIAL_STATE, 'cd wr', CTX.home)).toBe('cd writing/')
    expect(complete(INITIAL_STATE, 'open writing/how', CTX.home)).toBe('open writing/how-this-site-works.md')
    expect(complete(INITIAL_STATE, 'cd zz', CTX.home)).toBe('cd zz')
  })
})

describe('The Pi and the desk', () => {
  test('the series commands run on the Pi and link the part they come from', () => {
    expect(hrefs(run('docker ps').output)).toEqual(['/writing/projects/raspberry-pi/home-server-part-2-media-center'])
  })

  test('exit logs out to the desk, where the Pi commands are missing, and exit again closes', () => {
    const desk = run('exit')
    expect(desk.state.host).toBe('desk')
    expect(printed(run('exit', 'docker ps').output)).toContain('Try ssh pi')
    expect(run('exit', 'ssh pi').state.host).toBe('pi')
    expect(run('exit', 'exit').effect).toEqual({ type: 'close' })
  })
})

describe('Secrets', () => {
  test('sudo is reported on the third try', () => {
    expect(run('sudo ls')).toMatchObject({ output: [{ text: 'Nice try.' }] })
    expect(run('sudo ls').reported).toBeUndefined()
    expect(run('sudo ls', 'sudo ls', 'sudo ls')).toMatchObject({ egg: 'sudo', reported: true })
  })

  test('each egg is found once its command is typed', () => {
    expect(run('sudo make me a bica')).toMatchObject({ egg: 'bica', sound: 'steam' })
    expect(run('cat zeno')).toMatchObject({ egg: 'zeno', sound: 'meow' })
    expect(run('rm -rf /').egg).toBe('rm')
    expect(run('cat .plan').egg).toBe('plan')
    expect(run('ping tejo').egg).toBe('lisbon')
    expect(run('matrix')).toMatchObject({ egg: 'matrix', effect: { type: 'matrix' } })
  })

  test('vim only lets go on :q', () => {
    expect(run('vim').state.vim).toBe(true)
    expect(run('vim', 'exit').state.vim).toBe(true)
    expect(run('vim', 'exit', ':q')).toMatchObject({ state: { vim: false }, egg: 'vim' })
  })

  test('weather reads the house’s sky', () => {
    expect(printed(run('weather').output)).toContain('rain')
  })
})

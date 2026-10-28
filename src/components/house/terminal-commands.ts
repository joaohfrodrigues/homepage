import type { Weather } from '@/lib/weather'
import { AUTHOR_NAME } from '@/lib/site-config'
import { workLinks, type TerminalHost, type TerminalLink, type TerminalOutput, type WorkstationInfo } from './terminal-session'

/*
 * The workstation's shell: the site as a home directory to `ls`, `cd` and
 * `open`, the home server series' commands on the Pi, and a few things `help`
 * doesn't mention. Everything here is pure, so the panel only renders what it
 * returns and carries out its effects.
 */

/** A file or folder in the visitor's view of ~. A folder with an href opens as a page too. */
export type FsNode =
  | { kind: 'dir'; name: string; href?: string; children: FsNode[] }
  | { kind: 'file'; name: string; href?: string; download?: boolean; text?: string; hidden?: boolean }

/** Secrets the shell keeps; finding a few earns the Root access sticker. */
export type TerminalEgg = 'sudo' | 'bica' | 'zeno' | 'rm' | 'vim' | 'matrix' | 'plan' | 'lisbon'

export type TerminalSound = 'bell' | 'meow' | 'steam'

export interface ShellState {
  host: TerminalHost
  /** Folders below ~, e.g. ['writing', 'raspberry-pi']. */
  cwd: string[]
  /** Times `sudo` was tried; the third gets reported. */
  sudoTries: number
  /** Inside vim, where only `:q` gets you out. */
  vim: boolean
}

export interface ShellContext {
  home: FsNode & { kind: 'dir' }
  now: Date
  weather: Weather
  /** Commands typed so far, oldest first. */
  history: string[]
  /** A number in [0, 1), for `fortune`. */
  random: () => number
}

export type ShellEffect =
  | { type: 'open'; href: string; download?: boolean }
  | { type: 'clear' }
  | { type: 'close' }
  | { type: 'matrix' }

export interface CommandResult {
  state: ShellState
  output: TerminalOutput[]
  effect?: ShellEffect
  egg?: TerminalEgg
  sound?: TerminalSound
  /** `sudo` tried once too often: the guestbook notes the incident. */
  reported?: boolean
}

export const INITIAL_STATE: ShellState = { host: 'pi', cwd: [], sudoTries: 0, vim: false }

const SERIES = '/writing/projects/raspberry-pi'
const PART = {
  foundation: { label: '→ Part 1: The Foundation', href: `${SERIES}/home-server-part-1-foundation` },
  media: { label: '→ Part 2: The Media Center', href: `${SERIES}/home-server-part-2-media-center` },
  vpn: { label: '→ Part 3: VPN split-tunneling', href: `${SERIES}/home-server-part-3-vpn-split-tunneling` },
  tunnel: { label: '→ Part 4: The Secure Tunnel', href: `${SERIES}/home-server-part-4-secure-tunnel` },
  das: { label: '→ Part 5: Scaling up with a DAS', href: `${SERIES}/home-server-part-5-das-upgrade` },
}
/** The day Part 1 went up, which the Pi counts as its last reboot. */
const BOOTED = new Date('2026-01-13T09:00:00Z')

/**
 * Lines already in the shell's history when the visitor sits down, so ↑ and
 * `history` turn up a few notes João left himself about the house.
 */
export const PLANTED_HISTORY = [
  'cat ~/.plan',
  '# note to self: the wardrobe still remembers the old cheat codes',
  '# never ten bicas in five minutes again',
  '# the bathroom door wants a shoulder, not a hand',
  'sudo make me a bica',
]

const FORTUNES = [
  'There are two hard things in computer science: cache invalidation, naming things and off-by-one errors.',
  'A bica a day keeps the deadlines at bay. Ten a day keeps you awake till Tuesday.',
  'It works on my Pi.',
  'Lisbon has seven hills, and every one of them is uphill.',
  'The best time to back up your photos was yesterday. The second best is before the SSD fills up.',
  'Zeno has read your code. Zeno is not impressed.',
  'Saudade (n.): missing something you never had, like a passing test suite.',
  'If at first you don’t succeed, call it version 1.0.',
]

const HELP = [
  'Get around:   ls [dir]   cd <dir>   pwd   cat <file>   open <file or dir>',
  'At the shell: whoami   history   clear (or Ctrl+L)   exit',
  'On the Pi:    uptime   docker ps   df -h   wg show   tailscale status   lsblk',
  'Try:  cd writing   then   ls   then   open <a name>.  Tab completes names, ↑ recalls commands.',
]

const COMMANDS = [
  'cat', 'cd', 'clear', 'df', 'docker', 'echo', 'exit', 'fortune', 'help', 'history', 'hostname', 'logout', 'ls',
  'lsblk', 'open', 'ping', 'pwd', 'ssh', 'sudo', 'tailscale', 'uptime', 'weather', 'wg', 'whoami',
]

const text = (...lines: string[]): TerminalOutput => ({ kind: 'text', text: lines.join('\n') })
const links = (...items: TerminalLink[]): TerminalOutput => ({ kind: 'links', links: items })

const page = (name: string, href: string): FsNode => ({ kind: 'file', name, href })

/** The site as João's home directory on the Pi. */
export function siteHome(info: WorkstationInfo): FsNode & { kind: 'dir' } {
  const [work, cv] = workLinks(info)
  return {
    kind: 'dir',
    name: '~',
    children: [
      { kind: 'file', name: 'about.md', href: '/about', text: `${AUTHOR_NAME}: ${info.headline}` },
      {
        kind: 'dir',
        name: 'work',
        href: '/about',
        children: [
          ...(info.now ? [{ kind: 'file', name: 'now', text: info.now } as FsNode] : []),
          page('work.html', work.href!),
          ...(cv ? [{ kind: 'file', name: cv.label, href: cv.href, download: true } as FsNode] : []),
        ],
      },
      {
        kind: 'dir',
        name: 'projects',
        children: info.projects.map(({ name, href }) => ({ kind: 'dir', name, href, children: [] })),
      },
      {
        kind: 'dir',
        name: 'writing',
        href: '/writing',
        children: [
          ...info.writing.projects.map(
            (project): FsNode => ({
              kind: 'dir',
              name: project.slug,
              href: `/writing/projects/${project.slug}`,
              children: project.articles.map((article) =>
                page(`${article.slug}.md`, `/writing/projects/${project.slug}/${article.slug}`),
              ),
            }),
          ),
          ...info.writing.articles.map((article) => page(`${article.slug}.md`, `/writing/${article.slug}`)),
        ],
      },
      {
        kind: 'dir',
        name: 'photography',
        href: '/photography',
        children: info.trips.map((trip) => ({ kind: 'dir', name: trip.slug, href: `/photography/${trip.slug}`, children: [] })),
      },
      {
        kind: 'dir',
        name: 'hobbies',
        href: '/hobbies',
        children: info.hobbies.map((hobby) => ({ kind: 'dir', name: hobby.slug, href: `/hobbies/${hobby.slug}`, children: [] })),
      },
      {
        kind: 'file',
        name: '.plan',
        hidden: true,
        text: [
          'Plan for the flat:',
          '- [x] teach the coffee machine to pour a perfect bica',
          '- [x] hide something in the wardrobe for people who know the old ways',
          '- [ ] fix the bathroom door (it just needs a shoulder)',
          '- [ ] stop Zeno walking across the keyboard',
        ].join('\n'),
      },
    ],
  }
}

/** The prompt's path for `cwd`, e.g. `~/writing`. */
export function cwdLabel(cwd: string[]): string {
  return ['~', ...cwd].join('/')
}

/** Splits a path into the folders below ~ it points at, or null if it leaves ~. */
function resolvePath(cwd: string[], path: string): string[] | null {
  let parts: string[]
  if (path === '~' || path.startsWith('~/')) parts = path.slice(1).split('/')
  else if (path.startsWith('/home/joao')) parts = path.slice('/home/joao'.length).split('/')
  else if (path.startsWith('/')) return null
  else parts = [...cwd, ...path.split('/')]
  const out: string[] = []
  for (const part of parts) {
    if (part === '' || part === '.') continue
    if (part === '..') {
      if (out.length === 0) return null
      out.pop()
    } else out.push(part)
  }
  return out
}

function lookup(home: FsNode, parts: string[]): FsNode | null {
  let node: FsNode = home
  for (const part of parts) {
    if (node.kind !== 'dir') return null
    // Articles answer to their slug without the .md, too.
    const next: FsNode | undefined =
      node.children.find((child) => child.name === part) ?? node.children.find((child) => child.name === `${part}.md`)
    if (!next) return null
    node = next
  }
  return node
}

/** Finds what `path` names from `cwd`, with an error ready for when it doesn't. */
function find(state: ShellState, ctx: ShellContext, command: string, path: string): { node: FsNode; parts: string[] } | string {
  const parts = resolvePath(state.cwd, path)
  if (!parts) return `${command}: ${path}: Permission denied`
  const node = lookup(ctx.home, parts)
  if (!node) return `${command}: ${path}: No such file or directory`
  return { node, parts }
}

const label = (node: FsNode) => (node.kind === 'dir' ? `${node.name}/` : node.name)

function listing(node: FsNode, all: boolean): TerminalOutput {
  if (node.kind === 'file') return links({ label: node.name, href: node.href, download: node.download })
  const shown = node.children.filter((child) => all || !(child.kind === 'file' && child.hidden))
  if (shown.length === 0) return text('(empty: open it instead)')
  return links(...shown.map((child) => ({ label: label(child), href: child.href, download: child.kind === 'file' && child.download })))
}

function uptime(now: Date): string {
  const minutes = Math.max(0, Math.floor((now.getTime() - BOOTED.getTime()) / 60_000))
  const days = Math.floor(minutes / 1440)
  const clock = `${Math.floor((minutes % 1440) / 60)}:${String(minutes % 60).padStart(2, '0')}`
  const time = now.toTimeString().slice(0, 8)
  return ` ${time} up ${days} days, ${clock},  1 user,  load average: 0.42, 0.37, 0.31`
}

const WEATHER: Record<Weather, string> = {
  clear: 'Lisbon: ☀ clear. Sunglasses weather, even in October.',
  cloudy: 'Lisbon: ☁ cloudy. A grey lid over the Tejo, no rain yet.',
  rain: 'Lisbon: ☂ rain. The calçada is a skating rink; walk carefully.',
  storm: 'Lisbon: ⚡ storm. The trams have given up for now.',
}

const ZENO = [' /\\_/\\', '( o.o )  meow.', ' > ^ <', '', 'Zeno, who is in the living room, not in this computer.']

/** The Pi's own commands, from the home server series; null if `command` isn't one. */
function piCommand(command: string, args: string[], now: Date): TerminalOutput[] | null {
  switch (command) {
    case 'uptime':
      return [text(uptime(now))]
    case 'docker':
      if (args[0] !== 'ps') return [text('Usage: docker ps')]
      return [
        text(
          'CONTAINER ID   IMAGE                     STATUS        NAMES',
          '3f9a1c2e7b4d   runtipi/runtipi:latest    Up 6 months   runtipi',
          '8c21d0e5a6f3   plexinc/pms-docker        Up 6 months   plex',
          'a4e7b9130c5d   linuxserver/qbittorrent   Up 6 months   qbittorrent',
          '5b0d3f8e2a71   linuxserver/sonarr        Up 6 months   sonarr',
          'e6c42a9d1f08   linuxserver/radarr        Up 6 months   radarr',
        ),
        links(PART.media),
      ]
    case 'df':
      return [
        text(
          'Filesystem      Size  Used Avail Use% Mounted on',
          '/dev/mmcblk0p2   29G  6.1G   22G  22% /',
          '/dev/nvme0n1p1  916G  841G   75G  92% /media/storage',
        ),
        links(PART.das),
      ]
    case 'wg':
      return [
        text('interface: wg0', '  listening port: 51820', '  fwmark: 0xca6c', '', 'peer: (the VPN provider)', '  allowed ips: 0.0.0.0/0'),
        links(PART.vpn),
      ]
    case 'tailscale':
      return [text('100.101.12.7    homeserver   linux   -', '100.101.12.31   phone        iOS     active; direct'), links(PART.tunnel)]
    case 'lsblk':
      return [
        text('NAME          SIZE MOUNTPOINT', 'mmcblk0      29.7G', '└─mmcblk0p2    29G /', 'nvme0n1       932G', '└─nvme0n1p1   916G /media/storage'),
        links(PART.foundation),
      ]
  }
  return null
}

/** Runs one line typed at the prompt. */
export function runCommand(state: ShellState, input: string, ctx: ShellContext): CommandResult {
  const line = input.trim()
  const done = (output: TerminalOutput[], extra: Partial<CommandResult> = {}): CommandResult => ({ state, output, ...extra })

  if (state.vim) {
    if ([':q', ':q!', ':wq', ':x', 'ZZ'].includes(line)) {
      return { state: { ...state, vim: false }, output: [text('You got out of vim. Not everyone does.')], egg: 'vim' }
    }
    return done([text(line.startsWith(':') ? `E492: Not an editor command: ${line.slice(1)}` : '-- INSERT --  (type :q to quit)')])
  }

  const [command = '', ...args] = line.split(/\s+/)
  if (command === '' || command.startsWith('#')) return done([])

  const shellFile = (path: string | undefined, verb: string) => {
    if (!path) return `${verb}: missing operand`
    return find(state, ctx, verb, path)
  }

  switch (command) {
    case 'help':
    case 'man':
      if (command === 'man' && args[0]) return done([text(`No manual entry for ${args[0]}. Try help.`)])
      return done([text(...HELP)])
    case 'ls': {
      const all = args.some((arg) => arg.startsWith('-') && arg.includes('a'))
      const path = args.find((arg) => !arg.startsWith('-')) ?? '.'
      const found = find(state, ctx, 'ls', path)
      if (typeof found === 'string') return done([text(found)], { sound: 'bell' })
      return done([listing(found.node, all)])
    }
    case 'cd': {
      const found = find(state, ctx, 'cd', args[0] ?? '~')
      if (typeof found === 'string') return done([text(found)], { sound: 'bell' })
      if (found.node.kind !== 'dir') return done([text(`cd: ${args[0]}: Not a directory`)], { sound: 'bell' })
      return { state: { ...state, cwd: found.parts }, output: [] }
    }
    case 'pwd':
      return done([text(['/home/joao', ...state.cwd].join('/'))])
    case 'cat': {
      if (args[0] === 'zeno') return done([text(...ZENO)], { egg: 'zeno', sound: 'meow' })
      const found = shellFile(args[0], 'cat')
      if (typeof found === 'string') return done([text(found)], { sound: 'bell' })
      const { node } = found
      if (node.kind === 'dir') return done([text(`cat: ${args[0]}: Is a directory`)], { sound: 'bell' })
      const output: TerminalOutput[] = []
      if (node.text) output.push(text(node.text))
      if (node.href) output.push(links({ label: `→ open ${node.name}`, href: node.href, download: node.download }))
      return done(output, node.name === '.plan' ? { egg: 'plan' } : {})
    }
    case 'open':
    case 'xdg-open': {
      const found = shellFile(args[0], 'open')
      if (typeof found === 'string') return done([text(found)], { sound: 'bell' })
      const { node } = found
      if (!node.href) return done([text(`open: ${args[0]}: nothing to open; try cat`)], { sound: 'bell' })
      return done([text(`Opening ${label(node)}…`)], {
        effect: { type: 'open', href: node.href, download: node.kind === 'file' && node.download },
      })
    }
    case 'whoami':
      return done([text(state.host === 'pi' ? 'joao (on the Pi)' : 'joao')])
    case 'hostname':
      return done([text(state.host === 'pi' ? 'homeserver' : 'desk')])
    case 'echo':
      return done([text(args.join(' '))])
    case 'history':
      return done([text(...ctx.history.map((entry, i) => `${String(i + 1).padStart(4)}  ${entry}`))])
    case 'clear':
      return done([], { effect: { type: 'clear' } })
    case 'exit':
    case 'logout':
      if (state.host === 'pi') {
        return { state: { ...state, host: 'desk', cwd: [] }, output: [text('logout', 'Connection to pi closed.')] }
      }
      return done([], { effect: { type: 'close' } })
    case 'ssh': {
      const host = args[0]?.replace(/^.*@/, '')
      if (!host) return done([text('usage: ssh <host>')])
      if (host === 'pi' || host === 'homeserver') {
        if (state.host === 'pi') return done([text('You’re already on the Pi.')])
        return { state: { ...state, host: 'pi', cwd: [] }, output: [text('Welcome back to homeserver.')] }
      }
      if (host === 'lisbon') {
        return done([text('Connected to lisbon.', 'Last login: always. The seven hills say olá.', 'Connection to lisbon closed by a passing tram.')], {
          egg: 'lisbon',
        })
      }
      return done([text(`ssh: connect to host ${host} port 22: Connection refused`)], { sound: 'bell' })
    }
    case 'ping': {
      const host = args[0]
      if (!host) return done([text('usage: ping <host>')])
      if (host === 'tejo') {
        return done(
          [text('PING tejo: 56 data bytes', '64 bytes from tejo: the river is fine, time=0.1 ms', '64 bytes from tejo: still fine, time=0.1 ms', '64 bytes from tejo: a ferry waves back, time=0.2 ms')],
          { egg: 'lisbon' },
        )
      }
      return done([text(`ping: ${host}: Name or service not known`)], { sound: 'bell' })
    }
    case 'sudo': {
      const rest = args.join(' ')
      if (/^make me an? (bica|coffee|sandwich)$/.test(rest)) {
        return done([text('Okay.', 'One bica, on the house. It’s waiting by the machine in the kitchen.')], { egg: 'bica', sound: 'steam' })
      }
      const tries = state.sudoTries + 1
      const next = { ...state, sudoTries: tries }
      if (tries < 3) return { state: next, output: [text('Nice try.')], sound: 'bell' }
      return {
        state: next,
        output: [text('joao is not in the sudoers file. This incident will be reported.', '(It has been. Check the guestbook.)')],
        egg: 'sudo',
        reported: true,
        sound: 'bell',
      }
    }
    case 'rm':
      if (args.some((arg) => /^-[a-z]*r[a-z]*f|^-[a-z]*f[a-z]*r/.test(arg))) {
        return done(
          [
            text(
              'removing ~/photography … done',
              'removing ~/writing … done',
              'removing ~/work … done',
              'removing Zeno … permission denied (he’s a cat)',
              '',
              'Just kidding. Nothing was removed, and the backups are on the Pi anyway.',
            ),
          ],
          { egg: 'rm' },
        )
      }
      return done([text('rm: this is João’s computer. Please don’t.')], { sound: 'bell' })
    case 'vim':
    case 'vi':
      return { state: { ...state, vim: true }, output: [text('~', '~', '~', `"${args[0] ?? '[No Name]'}" — you’re in vim now. Good luck.`)] }
    case 'emacs':
      return done([text('emacs: vim is right there.')])
    case 'nano':
      return done([text('nano: honestly, the most sensible choice here. Still not installed.')])
    case 'matrix':
    case 'cmatrix':
      return done([text('Wake up, visitor…', 'The Matrix has you.')], { effect: { type: 'matrix' }, egg: 'matrix' })
    case 'fortune':
      return done([text(FORTUNES[Math.floor(ctx.random() * FORTUNES.length)])])
    case 'weather':
    case 'curl':
      if (command === 'curl' && !/wttr\.in/.test(args.join(' '))) return done([text('curl: the Pi only fetches the weather (try curl wttr.in/lisbon)')])
      return done([text(WEATHER[ctx.weather])])
    case 'date':
      return done([text(ctx.now.toString())])
    case 'pet':
      if (args[0] === 'zeno') return done([text('Zeno is in the living room. He’d rather you came in person.')])
      break
  }

  if (state.host === 'pi') {
    const pi = piCommand(command, args, ctx.now)
    if (pi) return done(pi)
  } else if (piCommand(command, args, ctx.now)) {
    return done([text(`${command}: command not found on the desk. Try ssh pi.`)], { sound: 'bell' })
  }

  // A folder typed on its own: say how to get into it.
  const named = find(state, ctx, command, command)
  if (typeof named !== 'string') {
    const hint = named.node.kind === 'dir' ? `cd ${command}` : `open ${command}`
    return done([text(`bash: ${command}: command not found. Did you mean ${hint}?`)], { sound: 'bell' })
  }
  return done([text(`bash: ${command}: command not found. Type help.`)], { sound: 'bell' })
}

/** Completes the last word of `input` (a command, else a path); unchanged if nothing fits. */
export function complete(state: ShellState, input: string, home: FsNode): string {
  const words = input.split(' ')
  const last = words[words.length - 1]
  let options: string[]
  if (words.length === 1) {
    options = COMMANDS.filter((command) => command.startsWith(last))
  } else {
    const slash = last.lastIndexOf('/')
    const dir = slash >= 0 ? last.slice(0, slash + 1) : ''
    const parts = resolvePath(state.cwd, dir || '.')
    const node = parts && lookup(home, parts)
    if (!node || node.kind !== 'dir') return input
    const stem = last.slice(slash + 1)
    options = node.children
      .filter((child) => child.name.startsWith(stem) && (stem.startsWith('.') || !(child.kind === 'file' && child.hidden)))
      .map((child) => dir + label(child))
  }
  if (options.length === 0) return input
  let prefix = options[0]
  for (const option of options) while (!option.startsWith(prefix)) prefix = prefix.slice(0, -1)
  if (prefix.length <= last.length) return input
  // One match for a command gets a space after it, ready for its argument.
  const done = options.length === 1 && words.length === 1 ? `${prefix} ` : prefix
  return [...words.slice(0, -1), done].join(' ')
}

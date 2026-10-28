import Link from 'next/link'
import type { ArticleSummary } from '@/lib/articles'
import type { ProjectSummary } from '@/lib/projects'

/*
 * Pixel centrepieces for the study's writing: the bookshelves (the /writing
 * index) and the desk monitor (a project page, and the Work page). Like the
 * travel map, they sit above the existing article lists rather than replacing them.
 */

const SPINES = ['#8e2f35', '#2f5f63', '#c9a227', '#3f6b8a', '#6b4a7a', '#4f7a3a']

export function articleHref(article: ArticleSummary): string {
  return article.project ? `/writing/projects/${article.project}/${article.slug}` : `/writing/${article.slug}`
}

/** The study bookshelves: a binder per project on top, the latest articles as books below. */
export function Bookshelf({
  projects,
  articles,
}: {
  projects: (ProjectSummary & { parts: number })[]
  articles: ArticleSummary[]
}) {
  return (
    <div className="border-4 border-[#2a2233] bg-[#6b4a2e] p-2">
      <div className="flex flex-wrap items-end gap-3 border-b-[6px] border-[#b07a4a] bg-[#3d2a1d] px-3 pt-3">
        {projects.map((project, i) => (
          <Link
            key={project.slug}
            href={`/writing/projects/${project.slug}`}
            scroll={false}
            aria-label={`${project.title} — ${project.parts} articles`}
            className="group flex h-40 w-28 flex-col border-2 border-b-0 border-[#2a2233] p-2 transition-transform hover:-translate-y-1 focus-visible:-translate-y-1 focus-visible:outline-none"
            style={{ background: SPINES[i % SPINES.length] }}
          >
            <span className="mx-auto mb-2 flex gap-3" aria-hidden>
              <span className="size-2 rounded-full bg-[#2a2233]" />
              <span className="size-2 rounded-full bg-[#2a2233]" />
            </span>
            <span className="font-pixel bg-[#f4ecd8] px-1.5 py-1 text-xs leading-tight text-[#2a2233] group-hover:bg-white">
              {project.title}
            </span>
            <span className="font-pixel mt-auto mb-2 text-center text-xs text-[#f4ecd8]/80">
              {project.parts} {project.parts === 1 ? 'part' : 'parts'}
            </span>
          </Link>
        ))}
        <span className="font-pixel mb-2 ml-auto self-end text-xs text-[#d9b98c]">Projects</span>
      </div>
      <div className="flex flex-wrap items-end gap-1.5 border-b-[6px] border-[#b07a4a] bg-[#3d2a1d] px-3 pt-3">
        {articles.map((article, i) => (
          <Link
            key={article.slug}
            href={articleHref(article)}
            scroll={false}
            title={article.title}
            aria-label={article.title}
            className="flex w-9 justify-center overflow-hidden border-2 border-b-0 border-[#2a2233] py-2 transition-transform hover:-translate-y-1 focus-visible:-translate-y-1 focus-visible:outline-none"
            style={{ background: SPINES[(i + 2) % SPINES.length], height: `${8 + ((i * 5) % 3)}rem` }}
          >
            <span
              className="font-pixel whitespace-nowrap text-[11px] text-[#f4ecd8]"
              style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
            >
              {article.title.length > 28 ? `${article.title.slice(0, 27)}…` : article.title}
            </span>
          </Link>
        ))}
        <span className="font-pixel mb-2 ml-auto self-end text-xs text-[#d9b98c]">Latest</span>
      </div>
    </div>
  )
}

/** The desk monitor's frame and stand, for a terminal session; the Work page uses it too. */
export function Terminal({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="border-[6px] border-[#2a2233] bg-[#0f1a14] p-4 font-mono text-sm leading-relaxed text-[#7fd1b9] shadow-[0_6px_0_#6b4a2e]">
        {children}
      </div>
      <div className="mx-auto h-3 w-24 bg-[#2a2233]" aria-hidden />
    </div>
  )
}

/** A shell prompt on `host`, then the command typed, or a blinking cursor without one. */
export function Prompt({ host, command }: { host: string; command?: string }) {
  return (
    <p>
      <span className="text-[#e8c95a]">joao@{host}</span>
      <span className="text-[#a69cba]">:~$ </span>
      {command ?? <span className="inline-block h-4 w-2 translate-y-0.5 animate-pulse bg-[#7fd1b9]" aria-hidden />}
    </p>
  )
}

/** The desk monitor: the project's README and its articles, oldest first, as a terminal session. */
export function DeskTerminal({
  project,
  articles,
}: {
  project: ProjectSummary
  articles: ArticleSummary[]
}) {
  const host = project.slug === 'raspberry-pi' ? 'pi' : 'desk'
  const inOrder = [...articles].reverse()

  return (
    <Terminal>
      <Prompt host={host} command={`cat ~/writing/${project.slug}/README`} />
      <p className="mb-3 text-[#c9d6c3]">{project.description}</p>
      <Prompt host={host} command={`ls ~/writing/${project.slug}`} />
      <ol className="mb-3">
        {inOrder.map((article, i) => (
          <li key={article.slug} className="flex gap-3">
            <span className="text-[#a69cba]">{String(i + 1).padStart(2, '0')}</span>
            <Link href={articleHref(article)} scroll={false} className="hover:text-[#f4ecd8] hover:underline">
              {article.title}
            </Link>
          </li>
        ))}
      </ol>
      <Prompt host={host} />
    </Terminal>
  )
}

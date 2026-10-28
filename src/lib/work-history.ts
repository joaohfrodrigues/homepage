import type { Work } from './work'

/*
 * João's jobs read as stays at a company, not a list of roles: several roles
 * at one place are one stay, with its own start date. Kept apart from
 * `work.ts` (which reads the filesystem) so the house can use it client-side.
 */

/** Roles held in a row at one company, newest first, with the whole stay's period. */
export interface Employer {
  company: string
  /** From the first role's start to the latest role's end, e.g. "May 2021 – now". */
  period: string
  roles: Work['experience']
}

/** The current job, with when João joined the company as well as when he took this role. */
export interface CurrentRole {
  role: string
  company: string
  /** e.g. "May 2021". */
  joined: string
  /** e.g. "Jul 2025"; the same as `joined` when it's the only role there. */
  roleSince: string
}

const periodStart = (period: string) => period.split('–')[0].trim()
const periodEnd = (period: string) => (period.split('–')[1] ?? period).trim()

/**
 * Groups consecutive roles at the same company (the Work content lists them
 * newest first), so a promotion doesn't read like a new job.
 */
export function employers(experience: Work['experience']): Employer[] {
  const groups: Employer[] = []
  for (const job of experience) {
    const last = groups.at(-1)
    if (last && job.company && last.company === job.company) last.roles.push(job)
    else groups.push({ company: job.company, period: job.period, roles: [job] })
  }
  return groups.map((group) => ({
    ...group,
    period: `${periodStart(group.roles.at(-1)!.period)} – ${periodEnd(group.roles[0].period)}`,
  }))
}

export function currentRole(experience: Work['experience']): CurrentRole | null {
  const employer = employers(experience).find((group) => group.roles[0].current)
  if (!employer) return null
  const [now] = employer.roles
  return {
    role: now.role,
    company: now.company,
    joined: periodStart(employer.roles.at(-1)!.period),
    roleSince: periodStart(now.period),
  }
}

/** The current job in a sentence: "X at Y since May 2021, in this role since Jul 2025". */
export function describeCurrentRole({ role, company, joined, roleSince }: CurrentRole): string {
  const at = `${role} at ${company} since ${joined}`
  return roleSince === joined ? at : `${at}, in this role since ${roleSince}`
}

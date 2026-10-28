/// <reference types="bun" />
import { describe, expect, test } from 'bun:test'
import { currentRole, describeCurrentRole, employers } from '../../src/lib/work-history'

const job = (role: string, company: string, period: string, current = false) => ({ role, company, period, current, outcome: '' })

const EXPERIENCE = [
  job('Senior Data Engineer & Product Owner', 'Critical TechWorks', 'Jul 2025 – now', true),
  job('Senior Data Engineer & Scrum Master', 'Critical TechWorks', 'May 2024 – Jul 2025'),
  job('Data Engineer', 'Critical TechWorks', 'May 2021 – May 2024'),
  job('Data Engineer', 'BNP Paribas', '2019 – 2021'),
]

describe('Work history', () => {
  test('groups roles in a row at one company into one stay', () => {
    expect(employers(EXPERIENCE).map(({ company, period, roles }) => [company, period, roles.length])).toEqual([
      ['Critical TechWorks', 'May 2021 – now', 3],
      ['BNP Paribas', '2019 – 2021', 1],
    ])
  })

  test('dates the current job from joining the company, not from the latest role', () => {
    const current = currentRole(EXPERIENCE)!
    expect(current).toEqual({ role: 'Senior Data Engineer & Product Owner', company: 'Critical TechWorks', joined: 'May 2021', roleSince: 'Jul 2025' })
    expect(describeCurrentRole(current)).toBe('Senior Data Engineer & Product Owner at Critical TechWorks since May 2021, in this role since Jul 2025')
    expect(describeCurrentRole({ ...current, roleSince: 'May 2021' })).toBe('Senior Data Engineer & Product Owner at Critical TechWorks since May 2021')
  })

  test('has no current job when none is marked current', () => {
    expect(currentRole(EXPERIENCE.slice(1))).toBeNull()
  })
})

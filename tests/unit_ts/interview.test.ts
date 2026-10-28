/// <reference types="bun" />
import { describe, expect, test } from 'bun:test'
import { tourStops, type InterviewInfo } from '../../src/components/house/interview'

const INFO: InterviewInfo = {
  headline: 'Data engineer · Lisbon',
  current: { role: 'Senior Data Engineer', company: 'Somewhere', joined: 'May 2021', roleSince: 'Jul 2025' },
  stack: [{ group: 'Data', items: ['Python', 'SQL'] }],
  projects: [
    { title: 'Acultura-te', blurb: 'Culture in Portugal.', href: '/writing/projects/acultura-te' },
    { title: 'Home server', blurb: 'A Raspberry Pi.', href: '/writing/projects/raspberry-pi' },
    { title: 'This site', blurb: 'The flat.', href: '/writing/how-this-site-works' },
  ],
}

describe('The interview', () => {
  test('goes from the desk to the Pi, the shelves and João', () => {
    const stops = tourStops(INFO)
    expect(stops.map((stop) => [stop.target, stop.title])).toEqual([
      ['work', 'The day job'],
      ['work', 'The home server'],
      ['writing', 'Acultura-te'],
      ['joao', 'The house itself'],
    ])
    // When he joined as well as when he took the role, so a promotion doesn't read as a new job.
    expect(stops[0].lines.slice(0, 2)).toEqual(['Senior Data Engineer at Somewhere.', 'I’ve been there since May 2021, and in this role since Jul 2025.'])
    expect(stops[3].link?.href).toBe('/writing/how-this-site-works')
  })

  test('drops a stop whose project is gone and falls back to the headline', () => {
    const stops = tourStops({ ...INFO, current: null, projects: INFO.projects.slice(0, 1) })
    expect(stops.map((stop) => stop.title)).toEqual(['The day job', 'Acultura-te'])
    expect(stops[0].lines[0]).toBe('Data engineer · Lisbon')
  })
})

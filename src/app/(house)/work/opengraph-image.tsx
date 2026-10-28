import { readFile } from 'fs/promises'
import path from 'path'
import { ImageResponse } from 'next/og'
import { getWork } from '@/lib/work'
import { AUTHOR_NAME } from '@/lib/site-config'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const alt = 'João Rodrigues, data engineer in Lisbon, beside a window onto his pixel-art house'

const INK = '#2a2233'
const PAPER = '#f4ecd8'
const ROOF = '#c0392b'
const LIGHT = '#e8c95a'

/**
 * The /work link preview (LinkedIn, Slack, WhatsApp): name and role first, so
 * it reads as a profile, with a window onto the house so it still looks like
 * this site. Every other page keeps the plain house snapshot.
 */
export default async function Image() {
  const [work, house] = await Promise.all([getWork(), readFile(path.join(process.cwd(), 'src/assets/og-image.png'))])
  // The first couple from each group, so the tags show the range rather than one corner of it.
  const tools = work?.stack.flatMap(({ items }) => items.slice(0, 2)).slice(0, 8) ?? []

  return new ImageResponse(
    (
      <div style={{ display: 'flex', width: '100%', height: '100%', background: INK, color: PAPER }}>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', width: 660, padding: '0 64px' }}>
          <div style={{ display: 'flex', width: 72, height: 10, background: ROOF, marginBottom: 32 }} />
          <div style={{ fontSize: 72, fontWeight: 700, lineHeight: 1.05 }}>{AUTHOR_NAME}</div>
          <div style={{ fontSize: 36, color: LIGHT, marginTop: 16 }}>{work?.headline ?? 'Data Engineer · Lisbon'}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 40 }}>
            {tools.map((tool) => (
              <div key={tool} style={{ display: 'flex', fontSize: 24, padding: '6px 14px', border: `3px solid ${PAPER}55` }}>
                {tool}
              </div>
            ))}
          </div>
          <div style={{ fontSize: 26, color: '#a69cba', marginTop: 48 }}>joaohfrodrigues.com/work</div>
        </div>
        <div style={{ display: 'flex', flex: 1, padding: '48px 48px 48px 0' }}>
          <div style={{ display: 'flex', flex: 1, border: `8px solid ${PAPER}`, overflow: 'hidden' }}>
            {/* The snapshot at 1.25×, framed on João and Zeno, above its own caption. */}
            <img
              src={`data:image/png;base64,${house.toString('base64')}`}
              alt=""
              width={1500}
              height={788}
              style={{ marginLeft: -375, flexShrink: 0 }}
            />
          </div>
        </div>
      </div>
    ),
    size,
  )
}

import { ImageResponse } from 'next/og'

export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

const INK = '#2a2233'
const ROOF = '#c0392b'
const WALL = '#f4ecd8'
const LIGHT = '#e8c95a'

/** [x, y, width, height, fill] on a 16px grid: the house, stepped roof first. */
const PIXELS: [number, number, number, number, string][] = [
  [6, 1, 4, 1, INK],
  [5, 2, 6, 1, INK],
  [4, 3, 8, 1, INK],
  [3, 4, 10, 1, INK],
  [2, 5, 12, 1, INK],
  [1, 6, 14, 2, INK],
  [6, 2, 4, 1, ROOF],
  [5, 3, 6, 1, ROOF],
  [4, 4, 8, 1, ROOF],
  [3, 5, 10, 1, ROOF],
  [2, 6, 12, 1, ROOF],
  [3, 8, 10, 7, INK],
  [4, 8, 8, 6, WALL],
  [5, 10, 2, 4, INK],
  [9, 9, 2, 2, LIGHT],
]

export default function Icon() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', background: 'transparent' }}>
        <svg width="32" height="32" viewBox="0 0 16 16" shapeRendering="crispEdges">
          {PIXELS.map(([x, y, w, h, fill], i) => (
            <rect key={i} x={x} y={y} width={w} height={h} fill={fill} />
          ))}
        </svg>
      </div>
    ),
    size
  )
}

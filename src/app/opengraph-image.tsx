import { ImageResponse } from 'next/og'
import { SITE_NAME } from '@/lib/site-config'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function DefaultOpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#0a0a0a',
          color: '#fafafa',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ fontSize: 72, fontWeight: 700, letterSpacing: '-0.02em' }}>
          {SITE_NAME}
        </div>
        <div style={{ fontSize: 28, color: '#a1a1aa', marginTop: 16 }}>
          Photography · Writing · Music
        </div>
      </div>
    ),
    { ...size }
  )
}

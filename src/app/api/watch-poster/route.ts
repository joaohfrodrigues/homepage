import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Only Plex's own thumbnail path shape is allowed through — this proxies
// requests to the Plex server, attaching PLEX_TOKEN server-side so the
// token never reaches the client or gets written into data/watch-history.json
// (which is committed to git).
const PLEX_THUMB_PATH_PATTERN = /^\/library\/metadata\/\d+\/thumb(\/\d+)?$/

export async function GET(request: NextRequest) {
  const path = request.nextUrl.searchParams.get('path')

  if (!path || !PLEX_THUMB_PATH_PATTERN.test(path)) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
  }

  const plexUrl = process.env.PLEX_URL
  const plexToken = process.env.PLEX_TOKEN
  if (!plexUrl || !plexToken) {
    return NextResponse.json({ error: 'Plex is not configured' }, { status: 503 })
  }

  const upstream = await fetch(`${plexUrl}${path}?X-Plex-Token=${plexToken}`)
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: 'Failed to fetch poster' }, { status: 502 })
  }

  return new NextResponse(upstream.body, {
    headers: {
      'Content-Type': upstream.headers.get('content-type') ?? 'image/jpeg',
      'Cache-Control': 'public, max-age=86400',
    },
  })
}

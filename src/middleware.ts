import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  if (process.env.NODE_ENV === 'development') {
    return NextResponse.next()
  }

  const hasKeystatic =
    Boolean(process.env.KEYSTATIC_GITHUB_CLIENT_ID) &&
    Boolean(process.env.KEYSTATIC_GITHUB_CLIENT_SECRET) &&
    Boolean(process.env.KEYSTATIC_SECRET)

  if (!hasKeystatic) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/keystatic/:path*', '/api/keystatic/:path*'],
}

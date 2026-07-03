export const dynamic = 'force-dynamic'

import { makeRouteHandler } from '@keystatic/next/route-handler'
import config from '../../../../../keystatic.config'

// TEMPORARY: log GitHub's raw token-exchange response to debug "Authorization
// failed" in production. Remove once resolved.
const originalFetch = global.fetch
global.fetch = async (...args) => {
  const url = args[0] instanceof Request ? args[0].url : String(args[0])
  const res = await originalFetch(...args)
  if (url.includes('github.com/login/oauth/access_token')) {
    const clone = res.clone()
    console.log('[keystatic-debug] token exchange response', res.status, await clone.text())
  }
  return res
}

export const { GET, POST } = makeRouteHandler({ config })

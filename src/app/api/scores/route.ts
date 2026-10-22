import { listScores, submitScore } from '@/lib/scores/api'
import { getScoreStore } from '@/lib/scores/store'

export const dynamic = 'force-dynamic'

// Public scoreboards for the house's games and its Hall of Fame. With no store
// configured (no Upstash env vars) both methods answer 503 { offline: true }.
export function GET(request: Request) {
  return listScores(request, getScoreStore())
}

export function POST(request: Request) {
  return submitScore(request, getScoreStore())
}

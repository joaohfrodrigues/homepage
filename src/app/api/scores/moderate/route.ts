import { moderateScore } from '@/lib/scores/api'
import { getScoreStore } from '@/lib/scores/store'

export const dynamic = 'force-dynamic'

// Hides a leaderboard entry (or shows it again), behind SCORES_ADMIN_SECRET:
//   curl -X POST https://<site>/api/scores/moderate \
//     -H "Authorization: Bearer $SCORES_ADMIN_SECRET" \
//     -d '{"board":"geoguess","id":"<entry id>","hidden":true}'
export function POST(request: Request) {
  return moderateScore(request, getScoreStore(), process.env.SCORES_ADMIN_SECRET)
}

import { getLookStore, readLook, saveLook } from '@/lib/joao-look'

export const dynamic = 'force-dynamic'

// João's look for every visitor. Anyone can read it; only the owner, with
// HOUSE_OWNER_SECRET, can change it (from the wardrobe, after the Konami code).
export function GET() {
  return readLook(getLookStore())
}

export function PUT(request: Request) {
  return saveLook(request, getLookStore(), process.env.HOUSE_OWNER_SECRET)
}

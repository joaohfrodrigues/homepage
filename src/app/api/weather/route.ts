import { NextResponse } from 'next/server'
import { weatherFromCode, type Weather } from '@/lib/weather'

// Lisbon's current conditions, refreshed at most every half hour so visitors
// never reach Open-Meteo themselves (it needs no API key).
export const revalidate = 1800

const LISBON_NOW = 'https://api.open-meteo.com/v1/forecast?latitude=38.72&longitude=-9.14&current=weather_code'

export async function GET() {
  // Any failure leaves the sky clear rather than breaking the house.
  let weather: Weather = 'clear'
  try {
    const upstream = await fetch(LISBON_NOW, { next: { revalidate: 1800 }, signal: AbortSignal.timeout(5000) })
    if (upstream.ok) {
      const data = (await upstream.json()) as { current?: { weather_code?: unknown } }
      weather = weatherFromCode(data.current?.weather_code)
    }
  } catch {
    // Offline, timed out or malformed: clear it is.
  }
  return NextResponse.json({ weather })
}

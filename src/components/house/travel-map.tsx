import Link from 'next/link'
import { isOnMap, projectToMap } from '@/game/map-projection'
import type { Trip } from '@/lib/photos'

interface Props {
  trips: Trip[]
}

/**
 * The study's map table, full size: one pin per trip at its biggest stop,
 * with smaller dots for the other places that trip passed through.
 */
export function TravelMap({ trips }: Props) {
  const mapped = trips.filter((trip) => trip.stops.some((stop) => isOnMap(stop.lat, stop.lon)))

  return (
    <div className="relative w-full border-4 border-[#2a2233] bg-[#7fb0c9]" style={{ aspectRatio: '176 / 100' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/house/europe-map.png"
        alt="Pixel-art map of Europe"
        className="absolute inset-0 h-full w-full"
        style={{ imageRendering: 'pixelated' }}
      />
      {mapped.map((trip) =>
        trip.stops.slice(1).map((stop) =>
          isOnMap(stop.lat, stop.lon) ? (
            <span
              key={`${trip.slug}-${stop.name}-${stop.lat}`}
              aria-hidden
              className="absolute size-1.5 -translate-x-1/2 -translate-y-1/2 bg-[#2a2233] sm:size-2"
              style={positionOf(stop.lat, stop.lon)}
            />
          ) : null,
        ),
      )}
      {mapped.map((trip) => {
        const main = trip.stops.find((stop) => isOnMap(stop.lat, stop.lon))!
        return (
          <Link
            key={trip.slug}
            href={`/photography/${trip.slug}`}
            scroll={false}
            aria-label={`${trip.title}: ${trip.totalPhotos} photos`}
            className="group absolute -translate-x-1/2 -translate-y-full focus:outline-none"
            style={positionOf(main.lat, main.lon)}
          >
            <PinIcon />
            <span className="font-pixel pointer-events-none absolute bottom-full left-1/2 mb-1 hidden -translate-x-1/2 whitespace-nowrap bg-[#2a2233] px-2 py-0.5 text-xs text-[#f4ecd8] group-hover:block group-focus-visible:block">
              {trip.title}
            </span>
          </Link>
        )
      })}
    </div>
  )
}

function positionOf(lat: number, lon: number) {
  const { x, y } = projectToMap(lat, lon)
  return { left: `${x * 100}%`, top: `${y * 100}%` }
}

function PinIcon() {
  // An 8x11 pixel pin, drawn on the pixel grid.
  return (
    <svg
      viewBox="0 0 8 11"
      className="block h-[22px] w-4 transition-transform group-hover:-translate-y-0.5 group-focus-visible:-translate-y-0.5 sm:h-[27px] sm:w-5"
      style={{ shapeRendering: 'crispEdges' }}
    >
      <path d="M2 0h4v1h1v1h1v4H7v1H6v2H5v2H3V9H2V7H1V6H0V2h1V1h1z" fill="#2a2233" />
      <path d="M2 1h4v1h1v4H6v1H5v2H3V7H2V6H1V2h1z" fill="#e04434" />
      <path d="M3 3h2v2H3z" fill="#f4ecd8" />
    </svg>
  )
}

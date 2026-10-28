/** Lisbon's sky as the house shows it through the windows and on the balcony. */
export type Weather = 'clear' | 'cloudy' | 'rain' | 'storm'

const WEATHERS: readonly Weather[] = ['clear', 'cloudy', 'rain', 'storm']

export function isWeather(value: unknown): value is Weather {
  return WEATHERS.includes(value as Weather)
}

/**
 * Folds a WMO weather code (what Open-Meteo reports) into the house's four
 * skies. Fog counts as cloud, and the odd sleet or snow as rain; anything
 * unknown stays clear.
 */
export function weatherFromCode(code: unknown): Weather {
  if (typeof code !== 'number') return 'clear'
  if (code >= 95) return 'storm'
  if (code >= 51) return 'rain'
  if (code >= 2) return 'cloudy'
  return 'clear'
}

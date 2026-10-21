'use client'

import { createContext, useContext } from 'react'

/**
 * Leaves the current overlay page for `href` (the house is '/'). Provided by
 * the house shell, which knows the page the visitor came from: going back to
 * it steps back through history, so the browser's Back button doesn't reopen
 * what was just closed.
 */
export const HouseNavigationContext = createContext<(href: string) => void>(() => undefined)

export function useLeaveTo() {
  return useContext(HouseNavigationContext)
}

'use client'

import { usePathname, useRouter } from 'next/navigation'
import { createContext, useContext, useEffect, useRef } from 'react'

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

/** Marks a history entry that belongs to a layer (a panel, dialogue or lightbox) rather than a page. */
const LAYER_KEY = 'houseLayer'

function onLayerEntry(): boolean {
  return window.history.state?.[LAYER_KEY] === true
}

/** Set while a layer hands its history entry over to a page, so closing the layer doesn't step back. */
let handingOver = false

/**
 * Opens a page from wherever the visitor is. From an open layer the page
 * takes over the layer's history entry, so Back from the page goes to what
 * was under the layer instead of to the closed layer.
 */
export function openPage(router: ReturnType<typeof useRouter>, href: string) {
  if (onLayerEntry()) {
    handingOver = true
    router.replace(href, { scroll: false })
  } else {
    router.push(href, { scroll: false })
  }
}

/**
 * Gives something drawn over the page its own history entry while `open`, at
 * the same URL, so the browser's Back (or a phone's swipe back) calls
 * `onBack` to close it instead of leaving the page. Closing it any other way
 * steps back over that entry, so no dead entry is left behind. Layers that
 * take over from one another while open share one entry.
 */
export function useHistoryLayer(open: boolean, onBack: () => void) {
  const pathname = usePathname()
  const handler = useRef(onBack)
  const isOpen = useRef(open)
  // The path the layer opened on, while it holds an entry.
  const openedOn = useRef<string | null>(null)
  // Steps back we took ourselves, whose popstate isn't the visitor pressing Back.
  const ownPops = useRef(0)

  useEffect(() => {
    handler.current = onBack
  })

  useEffect(() => {
    handingOver = false
  }, [pathname])

  useEffect(() => {
    isOpen.current = open
    if (open) {
      openedOn.current ??= window.location.pathname
      if (!onLayerEntry()) window.history.pushState({ [LAYER_KEY]: true }, '')
    } else if (openedOn.current !== null) {
      const samePage = openedOn.current === window.location.pathname
      openedOn.current = null
      if (samePage && onLayerEntry() && !handingOver) {
        ownPops.current++
        window.history.back()
      }
    }
  }, [open])

  useEffect(() => {
    function onPopState() {
      if (ownPops.current > 0) {
        ownPops.current--
        // Reopened before the step back landed, so it needs its entry again.
        if (isOpen.current && !onLayerEntry()) window.history.pushState({ [LAYER_KEY]: true }, '')
        return
      }
      if (isOpen.current && !onLayerEntry()) handler.current()
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])
}

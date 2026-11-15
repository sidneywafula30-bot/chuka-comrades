import { useCallback, useEffect, useState } from 'react'

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

let deferred: InstallEvent | null = null
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((l) => l())

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e as InstallEvent; notify() })
  window.addEventListener('appinstalled', () => { deferred = null; notify() })
}

export const SITE_URL = typeof window !== 'undefined' ? window.location.origin + import.meta.env.BASE_URL : ''
export const SHARE_TEXT = 'Join Chuka Comrades, your campus hub for hostels, soko, CPL, study labs and more 👉'

export function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
}
export function isMobile() {
  return /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent)
}
export function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

export function shareToWhatsApp() {
  const url = `https://wa.me/?text=${encodeURIComponent(`${SHARE_TEXT} ${SITE_URL}`)}`
  window.open(url, '_blank', 'noopener,noreferrer')
}

/** canInstall: Android/desktop Chrome can show the real prompt. iosHelp: iPhones need the manual steps. */
export function useInstall() {
  const [, force] = useState(0)
  useEffect(() => {
    const l = () => force((n) => n + 1)
    listeners.add(l)
    return () => { listeners.delete(l) }
  }, [])
  const install = useCallback(async () => {
    if (!deferred) return false
    await deferred.prompt()
    const { outcome } = await deferred.userChoice
    deferred = null
    notify()
    return outcome === 'accepted'
  }, [])
  const installed = typeof window !== 'undefined' && isStandalone()
  const ios = !installed && isIos()
  // Everyone else who hasn't installed: real prompt if the browser gave us one, otherwise manual steps.
  return { installed, canInstall: !!deferred && !installed, iosHelp: ios, manualHelp: !installed && !ios && !deferred, install }
}

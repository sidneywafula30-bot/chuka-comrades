import { useEffect, useState } from 'react'
import { ef } from './efootball'

/** Loads one server action, optionally refreshing every `pollMs` while the tab is visible. Reloads when the payload changes. */
export function useApi<T>(action: string, payload: Record<string, unknown> = {}, pollMs = 0, enabled = true) {
  const key = JSON.stringify(payload)
  const [data, setData] = useState<T | null>(null)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(enabled)
  const [n, setN] = useState(0)
  useEffect(() => {
    if (!enabled) { setLoading(false); return }
    let dead = false
    const run = () => ef<T>(action, JSON.parse(key) as Record<string, unknown>)
      .then((r) => { if (!dead) { setData(r); setErr('') } })
      .catch((e) => { if (!dead) setErr((e as Error).message) })
      .finally(() => { if (!dead) setLoading(false) })
    setLoading(true); void run()
    if (!pollMs) return () => { dead = true }
    const i = setInterval(() => { if (!document.hidden) void run() }, pollMs)
    return () => { dead = true; clearInterval(i) }
  }, [action, key, pollMs, enabled, n])
  return { data, err, loading, retry: () => setN((x) => x + 1) }
}

/** Re-renders every second (for countdowns). */
export function useTick() {
  const [, set] = useState(0)
  useEffect(() => { const i = setInterval(() => set((n) => n + 1), 1000); return () => clearInterval(i) }, [])
}

/** Time left to a deadline by the SERVER clock (skew = server time minus this phone's time), so a wrong phone clock cannot hide a form. Empty once passed. */
export function useCountdown(iso: string, skew: number) {
  useTick()
  const ms = Date.parse(iso) - (Date.now() + skew)
  if (!iso || !(ms > 0)) return ''
  const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60)
  return h ? `${h}h ${m}m` : `${m}m ${String(s % 60).padStart(2, '0')}s`
}

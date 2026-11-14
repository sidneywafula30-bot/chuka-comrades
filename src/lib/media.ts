/** Chuka Music & Movies: calls its own Apps Script web app (VITE_MEDIA_API_URL = the /exec link). */
const API = import.meta.env.VITE_MEDIA_API_URL as string | undefined
export const mediaReady = Boolean(API)

export type AudiusTrack = {
  id: string; title: string; artist: string; genre: string; duration: number
  artwork: string; streamUrl: string; pageUrl: string
}
export type AppleTrack = {
  id: string; title: string; artist: string; album: string; artwork: string; storeUrl: string; duration: number
}
export type MusicResult = { audius: AudiusTrack[]; apple: AppleTrack[]; warnings: string[] }

export type MovieCategory = 'full' | 'trailers' | 'kenyan' | 'nollywood' | 'animation'
export const MOVIE_CATEGORIES: { id: MovieCategory; label: string }[] = [
  { id: 'full', label: 'Full movies' },
  { id: 'trailers', label: 'Trailers' },
  { id: 'kenyan', label: 'Kenyan' },
  { id: 'nollywood', label: 'Nollywood' },
  { id: 'animation', label: 'Animation' },
]
export type Movie = { videoId: string; title: string; channel: string; publishedAt: string; thumb: string; watchUrl: string }
export type MovieResult = { category: MovieCategory; videos: Movie[] }

async function call<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  if (!API) throw new Error('Music & Movies server not connected yet. Add VITE_MEDIA_API_URL to .env.')
  let res: Response
  try {
    // text/plain avoids a CORS preflight, which Apps Script cannot answer.
    res = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action, ...payload }) })
  } catch {
    throw new Error('Could not reach the Music & Movies server. Check your internet and that the deployment access is "Anyone".')
  }
  let j: { ok: boolean; data?: unknown; error?: string }
  try { j = await res.json() }
  catch { throw new Error('The server sent an unexpected reply. In Apps Script use Deploy > Manage deployments > Edit > New version.') }
  if (!j.ok) throw new Error(j.error || 'Request failed')
  return j.data as T
}

export const mediaApi = {
  music: (query: string) => call<MusicResult>(query.trim() ? 'searchMusic' : 'trendingMusic', { query }),
  movies: (query: string, category: MovieCategory) => call<MovieResult>('searchMovies', { query, category }),
}

export function fmtDuration(seconds: number): string {
  if (!seconds || seconds < 1) return ''
  const m = Math.floor(seconds / 60), s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

/** YouTube titles arrive HTML-escaped (&amp; &#39;). */
export function decodeHtml(s: string): string {
  return new DOMParser().parseFromString(s, 'text/html').documentElement.textContent || s
}

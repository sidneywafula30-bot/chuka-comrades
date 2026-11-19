import { auth } from './firebase'
import { fileToB64 } from './files'

/** Chuka O-Zone Apps Script web app URL (the /exec link). A separate script from CPL, Hostels, Music and eFootball. */
const API = import.meta.env.VITE_OZONE_API_URL as string | undefined
export const ozReady = Boolean(API)

export type Media = { type: 'image' | 'video'; url: string; thumb: string }
export type Upload = { name: string; data: string }
export type Support = { message: string; lines: string[] }

export type Config = {
  name: string; version: string; adminWhatsapp: string; siteUrl: string; electionMode: boolean; positions: string[]
  confessionCategories: Record<string, string>; issueCategories: Record<string, string>
  hookup: { genders: string[]; ageBands: string[]; lookingFor: string[] }
  limits: {
    confessionMax: number; confessionPerDay: number; issueTitleMax: number; issueMax: number; questionMax: number; manifestoWords: number
    vibeMax: number; introNoteMax: number; imageBytes: number; videoBytes: number; maxMedia: number; galleryMax?: number
  }
  studentEmailRequired: boolean; support: Support; youtubeUrl?: string; whatsappGroupUrl?: string; newsEnabled?: boolean
}
export type TrendItem = { key: string; id: number; source: 'youtube' | 'tiktok'; videoId: string; url: string; title: string; author: string; thumb: string; vertical: boolean; pinned: boolean; live: boolean; createdAt: string }
export type TrendList = { live: TrendItem | null; items: TrendItem[]; next: number | null }
export type Me = { signedIn: boolean; isAdmin?: boolean; email?: string; banned?: boolean; studentOk?: boolean; profile?: { code: string; status: string } | null }

export type Post = { number: number; category: string; categoryLabel: string; text: string; media: Media[]; replyTo: number | null; replies: number; publishedAt: string }
export type Page<T> = { items: T[]; nextBefore: number | null }

export type IssueStatus = 'verified' | 'sent' | 'responded' | 'resolved' | 'no_response'
export type Issue = {
  id: number; facultyCode: string; facultyName: string; category: string; categoryLabel: string; title: string; details: string; media: Media[]
  evidence: 'confirmed' | 'reported' | 'unverified'; status: IssueStatus; meToo: number; aspirantId?: number | null
  publishedAt: string; sentAt: string; respondedAt: string; resolvedAt: string
}
export type IssueUpdate = { kind: string; note: string; at: string }
export type IssueFull = Issue & { updates: IssueUpdate[]; iMeToo: boolean }

export type Score = { total: number; sent: number; responded: number; resolved: number; noResponse: number; avgReplyDays: number | null }
export type Faculty = { code: string; name: string; url: string; score: Score }
export type Leader = { id: number; role: string; name: string; term: string; sourceUrl: string; status: string }
export type Aspirant = { id: number; facultyCode: string; position: string; name: string; yearCourse: string; manifesto: string; photo: string; contact: string; status: string; sourceUrl: string; whatsappUrl: string; links: { label: string; url: string }[]; gallery: Media[]; acceptIssues?: boolean }
export type AspirantFull = { aspirant: Aspirant; issues: Issue[] }
export type MyAspirant = { id: number; name: string; position: string; facultyCode: string; status: string; acceptIssues: boolean }
export type NewsItem = { id: string; title: string; summary: string; url: string; image: string; source: string; publishedAt: string; topic: 'politics' | 'general'; via: string }
export type NewsList = { items: NewsItem[]; next: number | null; fetchedAt: string; note: string }
export type AspirantGroup = { position: string; aspirants: Aspirant[] }
export type FacultyFull = { code: string; name: string; url: string; score: Score; leaders: Leader[]; electionMode: boolean; aspirants?: AspirantGroup[] }
export type Question = { id: number; facultyCode: string; position: string; question: string; votes: number; deadline: string; answers: { aspirantId: number; name: string; text: string; at: string }[] }
export type Promise_ = { id: number; office: string; promise: string; sourceUrl: string; due: string; status: 'pending' | 'delivered' | 'missed' }
export type Poll = { id: number; question: string; options: string[]; open: boolean; closesAt: string; counts: number[] | null; total: number | null; myVote: number | null }

export function avatarFor(gender: string, code: string): string {
  const pool = gender === 'Female' ? 'female' : gender === 'Male' ? 'male' : 'male'
  let n = 0
  for (let i = 0; i < code.length; i++) n = (n * 31 + code.charCodeAt(i)) >>> 0
  return `${import.meta.env.BASE_URL}ozone/avatars/${pool}/A${String((n % 12) + 1).padStart(2, '0')}.svg`
}

export type HookupCard = { code: string; gender: string; ageBand: string; lookingFor: string; vibe: string; tags: string[]; photo: string; publishedAt: string }
export type MyProfile = { profile: HookupCard | null; status?: string; realName?: string; phone?: string }
export type IntroRow = { id: number; targetCode: string; status: string; label: string; createdAt: string }

/** Calls the O-Zone Apps Script. Sends the Firebase ID token when signed in; the server verifies it. */
export async function oz<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  if (!API) throw new Error('O-Zone server not connected yet. Add VITE_OZONE_API_URL to .env.')
  const idToken = await auth?.currentUser?.getIdToken()
  // text/plain avoids a CORS preflight, which Apps Script cannot answer.
  const send = () => fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action, idToken, ...payload }) })
  let res: Response
  try { res = await send() }
  catch {
    try { res = await send() }
    catch { throw new Error('Could not reach the O-Zone server. Check your internet and that the deployment is set to "Anyone".') }
  }
  let j: { ok: boolean; data?: unknown; error?: string }
  try { j = await res.json() }
  catch { throw new Error('The O-Zone server sent an unexpected reply. In Apps Script use Deploy > Manage deployments > Edit > New version, then try again.') }
  if (!j.ok) throw new Error(j.error || 'Request failed')
  return j.data as T
}

export const waLink = (n: string, text = '') => `https://wa.me/${n}${text ? `?text=${encodeURIComponent(text)}` : ''}`
export const pad = (n: number, w = 4) => String(n).padStart(w, '0')

/** Link to a page inside O-Zone, on the site the person is using now. path example: 'thread/42' ('' = O-Zone home). */
export const ozLink = (path = '') => `${window.location.origin}${window.location.pathname}#/ozone${path ? `/${path}` : ''}`
/** Opens WhatsApp's chooser (contacts and groups) with the message ready to send. */
export const waShare = (message: string) => `https://wa.me/?text=${encodeURIComponent(message)}`
/** Short one-line preview of a longer text. */
export const snip = (s: string, n = 200) => { const t = s.replace(/\s+/g, ' ').trim(); return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t }

const TZ = 'Africa/Nairobi'
export const ago = (iso: string): string => {
  if (!iso) return ''
  const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`
  if (s < 86400 * 7) return `${Math.floor(s / 86400)} d ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: TZ })
}
export const day = (iso: string) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: TZ }) : '')
export const stamp = (iso: string) => (iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: TZ }) : '')

export const ISSUE_STATUS: Record<string, string> = {
  verified: 'Verified', sent: 'Sent to office', responded: 'Office responded', resolved: 'Resolved', no_response: 'No response',
}
export const POLL_OPEN = 'open'

/* ------------------------------------------------------------------ */
/* Media prep. The server cannot strip GPS/EXIF, so every photo is     */
/* re-drawn on a canvas and exported as a fresh JPEG here.             */
/* ------------------------------------------------------------------ */

function loadImage(file: File): Promise<HTMLImageElement & { revoke: () => void }> {
  return new Promise((ok, no) => {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { no(new Error('Photos must be JPG, PNG or WEBP.')); return }
    const url = URL.createObjectURL(file)
    const im = new Image() as HTMLImageElement & { revoke: () => void }
    im.revoke = () => URL.revokeObjectURL(url)
    im.onload = () => ok(im)
    im.onerror = () => { URL.revokeObjectURL(url); no(new Error('Could not read that photo.')) }
    im.src = url
  })
}

export type Prepared = Upload & { preview: string }

/** Re-draws a photo as a clean JPEG (no EXIF/GPS). Shrinks until it fits under `maxBytes`. */
export async function cleanPhoto(file: File, maxBytes: number, max = 1400): Promise<Prepared> {
  const im = await loadImage(file)
  try {
    let size = max, q = 0.82
    for (let i = 0; i < 6; i++) {
      const s = Math.min(1, size / Math.max(im.width, im.height))
      const c = document.createElement('canvas')
      c.width = Math.max(1, Math.round(im.width * s)); c.height = Math.max(1, Math.round(im.height * s))
      const g = c.getContext('2d')
      if (!g) throw new Error('Could not process the photo.')
      g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height)
      g.drawImage(im, 0, 0, c.width, c.height)
      const url = c.toDataURL('image/jpeg', q)
      const data = url.split(',')[1] ?? ''
      if (data.length * 0.75 <= maxBytes * 0.9) return { name: file.name.replace(/\.[^.]+$/, '') + '.jpg', data, preview: url }
      size = Math.round(size * 0.8); q = Math.max(0.6, q - 0.05)
    }
    throw new Error('That photo is still too big. Pick a smaller one.')
  } finally { im.revoke() }
}

/** A strongly blurred copy for the public hookup card. Works on Safari too (no reliance on ctx.filter). */
export async function blurredCopy(file: File): Promise<Prepared> {
  const im = await loadImage(file)
  try {
    const s = Math.min(1, 480 / Math.max(im.width, im.height))
    const W = Math.max(1, Math.round(im.width * s)), H = Math.max(1, Math.round(im.height * s))
    const tiny = document.createElement('canvas')
    tiny.width = Math.max(4, Math.round(W / 22)); tiny.height = Math.max(4, Math.round(H / 22))
    const tg = tiny.getContext('2d')
    const c = document.createElement('canvas')
    c.width = W; c.height = H
    const g = c.getContext('2d')
    if (!tg || !g) throw new Error('Could not process the photo.')
    tg.drawImage(im, 0, 0, tiny.width, tiny.height)
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H)
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'
    g.drawImage(tiny, 0, 0, W, H)
    // Second pass where the browser supports it, so the blocks melt into a smooth blur.
    const c2 = document.createElement('canvas'); c2.width = W; c2.height = H
    const g2 = c2.getContext('2d')
    if (g2 && 'filter' in g2) { g2.filter = 'blur(10px)'; g2.drawImage(c, 0, 0); }
    const out = g2 && 'filter' in g2 ? c2 : c
    const url = out.toDataURL('image/jpeg', 0.7)
    return { name: 'blur.jpg', data: url.split(',')[1] ?? '', preview: url }
  } finally { im.revoke() }
}

/** Checks a video's size and length, then returns it as base64. Apps Script cannot take big uploads. */
export async function prepVideo(file: File, maxBytes: number, maxSeconds = 30): Promise<Upload & { preview: string }> {
  if (!/^video\/(mp4|webm)$/.test(file.type)) throw new Error('Videos must be MP4 or WEBM. Phone videos in other formats: trim and export as MP4 first.')
  if (file.size > maxBytes) throw new Error(`Video is too big (max ${Math.round(maxBytes / 1e6)} MB). Trim it to under ${maxSeconds} seconds.`)
  const url = URL.createObjectURL(file)
  try {
    const dur = await new Promise<number>((ok) => {
      const v = document.createElement('video')
      v.preload = 'metadata'
      v.onloadedmetadata = () => ok(v.duration)
      v.onerror = () => ok(0)
      v.src = url
    })
    if (dur > maxSeconds + 1) throw new Error(`Video is ${Math.round(dur)} seconds long. Keep it under ${maxSeconds}.`)
  } finally { URL.revokeObjectURL(url) }
  return { name: file.name, data: await fileToB64(file), preview: '' }
}

/** Admin images: Drive thumbnails only load if the admin is signed in to Google in this browser, so fall back to the API. */
export function driveIdFrom(url: string): string {
  const m = /[?&]id=([^&]+)/.exec(url) || /\/d\/([^/=?]+)/.exec(url)
  return m ? decodeURIComponent(m[1]) : ''
}

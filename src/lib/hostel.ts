import { auth } from './firebase'

/** Hostel Apps Script web app URL (the /exec link). A separate script from the CPL one. */
const API = import.meta.env.VITE_HOSTEL_API_URL as string | undefined
export const hostelReady = Boolean(API)

export const STUDENT_GROUP_URL =
  (import.meta.env.VITE_HOSTEL_STUDENT_GROUP as string) || 'https://chat.whatsapp.com/BhLqKOxHjigHF3oH6fyuFM'
export const LANDLORD_GROUP_URL =
  (import.meta.env.VITE_HOSTEL_LANDLORD_GROUP as string) || 'https://chat.whatsapp.com/FDizebVp5qP0yr91lnNduG'
/** Hostel admin WhatsApp. Fixed here (like the O-Zone admin) so every hostel button uses the same number. */
export const ADMIN_WHATSAPP = '254792545125'

/** The Chuka Hostel WhatsApp bot number (same account the agent is logged into). */
export const BOT_WHATSAPP = (import.meta.env.VITE_HOSTEL_BOT_WHATSAPP as string) || '254184198432'

export const MAX_PHOTOS = 3

export type Period = 'month' | 'semester'
export type RoomType = { type: string; rent: number; period: Period; total: number; available: number }
export type ProvidedState = 'included' | 'extra'
export type HostelImage = { id: string; url: string }
export type HostelStatus = 'published' | 'hidden'

export type Hostel = {
  id: string; status: HostelStatus; name: string; area: string; landmark: string; walkingTime: string
  locationUrl: string; description: string
  landlordName: string; landlordContact: string // only filled for students when the landlord agreed to show them
  showContact: boolean
  roomTypes: RoomType[]; provided: Record<string, ProvidedState>
  deposit: string; rules: string; images: HostelImage[]; verified: boolean
  roomsUpdatedAt: string; createdAt: string; updatedAt: string
  freePreview: boolean
}

/** Semester dates and prices, kept in the Apps Script (Admin desk > Semester). Dates are yyyy-mm-dd. */
export type Settings = {
  semesterName: string; semesterStart: string; semesterEnd: string
  hostelPrice: number; roommatePrice: number; payNote: string
}
export const DEFAULT_SETTINGS: Settings = { semesterName: '', semesterStart: '', semesterEnd: '', hostelPrice: 150, roommatePrice: 100, payNote: '' }

/** What the server returns to a student: either everything (paid / admin) or one free preview hostel. */
export type HostelList = {
  hostels: Hostel[]; locked: boolean; lockedCount: number; signedIn: boolean; accessUntil: string; settings: Settings
}
export type AccessRow = { email: string; activatedAt: string; expiresAt: string; mpesaCode: string; activatedBy: string; active: boolean }

/** One student account shared by the website and the WhatsApp bot (matched by Google email / WhatsApp number). */
export type StudentMe = {
  registered: boolean
  status: 'pending' | 'approved' | 'rejected' | ''
  fullName: string
  phone: string // 2547XXXXXXXX, the WhatsApp number linked to this account
  source: 'website' | 'whatsapp' | ''
  subscriptionActive: boolean
  accessUntil: string
}

/** What the admin sends when adding or editing a hostel. */
export type HostelInput = Omit<Hostel, 'id' | 'images' | 'roomsUpdatedAt' | 'createdAt' | 'updatedAt'>
export type UploadImage = { name: string; mime: string; data: string } // data = base64 without the data: prefix

/** Everything the admin can tick as "provided". Keys must match the Apps Script. */
export const PROVIDED_ITEMS: { key: string; label: string }[] = [
  { key: 'water', label: 'Water' },
  { key: 'electricity', label: 'Electricity' },
  { key: 'wifi', label: 'WiFi' },
  { key: 'security', label: 'Security (guard / CCTV)' },
  { key: 'bed', label: 'Bed' },
  { key: 'chair', label: 'Chair' },
  { key: 'table', label: 'Table' },
]
export const providedLabel = (key: string) => PROVIDED_ITEMS.find((p) => p.key === key)?.label ?? key

/** Old listings may still carry retired keys (cooking, bin, laundry...). Show only today's list; "furnished" used to mean the bed. */
export function cleanProvided(map: Record<string, ProvidedState>): [string, ProvidedState][] {
  const m: Record<string, ProvidedState> = { ...map }
  if (!m.bed && m.furnished) m.bed = m.furnished
  return PROVIDED_ITEMS.filter((p) => m[p.key]).map((p) => [p.key, m[p.key]] as [string, ProvidedState])
}

export const ROOM_TYPE_SUGGESTIONS = ['Bedsitter', 'Single room', 'Double sharing', 'Self-contained single', 'One bedroom']

/** Calls the hostel Apps Script. Sends the Firebase ID token when signed in; the server verifies it. */
async function call<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  if (!API) throw new Error('Hostel server not connected yet. Add VITE_HOSTEL_API_URL to .env.')
  const idToken = await auth?.currentUser?.getIdToken()
  // text/plain avoids a CORS preflight, which Apps Script cannot answer.
  const send = () => fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, idToken, ...payload }),
  })
  let res: Response
  try { res = await send() }
  catch {
    try { res = await send() } // one quick retry for a dropped connection
    catch { throw new Error('Could not reach the hostel server. Check your internet and that the deployment is set to "Anyone".') }
  }
  let j: { ok: boolean; data?: unknown; error?: string }
  try { j = await res.json() }
  catch { throw new Error('The hostel server sent an unexpected reply. In Apps Script use Deploy > Manage deployments > Edit > New version.') }
  if (!j.ok) throw new Error(j.error || 'Request failed')
  return j.data as T
}

export const hostelApi = {
  list: () => call<HostelList>('list'),
  adminCheck: () => call<{ isAdmin: boolean }>('admin_check'),
  adminList: () => call<Hostel[]>('admin_list'),
  create: (hostel: HostelInput, newImages: UploadImage[]) => call<Hostel>('create', { hostel, newImages }),
  update: (id: string, hostel: Partial<HostelInput>, photos: { removeImageIds?: string[]; newImages?: UploadImage[] } = {}) =>
    call<Hostel>('update', { id, hostel, ...photos }),
  updateRooms: (id: string, rooms: { type: string; available: number }[]) => call<Hostel>('update_rooms', { id, rooms }),
  remove: (id: string) => call<{ deleted: boolean }>('delete', { id }),
  accessList: () => call<AccessRow[]>('access_list'),
  accessGrant: (email: string, mpesaCode: string, expiresOn?: string) => call<AccessRow[]>('access_grant', { email, mpesaCode, expiresOn }),
  accessRevoke: (email: string) => call<AccessRow[]>('access_revoke', { email }),
  saveSettings: (settings: Settings) => call<Settings>('settings_save', { settings }),
  studentMe: () => call<StudentMe>('student_web_me'),
  studentRegister: (fullName: string, phone: string, studentCard: UploadImage) =>
    call<StudentMe>('student_web_register', { fullName, phone, studentCard }),
}

/* ---------- helpers ---------- */

/** Same rule as the server: only real Google Maps links. */
export const isGoogleMapsUrl = (url: string) =>
  /^https:\/\/(((www|maps)\.)?google\.[a-z.]{2,6}\/maps|maps\.app\.goo\.gl\/|goo\.gl\/maps\/)/i.test(url.trim())

export const kes = (n: number) => `KSh ${Number(n).toLocaleString('en-KE')}`
export const digits = (s: string) => s.replace(/\D/g, '')
export const waLink = (phone: string, message: string) => `https://wa.me/${digits(phone)}?text=${encodeURIComponent(message)}`
/** 254712345678 -> 0712 345 678 */
export function showPhone(p: string) {
  const d = digits(p)
  if (d.length === 12 && d.startsWith('254')) { const l = `0${d.slice(3)}`; return `${l.slice(0, 4)} ${l.slice(4, 7)} ${l.slice(7)}` }
  return p
}

export const roomTotals = (h: Pick<Hostel, 'roomTypes'>) =>
  h.roomTypes.reduce((a, r) => ({ total: a.total + r.total, available: a.available + r.available }), { total: 0, available: 0 })
export const isFull = (h: Pick<Hostel, 'roomTypes'>) => roomTotals(h).available === 0

export function timeAgo(iso: string): string {
  const t = Date.parse(iso)
  if (isNaN(t)) return ''
  const mins = Math.floor((Date.now() - t) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} hr ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days} day${days > 1 ? 's' : ''} ago`
  return new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}
/** Room counts older than this get an "may be outdated" hint. */
export const isStale = (iso: string) => { const t = Date.parse(iso); return !isNaN(t) && Date.now() - t > 14 * 86400000 }

/** Shrinks a photo to max 1400px JPEG so uploads stay small and fast on mobile data. */
export function compressImage(file: File): Promise<UploadImage & { preview: string }> {
  return new Promise((resolve, reject) => {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { reject(new Error('Photos must be JPG, PNG or WEBP.')); return }
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, 1400 / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      const ctx = canvas.getContext('2d')
      if (!ctx) { URL.revokeObjectURL(url); reject(new Error('Could not process the photo.')); return }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.82)
      URL.revokeObjectURL(url)
      resolve({ name: file.name.replace(/\.[^.]+$/, '') + '.jpg', mime: 'image/jpeg', data: dataUrl.split(',')[1], preview: dataUrl })
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read that photo.')) }
    img.src = url
  })
}

/* ---------- semester + payment helpers ---------- */

export const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const parseYmd = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }
export const niceDate = (s: string) => (/^\d{4}-\d{2}-\d{2}$/.test(s) ? parseYmd(s).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' }) : '')
export const niceDateTime = (iso: string) => { const t = Date.parse(iso); return isNaN(t) ? '' : new Date(t).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' }) }

export type SemesterInfo = { set: boolean; start: Date | null; end: Date | null; totalDays: number; dayNumber: number; daysLeft: number; progress: number; phase: 'upcoming' | 'running' | 'ended' | 'unset' }
export function semesterInfo(s: Settings, today = new Date()): SemesterInfo {
  const ok = /^\d{4}-\d{2}-\d{2}$/.test(s.semesterStart) && /^\d{4}-\d{2}-\d{2}$/.test(s.semesterEnd)
  if (!ok) return { set: false, start: null, end: null, totalDays: 0, dayNumber: 0, daysLeft: 0, progress: 0, phase: 'unset' }
  const start = parseYmd(s.semesterStart), end = parseYmd(s.semesterEnd)
  const t = parseYmd(ymd(today)), DAY = 86400000
  const totalDays = Math.round((end.getTime() - start.getTime()) / DAY) + 1
  const dayNumber = Math.round((t.getTime() - start.getTime()) / DAY) + 1
  const phase = t < start ? 'upcoming' : t > end ? 'ended' : 'running'
  return { set: true, start, end, totalDays, dayNumber, daysLeft: Math.max(0, Math.round((end.getTime() - t.getTime()) / DAY)), progress: Math.min(1, Math.max(0, dayNumber / totalDays)), phase }
}

/** "Add to Google Calendar" link for an all-day event. Google wants the END date to be the day after. */
export function googleCalendarLink(title: string, from: string, to = from): string {
  const compact = (s: string) => s.replace(/-/g, '')
  const after = parseYmd(to); after.setDate(after.getDate() + 1)
  const q = new URLSearchParams({ action: 'TEMPLATE', text: title, dates: `${compact(from)}/${compact(ymd(after))}` })
  return `https://calendar.google.com/calendar/render?${q.toString()}`
}

/** WhatsApp message a student sends the admin after paying. Includes the email so the admin can activate it. */
export function paymentLink(kind: 'hostels' | 'roommate', email: string, price: number): string {
  const what = kind === 'hostels' ? 'unlock all hostels' : 'post a roommate request'
  return waLink(ADMIN_WHATSAPP, `Hello Chuka Comrades admin, I have paid KSh ${price} to ${what} this semester.\nMy Google email: ${email}\nM-Pesa code: `)
}

import { auth } from './firebase'

/** Chuka eFootball Apps Script web app URL (the /exec link). A separate script from CPL and Hostels. */
const API = import.meta.env.VITE_EFOOTBALL_API_URL as string | undefined
export const efReady = Boolean(API)

export const PLATFORMS = ['Mobile', 'PC', 'PlayStation', 'Xbox'] as const
export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const
export const PARTS = ['Morning', 'Afternoon', 'Evening', 'Night'] as const

export type Video = { videoId: string; title: string; description: string; channelTitle?: string; publishedAt: string; thumb: string }
export type VideoResult = { videos: Video[]; warning?: string }
export type VideoCategory = 'highlights' | 'goals' | 'skills' | 'tips' | 'formations' | 'updates'

/** `chat` = the player turned the WhatsApp button on (everyone sees the button). `whatsapp` = the number, sent only to signed-in registered players. */
export type PublicPlayer = { uid: string; username: string; name: string; course: string; year: number; platform: string; strength: number; squadId: string; canHost: boolean; freeTimes: string[]; inLeague: boolean; fpl?: boolean; chat?: boolean; whatsapp?: string }
export type Profile = Omit<PublicPlayer, 'whatsapp'> & {
  fullName: string; whatsapp: string; status: string; email: string; showWhatsapp: boolean; paused: boolean; strikes: number; leagueOpen?: boolean; fplId?: string; fplTeam?: string
  /** Class-league money: the fee the first member set, who that is ('me' | 'other' | '' = nobody yet), and whether my payment waits for the admin. */
  leagueFee?: number; leagueFounder?: '' | 'me' | 'other'; leaguePending?: boolean
}
export type ProfileInput = {
  username: string; fullName: string; course: string; year: number; platform: string; strength: number
  whatsapp: string; freeTimes: string[]; canHost: boolean; showWhatsapp: boolean; squad?: string
}
export type Course = { name: string; department: string; level: string; league?: boolean }
export type AdminCourse = Course & { campuses: string; active: boolean; league: boolean; players: number; interested: number; fee: number; founder: string }

export type MatchView = {
  id: string; week: string; day: string; deadline: string; note: string; status: 'pending' | 'disputed' | 'confirmed' | 'void'
  myClaim: { mine: number; theirs: number } | null; oppReported: boolean; final: { mine: number; theirs: number } | null
  opp: { uid: string; username: string; platform: string; strength: number; course: string; whatsapp: string; freeTimes: string[] }
}
export type Me = { uid: string; email: string; isAdmin: boolean; profile: Profile | null; tid: string; joined: boolean; entry: '' | 'pending' | 'paid'; pending: { kind: PayKind; ref: string }[]; matches: MatchView[] }

export type PoolMember = { uid: string; username: string; strength: number; platform: string; course: string; squadId: string }
export type PoolStatus = 'waiting' | 'reported' | 'disputed' | 'locked'
export type Pool = {
  id: string; stage: number; idx: number; hostUid: string; backupUid: string; members: PoolMember[]; winnerUid: string
  proofId: string; status: PoolStatus; reportedBy: string; reportedAt: string; disputes: number; note: string
}
export type Tournament = {
  id: string; name: string; logoId: string; rules: string; token: string; status: 'open' | 'running' | 'done'
  stages: number; round: number; regClose: string; cap: number; windows: [string, string][]; count: number; pending?: number; fee?: number
  champion: PoolMember | null; pools: Pool[]; serverNow: number
}
export type Champion = { name: string; date: string; username: string; course: string; squadId: string }

export type LeagueRow = { uid: string; username: string; course: string; platform: string; strength: number; squadId: string; p: number; w: number; d: number; l: number; gf: number; ga: number; gd: number; pts: number }
export type CourseRow = { course: string; players: number; pts: number; avg: number; ranked: boolean; fee?: number; paid?: number; pool?: number; founder?: string }
export type League = {
  table: LeagueRow[]; courses: CourseRow[]; recent: { id: string; p1: string; p2: string; s1: number; s2: number; at: string }[]; registered: number; week: string
  openCourses: string[]; today: string; fixtureToday: boolean; closeAt: string; fixtureDays: string[]; closeHour: number; serverNow: number
}

export type Attention = {
  id: string; idx: number; why: string; status: string; hostUid: string; winnerUid: string; proofId: string; note: string
  disputes: { uid: string; reason: string }[]; members: { uid: string; username: string; whatsapp: string }[]
}

/** Calls the eFootball Apps Script. Sends the Firebase ID token when signed in; the server verifies it. */
export async function ef<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  if (!API) throw new Error('eFootball server not connected yet. Add VITE_EFOOTBALL_API_URL to .env.')
  const idToken = await auth?.currentUser?.getIdToken()
  // text/plain avoids a CORS preflight, which Apps Script cannot answer.
  const send = () => fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action, idToken, ...payload }) })
  let res: Response
  try { res = await send() }
  catch {
    try { res = await send() }
    catch { throw new Error('Could not reach the eFootball server. Check your internet and that the deployment is set to "Anyone".') }
  }
  let j: { ok: boolean; data?: unknown; error?: string }
  try { j = await res.json() }
  catch { throw new Error('The eFootball server sent an unexpected reply. In Apps Script use Deploy > Manage deployments > Edit > New version, then try again.') }
  if (!j.ok) throw new Error(j.error || 'Request failed')
  return j.data as T
}

/** Drive image id -> a URL an <img> can show. */
export const driveImg = (id: string, w = 480) => (id ? `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w${w}` : '')
export const waLink = (n: string, text = '') => `https://wa.me/${waDigits(n)}${text ? `?text=${encodeURIComponent(text)}` : ''}`

const TZ = 'Africa/Nairobi'
export const fmtTime = (iso: string) => (iso ? new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: TZ }) : '')
export const fmtDay = (iso: string) => (iso ? new Date(iso).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short', timeZone: TZ }) : '')
export const fmtStamp = (iso: string) => (iso ? `${fmtDay(iso)}, ${fmtTime(iso)}` : '')
/** ISO -> "YYYY-MM-DD" and "HH:mm" in Nairobi time (for form inputs). */
export function toParts(iso: string): { date: string; time: string } {
  if (!iso) return { date: '', time: '' }
  const s = new Date(iso).toLocaleString('sv-SE', { timeZone: TZ, hour12: false })
  return { date: s.slice(0, 10), time: s.slice(11, 16) }
}
/** Nairobi date + time -> ISO. */
export const fromParts = (date: string, time: string) => (date && time ? new Date(`${date}T${time}:00+03:00`).toISOString() : '')

export const stageName = (stage: number, stages: number) => (stage === stages ? 'Final' : `Round ${stage}`)
/** Which time window a stage plays in: the last stage always plays in the Final window. */
export const stageWindow = (t: Tournament, stage: number) => t.windows[stage === t.stages ? 2 : stage - 1]

/** Slots two players are both free in, e.g. "Wed evening". */
export function sharedSlots(a: string[], b: string[]): string[] {
  const set = new Set(b)
  return a.filter((s) => set.has(s)).map((s) => s.replace('-', ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase()))
}

/** Link that opens the league join page for a course (works for classmates who are not signed in yet). */
export const leagueInviteLink = (course: string) => `${window.location.origin}${window.location.pathname}#/efootball/league/join/${encodeURIComponent(course)}`

/** "Wed-Evening" slots -> { Mon: ['Morning', ...] } */
export function slotsByDay(free: string[]): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const s of free) { const [d, p] = s.split('-'); if (d && p) (out[d] ||= []).push(p) }
  return out
}

export type HomeData = {
  serverNow: number; players: number; registered: number
  tournament: { id: string; name: string; status: 'open' | 'running' | 'done'; round: number; stages: number; regClose: string; start: string; cap: number; count: number; champion: string } | null
  top: { username: string; course: string; p: number; pts: number; gd: number }[]
  courses: CourseRow[]
  league: { fixtureToday: boolean; closeAt: string; fixtureDays: string[]; closeHour: number }
  champion: { name: string; date: string; username: string; course: string } | null
  waGroup?: string
  fpl?: { configured: boolean; ready: boolean; next: { id: number; name: string; at: string } | null; gw: number; managers: number; top: { username: string; course: string; total: number }[]; stale: boolean }
}

/** "2d 4h 10m" style countdown to an ISO time. Pass the server/client clock difference so wrong phone clocks do not matter. */
export function countdown(iso: string, skew = 0): string {
  const ms = Date.parse(iso) - (Date.now() + skew)
  if (!(ms > 0)) return ''
  const s = Math.floor(ms / 1000), d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60)
  return d ? `${d}d ${h}h ${m}m` : h ? `${h}h ${m}m ${String(s % 60).padStart(2, '0')}s` : `${m}m ${String(s % 60).padStart(2, '0')}s`
}

export type FplRow = { uid: string; entry?: string; username: string; course: string; team: string; total: number; gwPts: number; rank: number; gwRank: number }
export type FplBoard = {
  configured: boolean; ready: boolean; leagueId: string; leagueCode: string; at: string; error: string; size: number; serverNow: number
  gw: { id: number; name: string; finished: boolean; started: boolean } | null
  next: { id: number; name: string; at: string } | null
  rows: FplRow[]
  courses: { course: string; managers: number; avg: number; gwAvg: number; ranked: boolean }[]
  winners: { gw: number; name: string; pts: number; w: { u: string; c: string }[] }[]
  captains: { gw: number; got: number; total: number; list: { name: string; n: number }[] } | null
  status: 'anon' | 'unregistered' | 'unlinked' | 'linked' | 'outside'; fplId: string; mine: FplRow | null
}
export type FplAdminInfo = { leagueId: string; leagueCode: string; at: string; error: string; members: number; linked: number; inLeague: number; gw: number }
export const fplJoinLink = (code: string) => (code ? `https://fantasy.premierleague.com/leagues/auto-join/${encodeURIComponent(code)}` : '')

/* ---------------- money: M-Pesa to the admin, the admin verifies ---------------- */
export type PayKind = 'course' | 'league' | 'knockout' | 'listing'
export type PayCfg = { adminWa: string; payPhone: string; fees: { course: number; knockout: number; listing: number }; cutPct: number; maxLeagueFee: number }
export const DEFAULT_PAY: PayCfg = { adminWa: '254184198432', payPhone: '254184198432', fees: { course: 10, knockout: 20, listing: 20 }, cutPct: 10, maxLeagueFee: 1000 }
export type PayView = { id: string; kind: PayKind; ref: string; label: string; amount: number; status: 'pending' | 'verified' | 'rejected'; createdAt: string; note: string; mpesa: string }
export type Listing = {
  id: string; type: 'sell' | 'buy'; title: string; platform: string; strength: number; price: number; details: string; imageId: string
  status: string; createdAt: string; approvedAt: string; owner: { uid: string; username: string; course: string }; whatsapp: string
}
export type AdminPay = PayView & { cut: number; decidedAt: string; username: string; fullName: string; whatsapp: string; email: string; listing: Listing | null }
export type PayAdmin = { rows: AdminPay[]; summary: { pending: number; verified: number; verifiedTotal: number; cutTotal: number } }
export const ksh = (n: number) => `KSh ${Math.round(n * 100) / 100}`
/** 0712 345 678 / +254712345678 -> 254712345678 (for wa.me). */
export const waDigits = (n: string) => { const d = String(n || '').replace(/\D/g, ''); return d.startsWith('0') ? `254${d.slice(1)}` : d.startsWith('7') || d.startsWith('1') ? `254${d}` : d }
export const showPhone = (n: string) => { const d = waDigits(n); return d.startsWith('254') ? `0${d.slice(3, 6)} ${d.slice(6, 9)} ${d.slice(9)}`.trim() : n }

/* ---------------- EPL / FPL data ---------------- */
export type FplPlayer = {
  id: number; name: string; team: string; teamId: number; pos: string; price: number; pts: number; gw: number; form: number; sel: number
  g: number; a: number; cs: number; mins: number; bonus: number; ppg: number; ep: number; status: string; news: string
  yc: number; rc: number; saves: number; ict: number; xg: number; xa: number; gc: number
}
export type FplHub = {
  serverNow: number; at: number
  gw: { id: number; name: string; finished: boolean; started: boolean; avg: number; hi: number } | null
  next: { id: number; name: string; at: string } | null
  picks: { mostCaptained: string; mostVice: string; mostSelected: string; mostTransferredIn: string; topPlayer: { name: string; pts: number } | null } | null
  candidates: FplPlayer[]
}
export type FplEvent = { name: string; n: number; side: 'h' | 'a' }
export type FplTeamRef = { id: number; name: string; short: string }
export type FplFixture = {
  id: number; ko: string | null; status: 'finished' | 'live' | 'upcoming'; min: number; h: FplTeamRef; a: FplTeamRef; hg: number | null; ag: number | null
  goals: FplEvent[]; assists: FplEvent[]; ownGoals: FplEvent[]; reds: FplEvent[]; bonus: FplEvent[]
}
export type FplMatches = { serverNow: number; gw: number; current: number; events: { id: number; name: string; finished: boolean; current: boolean }[]; fixtures: FplFixture[] }
export type FplTableRow = { id: number; name: string; short: string; p: number; w: number; d: number; l: number; gf: number; ga: number; gd: number; pts: number; form: string[] }
export type FplLive = { gw: { id: number; name: string; finished: boolean; started: boolean } | null; top: { id: number; name: string; team: string; pos: string; pts: number; mins: number; g: number; a: number; cs: number; bonus: number }[]; at: number; serverNow: number }
export type FplPlayers = { total: number; rows: FplPlayer[]; teams: { id: number; s: string; n: string }[]; at: number }
export type FplPlayerDetail = {
  player: FplPlayer
  history: { gw: number; opp: string; home: boolean; hs: number; as: number; pts: number; mins: number; g: number; a: number; cs: number; bonus: number; value: number }[]
  fixtures: { gw: number; opp: string; home: boolean; diff: number; ko: string }[]
}
export type FplManager = {
  entry: string; username: string; course: string; name: string; manager: string; region: string; stale: boolean
  overall: { points: number; rank: number; gwPoints: number; gwRank: number; value: number; bank: number; transfers: number }
  stats: { played: number; avg: number; best: { gw: number; pts: number } | null; worst: { gw: number; pts: number } | null; bestRank: number; hits: number; transfers: number; benchPts: number }
  gws: { gw: number; pts: number; total: number; rank: number; value: number; bench: number; cost: number }[]
  chips: { name: string; gw: number }[]
  past: { season: string; pts: number; rank: number }[]
  team: { gw: number; chip: string; picks: { slot: number; id: number; name: string; team: string; pos: string; mult: number; captain: boolean; vice: boolean; pts: number; mins: number; g: number; a: number; bonus: number }[]; bench: number; live: number; hit: number; official: number; note: string } | null
  teamNote: string
}
export const isoOf = (ms: number) => (ms ? new Date(ms).toISOString() : '')

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
export type PublicPlayer = { uid: string; username: string; name: string; year: number; platform: string; strength: number; squadId: string; canHost: boolean; leagueId: string; league: string; freeTimes: string[]; inLeague: boolean; fpl?: boolean; chat?: boolean; whatsapp?: string }

/** A league as the app sees it. `code` is sent only to members, and for public leagues. */
export type LeagueInfo = { id: string; name: string; about: string; logoId: string; founder: string; founderUid: string; members: number; isPublic: boolean; code: string; createdAt: string }

export type Profile = Omit<PublicPlayer, 'whatsapp' | 'league'> & {
  fullName: string; whatsapp: string; status: string; email: string; showWhatsapp: boolean; paused: boolean; strikes: number; fplId?: string; fplTeam?: string
  /** Free for the first matches, then a one-time activation: none | trial | active | expired. */
  leagueState: 'none' | 'trial' | 'active' | 'expired'; trialLeft: number; leagueFee: number; leaguePending: boolean
  /** false = joined before the conditions existed and must accept them once. */
  termsOk: boolean
  league: LeagueInfo | null
}
export type ProfileInput = {
  username: string; fullName: string; year: number; platform: string; strength: number
  whatsapp: string; freeTimes: string[]; canHost: boolean; showWhatsapp: boolean; squad?: string
}
export type AdminLeague = LeagueInfo & { reports: number }
/** A row of the admin's player list. `league` is the league name. */
export type AdminPlayer = { uid: string; username: string; fullName: string; whatsapp: string; email: string; status: string; platform: string; strength: number; squadId: string; league: string; fplId?: string; canHost: boolean }

export type MatchView = {
  id: string; week: string; day: string; deadline: string; note: string; status: 'pending' | 'disputed' | 'confirmed' | 'void'
  myClaim: { mine: number; theirs: number } | null; oppReported: boolean; final: { mine: number; theirs: number } | null
  opp: { uid: string; username: string; platform: string; strength: number; squadId: string; whatsapp: string; freeTimes: string[] }
}
export type Me = { uid: string; email: string; isAdmin: boolean; profile: Profile | null; tid: string; joined: boolean; entry: '' | 'pending' | 'paid'; pending: { kind: PayKind; ref: string }[]; matches: MatchView[] }

export type PoolMember = { uid: string; username: string; strength: number; platform: string; league: string; squadId: string }
export type PoolStatus = 'waiting' | 'reported' | 'disputed' | 'locked'
export type Pool = {
  id: string; stage: number; idx: number; hostUid: string; backupUid: string; members: PoolMember[]; winnerUid: string
  proofId: string; status: PoolStatus; reportedBy: string; reportedAt: string; disputes: number; note: string
}
export type Tournament = {
  id: string; name: string; logoId: string; rules: string; token: string; status: 'open' | 'running' | 'done'
  stages: number; round: number; regClose: string; cap: number; windows: [string, string][]; count: number; pending?: number; fee: number; hostFee: number
  champion: PoolMember | null; pools: Pool[]; serverNow: number
}
export type Champion = { name: string; date: string; username: string; league: string; squadId: string }

export type LeagueRow = { uid: string; username: string; platform: string; strength: number; squadId: string; p: number; w: number; d: number; l: number; gf: number; ga: number; gd: number; pts: number; form: ('W' | 'D' | 'L')[] }
export type LeagueRecent = { id: string; p1: string; p2: string; s1: number; s2: number; at: string; sq1: string; sq2: string }
/** One league: its table, recent results and the fixture rules. */
export type League = {
  league: LeagueInfo; table: LeagueRow[]; recent: LeagueRecent[]
  today: string; fixtureToday: boolean; closeAt: string; fixtureDays: string[]; closeHour: number; serverNow: number
}
export type FixtureSide = { uid: string; username: string; squadId: string; strength: number; platform: string }
export type FixtureRow = { id: string; p1: FixtureSide; p2: FixtureSide; status: 'pending' | 'disputed' | 'confirmed' | 'void'; reported: number; s1: number | null; s2: number | null }
/** The newest fixture day of a league with every pairing. */
export type Fixtures = { day: string; isToday: boolean; closeAt: string; closeHour: number; total: number; reported: number; list: FixtureRow[]; serverNow: number; fixtureDays: string[] }

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

const base = () => `${window.location.origin}${window.location.pathname}`
/** The invite link of a league. It carries the league's short code and opens the join page (works for people who are not signed in yet). */
export const leagueInviteLink = (code: string) => `${base()}#/efootball/league/join/${encodeURIComponent(code)}`
/** The invite link of the weekly knockout. */
export const tournamentInviteLink = (token: string) => `${base()}#/efootball/join/${encodeURIComponent(token)}`

/** "Wed-Evening" slots -> { Mon: ['Morning', ...] } */
export function slotsByDay(free: string[]): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const s of free) { const [d, p] = s.split('-'); if (d && p) (out[d] ||= []).push(p) }
  return out
}

export type HomeLeague = { id: string; name: string; logoId: string; members: number; code: string }
export type HomeData = {
  serverNow: number; players: number; leagues: number; inLeague: number
  tournament: { id: string; name: string; status: 'open' | 'running' | 'done'; round: number; stages: number; regClose: string; start: string; cap: number; count: number; champion: string } | null
  topLeagues: HomeLeague[]
  league: { fixtureToday: boolean; closeAt: string; fixtureDays: string[]; closeHour: number }
  champion: { name: string; date: string; username: string; league: string } | null
  waGroup?: string
  fpl?: { configured: boolean; ready: boolean; next: { id: number; name: string; at: string } | null; gw: number; managers: number; top: { username: string; league: string; total: number }[]; stale: boolean }
}

/** "2d 4h 10m" style countdown to an ISO time. Pass the server/client clock difference so wrong phone clocks do not matter. */
export function countdown(iso: string, skew = 0): string {
  const ms = Date.parse(iso) - (Date.now() + skew)
  if (!(ms > 0)) return ''
  const s = Math.floor(ms / 1000), d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60)
  return d ? `${d}d ${h}h ${m}m` : h ? `${h}h ${m}m ${String(s % 60).padStart(2, '0')}s` : `${m}m ${String(s % 60).padStart(2, '0')}s`
}

/** `move`: places gained (+) or lost (-) since the last gameweek; null = nothing to compare with. */
export type FplRow = { uid: string; entry?: string; username: string; league: string; team: string; total: number; gwPts: number; rank: number; gwRank: number; move?: number | null }
export type FplBoard = {
  configured: boolean; ready: boolean; leagueId: string; leagueCode: string; at: string; error: string; size: number; unlinked?: number; serverNow: number
  gw: { id: number; name: string; finished: boolean; started: boolean } | null
  next: { id: number; name: string; at: string } | null
  rows: FplRow[]
  leagues: { league: string; managers: number; counted?: number; avg: number; gwAvg: number; ranked: boolean }[]
  winners: { gw: number; name: string; pts: number; w: { u: string; c: string }[] }[]
  captains: { gw: number; got: number; total: number; list: { name: string; n: number }[]; own?: FplOwn[]; diff?: FplOwn[] } | null
  status: 'anon' | 'unregistered' | 'unlinked' | 'linked' | 'outside'; fplId: string; mine: FplRow | null
}
/** A player owned by Chuka managers: n managers (pct of those checked); `all` = % of all FPL managers who own him. */
export type FplOwn = { name: string; n: number; pct: number; all: number }
export type FplAdminInfo = { leagueId: string; leagueCode: string; at: string; error: string; members: number; linked: number; inLeague: number; gw: number }
export const fplJoinLink = (code: string) => (code ? `https://fantasy.premierleague.com/leagues/auto-join/${encodeURIComponent(code)}` : '')

/* ---------------- money: M-Pesa to the admin, the admin verifies ---------------- */
export type PayKind = 'league' | 'knockout' | 'listing'
export type PayCfg = {
  adminWa: string; payPhone: string; fees: { knockout: number; listing: number; activation: number; host: number }; maxFee: number; hostFee: number
  terms: string[]; termsV: string; trialMatches: number; maxMembers: number; fixtureDays: string[]; closeHour: number
}
/** The admin's WhatsApp. One constant, used by every "chat the admin" button and the floating button. */
export const ADMIN_WA = '254712670914'
/** Used until (or if) the server answers. The server's own copy of the conditions replaces it. */
export const DEFAULT_PAY: PayCfg = {
  adminWa: ADMIN_WA, payPhone: ADMIN_WA, fees: { knockout: 20, listing: 20, activation: 20, host: 20 }, maxFee: 1000, hostFee: 20,
  termsV: '2026-11', trialMatches: 3, maxMembers: 100, fixtureDays: ['Mon', 'Wed', 'Fri', 'Sun'], closeHour: 21,
  terms: [
    'Fixtures are made automatically at 00:00 (Nairobi time) on Monday, Wednesday, Friday and Sunday.',
    'You play one match per fixture day against another member of your league. Agree the time with your opponent on WhatsApp.',
    'Matches and results must be reported before 21:00 (9 pm) the same day.',
    'Claiming a win needs a screenshot of the final score. A win with no screenshot is void.',
    'If nobody reports a fixture it is void and nobody gets points. Missing 3 fixtures in a row pauses you until you tap Resume.',
    'Your first 3 matches are free. After that a one-time KSh 20 activation keeps your fixtures and saved results.',
    'Be respectful. The admin can remove players, leagues and results, and the admin\u2019s decision is final.',
  ],
}
export type PayView = { id: string; kind: PayKind; ref: string; label: string; amount: number; status: 'pending' | 'verified' | 'rejected'; createdAt: string; note: string; mpesa: string }
export type Listing = {
  id: string; type: 'sell' | 'buy'; title: string; platform: string; strength: number; price: number; details: string; imageId: string
  status: string; createdAt: string; approvedAt: string; owner: { uid: string; username: string }; whatsapp: string
}
export type AdminPay = PayView & { decidedAt: string; username: string; fullName: string; whatsapp: string; email: string; listing: Listing | null }
export type PayAdmin = { rows: AdminPay[]; summary: { pending: number; verified: number; verifiedTotal: number } }
/** What a host earned by running knockout pools. */
export type Earning = { id: string; tid: string; poolId: string; amount: number; status: 'pending' | 'paid'; createdAt: string; paidAt: string; mpesa: string; note: string }
export type MyEarnings = { rows: Earning[]; summary: { pending: number; paid: number; pools: number }; hostFee: number }
export type AdminHost = { uid: string; username: string; fullName: string; whatsapp: string; total: number; rows: Earning[] }
export type AdminEarnings = { hosts: AdminHost[]; summary: { pending: number; paid: number; hosts: number } }
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
  entry: string; username: string; league: string; name: string; manager: string; region: string; stale: boolean
  overall: { points: number; rank: number; gwPoints: number; gwRank: number; value: number; bank: number; transfers: number }
  stats: { played: number; avg: number; best: { gw: number; pts: number } | null; worst: { gw: number; pts: number } | null; bestRank: number; hits: number; transfers: number; benchPts: number }
  gws: { gw: number; pts: number; total: number; rank: number; value: number; bench: number; cost: number }[]
  chips: { name: string; gw: number }[]
  past: { season: string; pts: number; rank: number }[]
  team: { gw: number; chip: string; picks: { slot: number; id: number; name: string; team: string; pos: string; mult: number; captain: boolean; vice: boolean; pts: number; mins: number; g: number; a: number; bonus: number }[]; bench: number; live: number; hit: number; official: number; note: string } | null
  teamNote: string
}
export const isoOf = (ms: number) => (ms ? new Date(ms).toISOString() : '')

/** A league logo as a data URL (needed so a share-card canvas can be saved). Empty string when the league has no logo. */
export async function leagueLogoData(id: string): Promise<string> {
  try { return (await ef<{ data: string }>('leagueLogo', { id })).data || '' } catch { return '' }
}

/** Admin chat message that opens WhatsApp with the admin. */
export const adminChatLink = (text = 'Hi eFootball admin, ') => waLink(ADMIN_WA, text)

import { auth } from './firebase'

/** Apps Script web app URL (the /exec link). */
const API = import.meta.env.VITE_CPL_API_URL as string | undefined
export const cplReady = Boolean(API)

export type Role = '' | 'owner' | 'chairman'
export type Highlight = { videoId: string; title: string; description: string; channelTitle?: string; publishedAt: string; thumb: string; cpl?: boolean }
export type Category = 'highlights' | 'goals' | 'skills' | 'shorts' | 'news'
export type SearchResult = { videos: Highlight[]; warning?: string }
export type Profile = { email: string; fullName: string; whatsapp: string; call: string; imageUrl: string }
export const POSITIONS = ['Goalkeeper', 'Defender', 'Midfielder', 'Forward'] as const
export type Player = {
  id: string; teamId: string; seasonId: string; name: string; position: string; number: string; bio: string; imageUrl: string
  email: string; phone: string // email/phone only filled for chairmen, the team's coach, and the player himself
}
export type MyPlayer = Player & { teamName: string; seasonName: string }
export type Venue = { id: string; name: string; description: string; mapsUrl: string; imageUrl: string }
export type Referee = { id: string; name: string; email: string; imageUrl: string }
export type MyTeam = Team & { seasonName: string; divisionName: string }
export type Me = { email: string; role: Role; profile: Profile | null; teams: MyTeam[]; players: MyPlayer[]; isReferee: boolean }
export type Chair = { email: string; role: Role; fullName: string }

/** Calls the CPL Apps Script. Sends the Firebase ID token when signed in; the server verifies it. */
export async function cpl<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  if (!API) throw new Error('CPL server not connected yet. Add VITE_CPL_API_URL to .env.')
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
    catch {
      throw new Error('Could not reach the CPL server. Check your internet, then make sure VITE_CPL_API_URL is the web app link and the deployment is set to "Anyone".')
    }
  }
  let j: { ok: boolean; data?: unknown; error?: string }
  try { j = await res.json() }
  catch { throw new Error('The CPL server sent an unexpected reply. In Apps Script use Deploy > Manage deployments > Edit > New version, then try again.') }
  if (!j.ok) throw new Error(j.error || 'Request failed')
  return j.data as T
}

export type Season = {
  id: string; name: string; startDate: string; endDate: string
  preStart: string; preEnd: string; midStart: string; midEnd: string
  description: string; coverUrl: string; rulesUrl: string; rulesName: string; rulesDocId: string
}
export type FixtureStatus = 'scheduled' | 'live' | 'finished' | 'postponed'
export type Fixture = {
  id: string; seasonId: string; matchday: string; date: string; time: string
  home: string; away: string; venue: string; homeScore: string; awayScore: string; status: FixtureStatus
  homeId: string; awayId: string; venueId: string; refereeId: string
  venueMapsUrl: string; refereeName: string
  homeLogoUrl: string; awayLogoUrl: string; venueImageUrl: string; refereeImageUrl: string // pictures shown on the fixture card
  summary: string; scorers: string; cards: string; reportAt: string // match report, filed by the referee
  seasonName: string
}

export type Division = { id: string; seasonId: string; name: string }
export type Team = {
  id: string; seasonId: string; divisionId: string; name: string; description: string; logoUrl: string
  coachName: string; coachEmail: string; coachWhatsapp: string // email/whatsapp are only filled for signed-in chairmen
}

export const fmtDate = (d: string) =>
  d ? new Date(d + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : ''
export const fmtRange = (a: string, b: string) => (a ? `${fmtDate(a)} – ${fmtDate(b)}` : 'To be announced')
export const docEditUrl = (id: string) => `https://docs.google.com/document/d/${id}/edit`
export const docViewUrl = (id: string) => `https://docs.google.com/document/d/${id}/preview`
export function seasonState(s: Season): 'Upcoming' | 'Active' | 'Ended' {
  const today = new Date().toLocaleDateString('en-CA') // YYYY-MM-DD in local time
  return today < s.startDate ? 'Upcoming' : today > s.endDate ? 'Ended' : 'Active'
}

/* ---------- player statistics (added by the referee, approved by a chairman) ---------- */
export type StatType = 'goal' | 'assist' | 'cleansheet' | 'yellow' | 'red'
export const STAT_TYPES: StatType[] = ['goal', 'assist', 'cleansheet', 'yellow', 'red']
export const STAT_LABEL: Record<StatType, string> = { goal: 'Goal', assist: 'Assist', cleansheet: 'Clean sheet', yellow: 'Yellow card', red: 'Red card' }
export type StatStatus = 'pending' | 'approved' | 'rejected'
export type StatEntry = {
  id: string; fixtureId: string; playerId: string; playerName: string; teamId: string; teamName: string
  type: StatType; minute: string; status: StatStatus; fixture: string; date: string; addedAt: string
}
export type PendingStat = StatEntry & { addedBy: string; matchday: string }
export type MyStats = {
  playerId: string; name: string; position: string; teamId: string; teamName: string; seasonId: string; imageUrl: string
  goals: number; assists: number; cleanSheets: number; yellow: number; red: number; matches: number; pending: number
  events: StatEntry[] // approved only
}

/* ---------- transfers ---------- */
export type TransferStage = 'awaiting_player' | 'awaiting_coach' | 'awaiting_chairman' | 'approved' | 'rejected' | 'cancelled'
export type Transfer = {
  id: string; seasonId: string; seasonName: string; playerId: string; playerName: string; playerEmail: string
  fromTeamId: string; fromTeamName: string; fromCoachName: string; toTeamId: string; toTeamName: string; toCoachName: string
  stage: TransferStage; playerAt: string; fromCoachAt: string; chairAt: string
  rejectedBy: string; rejectReason: string; letterNo: string; letterUrl: string; createdAt: string
  youAct: boolean; canCancel: boolean
}
export const fmtStamp = (iso: string) => (iso && !isNaN(Date.parse(iso)) ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '')

import { supabase } from './supabase'
import { niceDate } from './hostel'

export const roommateReady = Boolean(supabase)

export type Gender = 'male' | 'female'
/** 'semester' = normal roommate post. 'graduation' = short stay for the graduation period only, looking for a host. */
export type StayType = 'semester' | 'graduation'
export const MAX_YEAR = 6 // years of study go from Year 1 up to Year 6
export const MAX_GRAD_DAYS = 14 // longest graduation stay (also enforced by the database)
export type PostStatus = 'pending' | 'approved' | 'rejected'
export type Lifestyle = { sleep: string; study: string; visitors: string; cleanliness: string; substances: string }

/** Options go from one end of the scale to the other, so "distance" between answers drives the match score. */
export const LIFESTYLE_QUESTIONS: { key: keyof Lifestyle; label: string; options: { value: string; label: string }[] }[] = [
  { key: 'sleep', label: 'Sleep pattern', options: [{ value: 'early', label: 'Early bird' }, { value: 'flex', label: 'In between' }, { value: 'late', label: 'Night owl' }] },
  { key: 'study', label: 'Studying at home', options: [{ value: 'quiet', label: 'Needs quiet' }, { value: 'flex', label: 'Flexible' }, { value: 'lively', label: 'Fine with noise' }] },
  { key: 'visitors', label: 'Visitors', options: [{ value: 'rarely', label: 'Rarely' }, { value: 'sometimes', label: 'Sometimes' }, { value: 'often', label: 'Often' }] },
  { key: 'cleanliness', label: 'Cleanliness', options: [{ value: 'tidy', label: 'Very tidy' }, { value: 'average', label: 'Average' }, { value: 'relaxed', label: 'Relaxed' }] },
  { key: 'substances', label: 'Smoking / alcohol', options: [{ value: 'none', label: 'None' }, { value: 'occasional', label: 'Occasionally' }, { value: 'regular', label: 'Regularly' }] },
]
export const DEFAULT_LIFESTYLE: Lifestyle = { sleep: 'flex', study: 'flex', visitors: 'sometimes', cleanliness: 'average', substances: 'none' }

export const lifestyleLabel = (key: keyof Lifestyle, value: string) =>
  LIFESTYLE_QUESTIONS.find((q) => q.key === key)?.options.find((o) => o.value === value)?.label ?? ''

export type RoommatePost = {
  id: string
  firstName: string; gender: Gender; course: string; year: number
  budgetMin: number; budgetMax: number; roomType: string; area: string
  hasRoom: boolean; hostelName: string; lifestyle: Lifestyle; bio: string
  status: PostStatus; rejectReason: string; hidden: boolean
  stayType: StayType; stayFrom: string; stayTo: string // dates (yyyy-mm-dd) only for graduation stays
  offersGraduationHosting: boolean // a student with a room who can host graduation guests
  updatedAt: string
  passExpiresAt: string // when the paid semester pass behind this post ends ('' for older posts)
  interested?: boolean // only set when browsing
  userId?: string // only set for the owner / admin
}

export type PostInput = Pick<RoommatePost, 'firstName' | 'gender' | 'course' | 'year' | 'budgetMin' | 'budgetMax' | 'roomType' | 'area' | 'hasRoom' | 'hostelName' | 'lifestyle' | 'bio' | 'stayType' | 'stayFrom' | 'stayTo' | 'offersGraduationHosting'>

export type ReceivedInterest = { id: string; postId: string; fromName: string; note: string; status: 'pending' | 'accepted' | 'declined'; createdAt: string; whatsapp: string | null }
export type SentInterest = { id: string; postId: string; firstName: string; area: string; status: 'pending' | 'accepted' | 'declined'; createdAt: string; whatsapp: string | null }
export type PassRow = { email: string; expiresAt: string; mpesaCode: string; grantedAt: string; grantedBy: string }
export type Report = { postId: string; reason: string; createdAt: string }

type Row = Record<string, unknown>
const str = (v: unknown) => (v == null ? '' : String(v))

function toLifestyle(v: unknown): Lifestyle {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>
  return {
    sleep: str(o.sleep) || DEFAULT_LIFESTYLE.sleep, study: str(o.study) || DEFAULT_LIFESTYLE.study,
    visitors: str(o.visitors) || DEFAULT_LIFESTYLE.visitors, cleanliness: str(o.cleanliness) || DEFAULT_LIFESTYLE.cleanliness,
    substances: str(o.substances) || DEFAULT_LIFESTYLE.substances,
  }
}

export function rowToPost(r: Row): RoommatePost {
  return {
    id: str(r.id), userId: r.user_id ? str(r.user_id) : undefined,
    firstName: str(r.first_name), gender: r.gender === 'female' ? 'female' : 'male', course: str(r.course), year: Number(r.year_of_study) || 1,
    budgetMin: Number(r.budget_min) || 0, budgetMax: Number(r.budget_max) || 0, roomType: str(r.room_type), area: str(r.area),
    hasRoom: r.has_room === true, hostelName: str(r.hostel_name), lifestyle: toLifestyle(r.lifestyle), bio: str(r.bio),
    status: (['pending', 'approved', 'rejected'].includes(str(r.status)) ? str(r.status) : 'pending') as PostStatus,
    rejectReason: str(r.reject_reason), hidden: r.hidden === true,
    stayType: r.stay_type === 'graduation' ? 'graduation' : 'semester', stayFrom: str(r.stay_from).slice(0, 10), stayTo: str(r.stay_to).slice(0, 10),
    offersGraduationHosting: r.offers_graduation_hosting === true, updatedAt: str(r.updated_at), passExpiresAt: str(r.pass_expires_at),
    interested: r.interested === true,
  }
}

function db() {
  if (!supabase) throw new Error('Supabase is not connected yet. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.')
  return supabase
}
function fail(error: { message: string } | null): never | void {
  if (error) throw new Error(error.message)
}

/** Kenyan numbers -> 2547XXXXXXXX / 2541XXXXXXXX. Returns '' when invalid. */
export function normalizePhone(value: string): string {
  let d = value.replace(/\D/g, '')
  if (d.startsWith('254')) d = d.slice(3)
  else if (d.startsWith('0')) d = d.slice(1)
  return /^[17]\d{8}$/.test(d) ? `254${d}` : ''
}

function lifestyleSum(a: Lifestyle, b: Lifestyle): number {
  let sum = 0
  for (const q of LIFESTYLE_QUESTIONS) {
    const ia = q.options.findIndex((o) => o.value === a[q.key])
    const ib = q.options.findIndex((o) => o.value === b[q.key])
    sum += ia < 0 || ib < 0 ? 0.5 : 1 - Math.abs(ia - ib) / (q.options.length - 1)
  }
  return sum
}
/** 0-100: how alike two lifestyles are. */
export function matchScore(a: Lifestyle, b: Lifestyle): number {
  return Math.round((lifestyleSum(a, b) / LIFESTYLE_QUESTIONS.length) * 100)
}
/** Semester roommates: the five lifestyle answers plus how close the years of study are (Year 1 to Year 6). */
export function postMatchScore(a: Pick<RoommatePost, 'lifestyle' | 'year'>, b: Pick<RoommatePost, 'lifestyle' | 'year'>): number {
  const yearClose = 1 - Math.min(Math.abs(a.year - b.year), MAX_YEAR - 1) / (MAX_YEAR - 1)
  return Math.round(((lifestyleSum(a.lifestyle, b.lifestyle) + yearClose) / (LIFESTYLE_QUESTIONS.length + 1)) * 100)
}
export const budgetsOverlap = (a: Pick<RoommatePost, 'budgetMin' | 'budgetMax'>, b: Pick<RoommatePost, 'budgetMin' | 'budgetMax'>) =>
  a.budgetMin <= b.budgetMax && b.budgetMin <= a.budgetMax

/** Number of nights/days from arrival to departure, counting both days. */
export const graduationDays = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000) + 1
export const stayRange = (from: string, to: string) => (from === to ? niceDate(from) : `${niceDate(from)} to ${niceDate(to)}`)

/** Text + link for sharing a post on WhatsApp. Never includes a phone number. */
export function shareLink(p: Pick<RoommatePost, 'firstName' | 'course' | 'year' | 'budgetMin' | 'budgetMax' | 'area' | 'roomType' | 'hasRoom' | 'hostelName' | 'stayType' | 'stayFrom' | 'stayTo' | 'offersGraduationHosting'>): string {
  const site = `${window.location.origin}${window.location.pathname}#/hostel`
  const money = (n: number) => `KSh ${n.toLocaleString('en-KE')}`
  if (p.stayType === 'graduation') {
    const lines = [
      'Graduation host needed on Chuka Comrades',
      '',
      `${p.firstName} · ${p.course}, Year ${p.year}`,
      `Staying: ${stayRange(p.stayFrom, p.stayTo)}`,
      `Budget for the stay: ${money(p.budgetMin)} - ${money(p.budgetMax)}`,
      `Wants to stay near: ${p.area}`,
      '',
      `Can you host? See the post and connect: ${site}`,
    ]
    return `https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`
  }
  const lines = [
    'Roommate needed on Chuka Comrades',
    '',
    `${p.firstName} · ${p.course}, Year ${p.year}`,
    `Budget: ${money(p.budgetMin)} - ${money(p.budgetMax)}`,
    `Area: ${p.area}${p.roomType ? ` · ${p.roomType}` : ''}`,
    p.hasRoom ? `Has a room at ${p.hostelName}` : 'Looking for a room too',
    ...(p.offersGraduationHosting ? ['Can host graduation guests'] : []),
    '',
    `See the post and connect: ${site}`,
  ]
  return `https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`
}

const GENDER_KEY = 'rm_gender'
export function rememberedGender(): Gender | '' {
  try { const g = localStorage.getItem(GENDER_KEY); return g === 'male' || g === 'female' ? g : '' } catch { return '' }
}
export function rememberGender(g: Gender) { try { localStorage.setItem(GENDER_KEY, g) } catch { /* private mode */ } }

export const roommateApi = {
  async isAdmin(): Promise<boolean> {
    const { data, error } = await db().rpc('is_admin')
    return !error && data === true
  },

  // ----- paid semester pass (KSh per semester, activated by the admin) -----
  /** ISO time the student's pass ends, or '' when they have no active pass. */
  async myPass(): Promise<string> {
    const { data, error } = await db().rpc('roommate_my_pass')
    fail(error)
    return data ? str(data) : ''
  },
  async passList(): Promise<PassRow[]> {
    const { data, error } = await db().rpc('roommate_pass_list')
    fail(error)
    return ((data ?? []) as Row[]).map((r) => ({ email: str(r.email), expiresAt: str(r.expires_at), mpesaCode: str(r.mpesa_code), grantedAt: str(r.granted_at), grantedBy: str(r.granted_by) }))
  },
  async passGrant(email: string, code: string, expiresIso: string): Promise<void> {
    fail((await db().rpc('roommate_pass_grant', { p_email: email, p_code: code, p_expires: expiresIso })).error)
  },
  async passRevoke(email: string): Promise<void> { fail((await db().rpc('roommate_pass_revoke', { p_email: email })).error) },

  // ----- student: my own post -----
  async myPost(userId: string): Promise<{ post: RoommatePost; whatsapp: string } | null> {
    const { data, error } = await db().from('roommate_posts').select('*').eq('user_id', userId).maybeSingle()
    fail(error)
    if (!data) return null
    const c = await db().from('roommate_contacts').select('whatsapp').eq('post_id', data.id).maybeSingle()
    fail(c.error)
    return { post: rowToPost(data), whatsapp: str(c.data?.whatsapp) }
  },

  async savePost(userId: string, existingId: string | null, input: PostInput, whatsapp: string): Promise<RoommatePost> {
    const row = {
      first_name: input.firstName, gender: input.gender, course: input.course, year_of_study: input.year,
      budget_min: input.budgetMin, budget_max: input.budgetMax, room_type: input.roomType, area: input.area,
      has_room: input.hasRoom, hostel_name: input.hasRoom ? input.hostelName : '', lifestyle: input.lifestyle, bio: input.bio,
      stay_type: input.stayType,
      stay_from: input.stayType === 'graduation' ? input.stayFrom : null,
      stay_to: input.stayType === 'graduation' ? input.stayTo : null,
      offers_graduation_hosting: input.stayType === 'semester' && input.hasRoom && input.offersGraduationHosting,
    }
    const res = existingId
      ? await db().from('roommate_posts').update(row).eq('id', existingId).select().single()
      : await db().from('roommate_posts').insert({ ...row, user_id: userId }).select().single()
    fail(res.error)
    const saved = res.data as Row
    const c = await db().from('roommate_contacts').upsert({ post_id: saved.id, user_id: userId, whatsapp }, { onConflict: 'post_id' })
    fail(c.error)
    return rowToPost(saved)
  },

  async setHidden(id: string, hidden: boolean): Promise<RoommatePost> {
    const { data, error } = await db().from('roommate_posts').update({ hidden }).eq('id', id).select().single()
    fail(error)
    return rowToPost(data as Row)
  },

  async deletePost(id: string): Promise<void> { fail((await db().from('roommate_posts').delete().eq('id', id)).error) },

  // ----- student: browse + interest flow -----
  async browse(gender: Gender): Promise<RoommatePost[]> {
    const { data, error } = await db().rpc('roommate_browse', { p_gender: gender })
    fail(error)
    return ((data ?? []) as Row[]).map(rowToPost)
  },

  async showInterest(postId: string, name: string, gender: Gender, whatsapp: string, note: string): Promise<void> {
    fail((await db().rpc('roommate_express_interest', { p_post_id: postId, p_name: name, p_gender: gender, p_whatsapp: whatsapp, p_note: note })).error)
  },
  async received(): Promise<ReceivedInterest[]> {
    const { data, error } = await db().rpc('roommate_interests_received')
    fail(error)
    return ((data ?? []) as Row[]).map((r) => ({ id: str(r.id), postId: str(r.post_id), fromName: str(r.from_name), note: str(r.note), status: r.status as ReceivedInterest['status'], createdAt: str(r.created_at), whatsapp: r.whatsapp ? str(r.whatsapp) : null }))
  },
  async sent(): Promise<SentInterest[]> {
    const { data, error } = await db().rpc('roommate_interests_sent')
    fail(error)
    return ((data ?? []) as Row[]).map((r) => ({ id: str(r.id), postId: str(r.post_id), firstName: str(r.first_name), area: str(r.area), status: r.status as SentInterest['status'], createdAt: str(r.created_at), whatsapp: r.whatsapp ? str(r.whatsapp) : null }))
  },
  async respond(id: string, accept: boolean): Promise<void> { fail((await db().rpc('roommate_respond', { p_id: id, p_accept: accept })).error) },
  async withdraw(id: string): Promise<void> { fail((await db().rpc('roommate_withdraw_interest', { p_id: id })).error) },
  async report(postId: string, reason: string): Promise<void> { fail((await db().rpc('roommate_report', { p_post_id: postId, p_reason: reason })).error) },

  // ----- admin -----
  async adminPosts(): Promise<{ posts: RoommatePost[]; phones: Record<string, string>; reports: Report[] }> {
    const [p, c, r] = await Promise.all([
      db().from('roommate_posts').select('*').order('updated_at', { ascending: false }),
      db().from('roommate_contacts').select('post_id, whatsapp'),
      db().from('roommate_reports').select('post_id, reason, created_at').order('created_at', { ascending: false }),
    ])
    fail(p.error); fail(c.error); fail(r.error)
    const phones: Record<string, string> = {}
    for (const row of c.data ?? []) phones[str(row.post_id)] = str(row.whatsapp)
    return {
      posts: ((p.data ?? []) as Row[]).map(rowToPost), phones,
      reports: (r.data ?? []).map((x) => ({ postId: str(x.post_id), reason: str(x.reason), createdAt: str(x.created_at) })),
    }
  },
  async review(id: string, approve: boolean, reason = ''): Promise<void> {
    const patch = approve ? { status: 'approved', reject_reason: null } : { status: 'rejected', reject_reason: reason || 'Not approved' }
    fail((await db().from('roommate_posts').update(patch).eq('id', id)).error)
  },
  async clearReports(postId: string): Promise<void> { fail((await db().from('roommate_reports').delete().eq('post_id', postId)).error) },
}

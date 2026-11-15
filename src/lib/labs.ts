import { auth } from './firebase'

/** Study Labs Apps Script web app URL (the /exec link). */
const API = import.meta.env.VITE_LABS_API_URL as string | undefined
export const labsReady = Boolean(API)

/* ---------- types ---------- */

export type ResourceType = 'note' | 'cat' | 'paper' | 'video'
export type ExamType = 'CAT' | 'Main exam' | 'Supplementary' | 'Special exam'
export type ResourceStatus = 'pending' | 'approved' | 'rejected'

export type EventKind = 'exam' | 'cat' | 'important' | 'event'

export type YtVideo = {
  videoId: string
  title: string
  channel: string
  publishedAt?: string
  thumbnail?: string
}

export type CalEvent = {
  id: string
  title: string
  start: string
  end: string
  allDay: boolean
  kind: EventKind
  location?: string
  description?: string
  link?: string
}

export type EventsResult = {
  configured: boolean
  events: CalEvent[]
}

export const TYPE_LABELS: Record<ResourceType, string> = {
  note: 'Notes',
  cat: 'CATs',
  paper: 'Past papers',
  video: 'Videos',
}

export const EXAM_TYPES: ExamType[] = [
  'CAT',
  'Main exam',
  'Supplementary',
  'Special exam',
]

export type LabsConfig = {
  types: { key: ResourceType; label: string }[]
  examTypes: ExamType[]
  maxFiles: number
  maxFileMB: number
  maxTotalMB: number
  extensions: string[]
  calendar?: boolean
}

export type Programme = {
  id: string
  name: string
  department: string
  level: string
  years: number
  active: boolean
}

export type UnitCounts = Record<ResourceType, number>

export type Unit = {
  id: string
  programmeId: string
  year: number
  semester: number
  code: string
  name: string
  counts: UnitCounts
  programmeName?: string
}

export type LabFile = {
  id: string
  name: string
  mime: string
  sizeKB: number
  isImage: boolean
  view?: string
  download?: string
  thumb?: string
}

export type Resource = {
  id: string
  unitId: string
  unitCode: string
  unitName: string
  programmeId: string
  programmeName: string
  year: number
  semester: number
  type: ResourceType
  title: string
  examType: ExamType | ''
  academicYear: string
  description: string
  link: string
  status: ResourceStatus
  rejectReason: string
  uploaderName: string
  createdAt: string
  files: LabFile[]
  uploaderEmail?: string
  uploaderId?: string
  reviewedBy?: string
  duplicates?: {
    id: string
    title: string
    status: ResourceStatus
  }[]
  /** Only on the single-resource lookup used by share links. */
  unit?: Unit | null
}

/** What the admin calendar form sends. date / endDate are YYYY-MM-DD, times are HH:MM. */
export type EventInput = {
  title: string
  date: string
  endDate?: string
  allDay: boolean
  startTime?: string
  endTime?: string
  location?: string
  description?: string
}

export type Suggestion = {
  id: string
  programmeId?: string
  programmeName: string
  year: number
  semester: number
  code: string
  name: string
  status: 'pending' | 'approved' | 'rejected'
  note?: string
  userName?: string
  userEmail?: string
  createdAt?: string
}

export type UploadFile = {
  name: string
  data: string
}

export type SubmitInput = {
  unitId: string
  type: ResourceType
  title: string
  examType?: ExamType
  academicYear?: string
  description?: string
  link?: string
  files?: UploadFile[]
}

export type AdminQueue = {
  pending: Resource[]
  pendingSuggestions: number
  openReports: number
}

export type ReportItem = {
  id: string
  reason: string
  createdAt: string
  resource: Resource | null
}

export type ImportSummary = {
  pagesRead: number
  mainCampusFound: number
  added: number
  alreadyHad: number
  otherCampusSkipped: number
}

/* ---------- access (free trial + support payment) ---------- */

export type PaymentInfo = {
  priceKes: number
  trialDays: number
  whatsapp: string
  whatsappLink: string
  note: string
}

export type AccessInfo = {
  status: 'admin' | 'trial' | 'paid' | 'expired'
  active: boolean
  daysLeft: number
  trialEndsAt: string
  paidUntil: string
  payment: PaymentInfo
}

export type AccessUser = {
  email: string
  name: string
  trialStart: string
  paidUntil: string
  status: 'new' | 'trial' | 'paid' | 'expired'
  activatedBy: string
}

/** Thrown when the free trial is over. The page listens for PAYWALL_EVENT and shows the payment card. */
export const PAYWALL_EVENT = 'labs-paywall'
export class PaywallError extends Error {
  payment: PaymentInfo | null
  constructor(message: string, payment: PaymentInfo | null) {
    super(message)
    this.payment = payment
  }
}

export type Countdown = {
  set: boolean
  title?: string
  date?: string
  time?: string
  endDate?: string
}

/* ---------- transport ---------- */

/** Calls the Study Labs Apps Script backend. */
async function call<T>(
  action: string,
  payload: Record<string, unknown> = {},
): Promise<T> {
  if (!API) {
    throw new Error(
      'Study Labs server not connected yet. Add VITE_LABS_API_URL to .env.',
    )
  }

  const idToken = await auth?.currentUser?.getIdToken()

  // text/plain avoids a CORS preflight with Google Apps Script.
  // Put action last so a payload cannot overwrite it.
  const send = () =>
    fetch(API, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({
        ...payload,
        idToken,
        action,
      }),
    })

  let res: Response

  try {
    res = await send()
  } catch {
    try {
      res = await send()
    } catch {
      throw new Error(
        'Could not reach the Study Labs server. Check your internet and that the deployment is set to "Anyone".',
      )
    }
  }

  let j: {
    ok: boolean
    data?: unknown
    error?: string
    code?: string
    payment?: PaymentInfo | null
  }

  try {
    j = await res.json()
  } catch {
    throw new Error(
      'The Study Labs server sent an unexpected reply. In Apps Script use Deploy > Manage deployments > Edit > New version.',
    )
  }

  if (!j.ok) {
    if (j.code === 'payment_required') {
      const err = new PaywallError(j.error || 'Your free trial has ended.', j.payment ?? null)
      window.dispatchEvent(new CustomEvent(PAYWALL_EVENT, { detail: err.payment }))
      throw err
    }
    throw new Error(j.error || 'Request failed')
  }

  return j.data as T
}

/* ---------- API ---------- */

export const labsApi = {
  // Public actions

  config: () => call<LabsConfig>('config'),

  adminCheck: () =>
    call<{
      signedIn: boolean
      isAdmin: boolean
    }>('admin_check'),

  /** Signed-in student: trial / paid / expired status. Starts the 2-week trial on first call. */
  access: () => call<AccessInfo>('access'),

  /** Exam countdown for the landing page (public). */
  countdown: () => call<Countdown>('countdown'),

  programmes: () => call<Programme[]>('programmes'),

  units: (programmeId: string) =>
    call<Unit[]>('units', { programmeId }),

  search: (q: string, programmeId?: string) =>
    call<{
      units: Unit[]
      resources: Resource[]
    }>('search', { q, programmeId }),

  resources: (unitId: string, type?: ResourceType) =>
    call<Resource[]>('resources', { unitId, type }),

  /** One resource by id (share links). Needs the "resource" action on the server (v1.2.0+). */
  resource: (id: string) => call<Resource>('resource', { id }),

  // YouTube search
  // Requires the Apps Script backend to implement "yt_search".

  ytSearch: (q: string) =>
    call<YtVideo[]>('yt_search', { q }),

  // Academic calendar
  // Requires the Apps Script backend to implement "events".

  events: (from: string, to: string) =>
    call<EventsResult>('events', { from, to }),

  // Signed-in students

  submit: (input: SubmitInput) =>
    call<{
      id: string
      status: 'pending'
      files: number
    }>('submit', { ...input }),

  myUploads: () =>
    call<{
      resources: Resource[]
      suggestions: Suggestion[]
    }>('my_uploads'),

  deleteMine: (id: string) =>
    call<{
      deleted: boolean
    }>('delete_mine', { id }),

  /** Opens a pending/own file as a blob URL. */
  preview: async (fileId: string) => {
    const r = await call<{
      name: string
      mime: string
      data: string
    }>('preview', { fileId })

    const bytes = Uint8Array.from(
      atob(r.data),
      (c) => c.charCodeAt(0),
    )

    return {
      name: r.name,
      mime: r.mime,
      url: URL.createObjectURL(
        new Blob([bytes], { type: r.mime }),
      ),
    }
  },

  report: (resourceId: string, reason: string) =>
    call<{
      ok: boolean
    }>('report', { resourceId, reason }),

  suggestUnit: (s: {
    programmeId: string
    year: number
    semester: number
    code: string
    name: string
  }) =>
    call<{
      id: string
      status: 'pending'
    }>('suggest_unit', { ...s }),

  // Admin actions

  admin: {
    queue: () =>
      call<AdminQueue>('admin_queue'),

    setCountdown: (c: { title: string; date: string; time?: string; endDate?: string }) =>
      call<Countdown>('admin_set_countdown', c),

    clearCountdown: () => call<Countdown>('admin_clear_countdown'),

    users: (q?: string) => call<AccessUser[]>('admin_users', { q }),

    activate: (email: string, days?: number) =>
      call<AccessUser>('admin_activate', { email, days }),

    deactivate: (email: string) =>
      call<{ ok: boolean }>('admin_deactivate', { email }),

    review: (
      id: string,
      decision: 'approve' | 'reject',
      opts: {
        reason?: string
        edits?: Partial<
          Pick<
            SubmitInput,
            | 'unitId'
            | 'type'
            | 'title'
            | 'examType'
            | 'academicYear'
            | 'description'
          >
        >
      } = {},
    ) =>
      call<{
        status: ResourceStatus
      }>('admin_review', {
        id,
        decision,
        ...opts,
      }),

    resources: (
      f: {
        q?: string
        status?: ResourceStatus
        unitId?: string
      } = {},
    ) =>
      call<Resource[]>('admin_resources', { ...f }),

    deleteResource: (id: string) =>
      call<{
        deleted: boolean
      }>('admin_delete_resource', { id }),

    reports: () =>
      call<ReportItem[]>('admin_reports'),

    resolveReport: (
      id: string,
      resolution: 'dismiss' | 'unpublish' | 'delete',
      note?: string,
    ) =>
      call<{
        ok: boolean
      }>('admin_resolve_report', {
        id,
        resolution,
        note,
      }),

    suggestions: () =>
      call<Suggestion[]>('admin_suggestions'),

    decideSuggestion: (
      id: string,
      decision: 'approve' | 'reject',
      opts: {
        reason?: string
        edits?: Partial<Suggestion>
      } = {},
    ) =>
      call<{
        ok: boolean
      }>('admin_decide_suggestion', {
        id,
        decision,
        ...opts,
      }),

    programmes: () =>
      call<Programme[]>('admin_programmes'),

    addProgramme: (p: {
      name: string
      level: string
      department?: string
      years?: number
    }) =>
      call<{
        id: string
      }>('admin_add_programme', { ...p }),

    updateProgramme: (
      id: string,
      patch: Partial<
        Pick<
          Programme,
          'active' | 'years' | 'name' | 'department'
        >
      >,
    ) =>
      call<{
        ok: boolean
      }>('admin_update_programme', {
        id,
        ...patch,
      }),

    importProgrammes: () =>
      call<ImportSummary>('admin_import_programmes'),

    addUnit: (u: {
      programmeId: string
      year: number
      semester: number
      code: string
      name: string
    }) =>
      call<{
        created: boolean
        id: string
      }>('admin_add_unit', { ...u }),

    /** One unit per line: "year, semester, code, name". */
    bulkUnits: (programmeId: string, text: string) =>
      call<{
        added: number
        skipped: number
        errors: string[]
      }>('admin_bulk_units', {
        programmeId,
        text,
      }),

    updateUnit: (
      id: string,
      patch: Partial<{
        year: number
        semester: number
        code: string
        name: string
        status: 'active' | 'hidden'
      }>,
    ) =>
      call<{
        ok: boolean
      }>('admin_update_unit', {
        id,
        ...patch,
      }),

    deleteUnit: (id: string) =>
      call<{
        deleted: boolean
      }>('admin_delete_unit', { id }),

    // Calendar (exams, CATs, important dates)

    events: () =>
      call<EventsResult>('admin_events'),

    addEvent: (e: EventInput) =>
      call<CalEvent>('admin_add_event', { ...e }),

    updateEvent: (id: string, e: EventInput) =>
      call<CalEvent>('admin_update_event', { id, ...e }),

    deleteEvent: (id: string) =>
      call<{
        deleted: boolean
      }>('admin_delete_event', { id }),
  },
}

/* ---------- helpers ---------- */

export const STUDY_IMAGE_MAX_PX = 1600
export const STUDY_IMAGE_QUALITY = 0.8

export const yearLabel = (y: number) =>
  `Year ${y}`

export const semesterLabel = (s: number) =>
  `Semester ${s}`

/** Current academic year as "2026/2027" (Kenyan academic year). */
export function currentAcademicYear(now?: Date) {
  const d = now ?? new Date()
  const y =
    d.getMonth() >= 8
      ? d.getFullYear()
      : d.getFullYear() - 1

  return `${y}/${y + 1}`
}

/* ---------- share links & YouTube helpers ---------- */

/** Direct link to one resource, e.g. https://site/#/labs/r/r_abc123 */
export function shareUrl(resourceId: string) {
  const base = window.location.href.split('#')[0]
  return `${base}#/labs/r/${resourceId}`
}

/** Reads the resource id from a share link hash, or null. */
export function resourceIdFromHash(hash: string) {
  const m = /^#\/labs\/r\/(r_[A-Za-z0-9]+)/.exec(hash)
  return m ? m[1] : null
}

/** YouTube video id from a youtube.com / youtu.be link, or ''. */
export function youtubeId(url: string) {
  if (!url) return ''
  try {
    const u = new URL(url)
    const h = u.hostname.replace(/^www\.|^m\./, '')
    if (h === 'youtu.be') return u.pathname.slice(1).split('/')[0] ?? ''
    if (h === 'youtube.com' || h === 'youtube-nocookie.com') {
      if (u.pathname === '/watch') return u.searchParams.get('v') ?? ''
      const m = /^\/(embed|shorts|live)\/([\w-]{6,20})/.exec(u.pathname)
      if (m) return m[2]
    }
  } catch {
    /* not a url */
  }
  return ''
}

export const youtubeWatchUrl = (id: string) =>
  `https://www.youtube.com/watch?v=${id}`

export const youtubeThumb = (id: string) =>
  `https://i.ytimg.com/vi/${id}/mqdefault.jpg`

/** Mirrors the server: the colour of an event comes from words in its title. */
export function eventKindOf(title: string): EventKind {
  const s = title.toLowerCase()
  if (/\b(cats?|continuous assessments?)\b/.test(s)) return 'cat'
  if (/\b(exams?|examinations?|supplementary|supp|resit|special exam)\b/.test(s)) return 'exam'
  if (/\b(deadline|registration|reporting|graduation|holiday|closing|opening|fees|orientation|results?|important|notice)\b/.test(s)) return 'important'
  return 'event'
}
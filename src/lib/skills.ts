import { makeApi, DEFAULT_RULES, type Attachment, type FileRules, type UploadFile } from './hub'

const raw = makeApi(import.meta.env.VITE_SKILLS_API_URL as string | undefined, 'Skills', 'VITE_SKILLS_API_URL')
export const skillsReady = raw.ready
/** Same as the shared call, but explains the common "Unknown action" problem (an old script is still deployed). */
const api = {
  ready: raw.ready,
  call: (async (action: string, payload?: Record<string, unknown>) => {
    try { return await raw.call(action, payload) } catch (e) {
      const m = e instanceof Error ? e.message : ''
      if (/unknown action/i.test(m)) throw new Error(`The Skills server does not know "${action}". The deployed Apps Script is an OLD version: paste Skills.gs, then Deploy > Manage deployments > Edit > New version, and make sure VITE_SKILLS_API_URL is that deployment's /exec URL.`)
      throw e
    }
  }) as typeof raw.call,
}

export type Status = 'pending' | 'approved' | 'rejected'
export type Mode = 'online' | 'physical' | 'hybrid'
export type Provider = { name: string; about: string; url: string; search: boolean }
export type Prices = { full: number; course: number; session: number; passDays: number }
export type LiveState = { on: boolean; title?: string; classId?: string; free?: boolean; locked?: boolean; videoId?: string }
export type SkillsConfig = { categories: string[]; levels: string[]; providers: Provider[]; files: FileRules; searchReady: boolean; whatsapp: string; allowTutorCreate: boolean; payTo: string; prices: Prices; live: LiveState; channelId: string; channelHandle: string }
export type AccessKind = 'full' | 'course' | 'session'
export type ClassAccess = 'all' | 'sessions' | 'none'
export type ChannelVideo = { videoId: string; title: string; published: string; thumbnail: string }
export type PendingAccess = { orderId: string; kind: AccessKind; title: string; price: number; classId: string; sessionId: string; mpesaCode: string; createdAt: string }
export type MyAccess = { full: boolean; passExpires: string; courses: string[]; sessions: string[]; pending: PendingAccess[]; prices: Prices }
export type SoftwarePrice = 'Free' | 'Free trial' | 'Paid'
export type Software = { id: string; name: string; description: string; url: string; platform: string; price: SoftwarePrice; note: string; status: 'live' | 'hidden'; sort: number }
export type SoftwareInput = { id?: string; name: string; description: string; url: string; platform: string; price: SoftwarePrice; note: string; status: 'live' | 'hidden'; sort: number }
export const SW_PLATFORMS = ['All', 'Windows', 'Mac', 'Linux', 'Android', 'iPhone', 'Web']
export const CHANNEL_URL = 'https://www.youtube.com/@ChukaAIcommunity'
export type Session = { id: string; title: string; startAt: string; endAt: string; note: string; paid?: boolean }
export type UpcomingSession = { id: string; classId: string; classTitle: string; skill: string; mode: Mode; venue: string; title: string; startAt: string; endAt: string }

/** Admin WhatsApp number (country code, no +). People who want to teach a class message this number. */
export const ADMIN_WA = (import.meta.env.VITE_ADMIN_WHATSAPP as string) || '254184198432'
export type Rec = {
  id: string; kind: 'video' | 'course'; title: string; url: string; videoId: string; channel: string; thumbnail: string; provider: string; isFree: string
  skill: string; category: string; reason: string; status: Status; rejectReason: string; userName: string; createdAt: string; votes: number; myVote: boolean; userEmail?: string; nextStep?: string; featured?: boolean
}
export type ClassItem = {
  id: string; title: string; skill: string; category: string; level: string; description: string; mode: Mode; venue: string; schedule: string; startDate: string
  capacity: number; status: Status; rejectReason: string; tutorName: string; createdAt: string; memberCount: number; joined: boolean; mine: boolean
  attachments: Attachment[]; sessions: Session[]; joinLink?: string; tutorEmail?: string; meetSpace?: string; access?: ClassAccess
}
export type ClassPost = { id: string; text: string; link: string; authorName: string; createdAt: string; attachments: Attachment[]; mine: boolean }
export type ClassDetail = { cls: ClassItem; posts: ClassPost[]; members: { name: string; email: string }[] }
export type YtResult = { videoId: string; title: string; channel: string; thumbnail: string }
export type YtResponse = { items: YtResult[]; fallbackUrl: string; error?: string }
export type ClassInput = {
  id?: string; title: string; skill: string; category: string; level: string; description: string; mode: Mode; venue: string; schedule: string
  startDate?: string; capacity: number; joinLink: string; files?: UploadFile[]; removeFileIds?: string[]
  tutorName?: string; meetSpace?: string
}
export type RecInput = { kind: 'video' | 'course'; url: string; title?: string; skill: string; category: string; reason: string; provider?: string; isFree?: string; nextStep?: string }

export const PAY_TO = (import.meta.env.VITE_PAY_TO as string) || '0184198432'

export type Product = {
  id: string; title: string; description: string; skill: string; category: string; level: string; price: number; format: string; coverUrl: string
  status: 'draft' | 'live' | 'archived'; createdAt: string; owned: boolean; myOrder: '' | 'pending' | 'active'; deliverLink?: string; attachments?: Attachment[]
}
export type ProductInput = {
  id?: string; title: string; description: string; skill: string; category: string; level: string; price: number; format: string; deliverLink: string
  status: 'draft' | 'live'; cover?: UploadFile; files?: UploadFile[]; removeFileIds?: string[]
}
export type OrderStatus = 'pending' | 'active' | 'rejected'
export type Order = { kind?: string; classId?: string; sessionId?: string; id: string; productId: string; productTitle: string; price: number; name: string; email: string; mpesaCode: string; status: OrderStatus; note: string; createdAt: string; decidedAt: string }
export type PendingOrder = { orderId: string; productId: string; title: string; price: number; mpesaCode: string; createdAt: string }

export const FALLBACK_CONFIG: SkillsConfig = { categories: [], levels: ['All levels'], providers: [], files: DEFAULT_RULES, searchReady: false, whatsapp: ADMIN_WA, allowTutorCreate: false, payTo: PAY_TO,
  prices: { full: 2000, course: 1000, session: 100, passDays: 0 }, live: { on: false }, channelId: '', channelHandle: 'ChukaAIcommunity' }

export const skillsApi = {
  call: api.call,
  config: () => api.call<SkillsConfig>('config'),
  ping: () => api.call<{ version: string }>('ping'),
  adminCheck: () => api.call<{ signedIn: boolean; isAdmin: boolean }>('admin_check'),
  recs: (f: { kind?: string; category?: string; q?: string } = {}) => api.call<Rec[]>('recs', { ...f }),
  submitRec: (r: RecInput) => api.call<{ id: string; status: 'pending' }>('rec_submit', { ...r }),
  vote: (id: string) => api.call<{ votes: number }>('rec_vote', { id }),
  ytSearch: (q: string) => api.call<YtResponse>('yt_search', { q }),
  software: () => api.call<Software[]>('software'),
  upcoming: () => api.call<UpcomingSession[]>('sessions_upcoming'),
  products: () => api.call<Product[]>('products'),
  order: (productId: string, mpesaCode?: string) => api.call<{ id: string; status: OrderStatus; price: number; productTitle: string; payTo: string }>('order_create', { productId, mpesaCode }),
  accessOrder: (p: { kind: AccessKind; classId?: string; sessionId?: string; mpesaCode?: string }) =>
    api.call<{ id: string; status: OrderStatus; price: number; title: string; payTo: string }>('access_order', { ...p }),
  myAccess: () => api.call<MyAccess>('my_access'),
  channelFeed: () => api.call<{ items: ChannelVideo[]; error?: string }>('channel_feed'),
  library: () => api.call<{ library: Product[]; pending: PendingOrder[] }>('my_library'),
  classes: (q = '', category = '') => api.call<ClassItem[]>('classes', { q, category }),
  classGet: (id: string) => api.call<ClassDetail>('class_get', { id }),
  saveClass: (c: ClassInput) => api.call<{ id: string; status: 'pending' }>('class_save', { ...c }),
  deleteClass: (id: string) => api.call<{ deleted: boolean }>('class_delete', { id }),
  join: (id: string) => api.call<{ joinLink: string }>('class_join', { id }),
  leave: (id: string) => api.call<{ ok: boolean }>('class_leave', { id }),
  post: (p: { classId: string; text: string; link?: string; files?: UploadFile[] }) => api.call<{ id: string }>('class_post', { ...p }),
  deletePost: (id: string) => api.call<{ deleted: boolean }>('class_post_delete', { id }),
  mine: () => api.call<{ teaching: ClassItem[]; joined: ClassItem[]; recs: Rec[] }>('my_skills'),
  admin: {
    saveClass: (c: ClassInput) => api.call<{ id: string; status: Status }>('admin_class_save', { ...c }),
    addSession: (s: { classId: string; start: string; minutes: number; weeks?: number; meet?: boolean; title?: string; note?: string }) =>
      api.call<{ id: string; count: number; warning: string; joinLink: string }>('admin_session_add', { ...s }),
    software: () => api.call<Software[]>('admin_software'),
    saveSoftware: (x: SoftwareInput) => api.call<{ id: string; status: string }>('admin_software_save', { ...x }),
    deleteSoftware: (id: string) => api.call<{ deleted: boolean }>('admin_software_delete', { id }),
    products: () => api.call<Product[]>('admin_products'),
    saveProduct: (p: ProductInput) => api.call<{ id: string; status: string }>('admin_product_save', { ...p }),
    deleteProduct: (id: string) => api.call<{ archived?: boolean; deleted?: boolean }>('admin_product_delete', { id }),
    orders: () => api.call<{ stats: { pending: number; active: number; revenue: number }; orders: Order[] }>('admin_orders'),
    decideOrder: (id: string, decision: 'activate' | 'reject', note?: string) => api.call<{ status: OrderStatus }>('admin_order_decide', { id, decision, note }),
    saveCategories: (categories: string[]) => api.call<{ categories: string[] }>('admin_categories_save', { categories }),
    importPlaylist: (p: { url: string; skill: string; category: string; limit?: number; reason?: string }) => api.call<{ added: number; skipped: number }>('admin_playlist_import', { ...p }),
    setLive: (l: { on: boolean; videoId?: string; title?: string; classId?: string; free?: boolean }) => api.call<LiveState>('admin_live_set', { ...l }),
    featureRec: (id: string, off?: boolean) => api.call<{ ok: boolean }>('admin_rec_feature', { id, off }),
    deleteSession: (id: string) => api.call<{ deleted: boolean }>('admin_session_delete', { id }),
    queue: () => api.call<{ classes: ClassItem[]; recs: Rec[] }>('admin_queue'),
    reviewClass: (id: string, decision: 'approve' | 'reject', reason?: string) => api.call<{ status: Status }>('admin_review_class', { id, decision, reason }),
    reviewRec: (id: string, decision: 'approve' | 'reject', reason?: string, edits?: { title?: string; category?: string }) =>
      api.call<{ status: Status }>('admin_review_rec', { id, decision, reason, edits }),
    classes: () => api.call<ClassItem[]>('admin_classes'),
    deleteClass: (id: string) => api.call<{ deleted: boolean }>('admin_delete_class', { id }),
    deleteRec: (id: string) => api.call<{ deleted: boolean }>('admin_delete_rec', { id }),
  },
}

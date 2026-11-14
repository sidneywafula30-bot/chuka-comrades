import { makeApi, DEFAULT_RULES, type Attachment, type FileRules, type UploadFile } from './hub'

const api = makeApi(import.meta.env.VITE_SKILLS_API_URL as string | undefined, 'Skills', 'VITE_SKILLS_API_URL')
export const skillsReady = api.ready

export type Status = 'pending' | 'approved' | 'rejected'
export type Mode = 'online' | 'physical' | 'hybrid'
export type Provider = { name: string; about: string; url: string; search: boolean }
export type SkillsConfig = { categories: string[]; levels: string[]; providers: Provider[]; files: FileRules; searchReady: boolean; whatsapp: string; allowTutorCreate: boolean }
export type Session = { id: string; title: string; startAt: string; endAt: string; note: string }
export type UpcomingSession = { id: string; classId: string; classTitle: string; skill: string; mode: Mode; venue: string; title: string; startAt: string; endAt: string }

/** Admin WhatsApp number (country code, no +). People who want to teach a class message this number. */
export const ADMIN_WA = (import.meta.env.VITE_ADMIN_WHATSAPP as string) || '254184198432'
export type Rec = {
  id: string; kind: 'video' | 'course'; title: string; url: string; videoId: string; channel: string; thumbnail: string; provider: string; isFree: string
  skill: string; category: string; reason: string; status: Status; rejectReason: string; userName: string; createdAt: string; votes: number; myVote: boolean; userEmail?: string
}
export type ClassItem = {
  id: string; title: string; skill: string; category: string; level: string; description: string; mode: Mode; venue: string; schedule: string; startDate: string
  capacity: number; status: Status; rejectReason: string; tutorName: string; createdAt: string; memberCount: number; joined: boolean; mine: boolean
  attachments: Attachment[]; sessions: Session[]; joinLink?: string; tutorEmail?: string; meetSpace?: string
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
export type RecInput = { kind: 'video' | 'course'; url: string; title?: string; skill: string; category: string; reason: string; provider?: string; isFree?: string }

export const FALLBACK_CONFIG: SkillsConfig = { categories: [], levels: ['All levels'], providers: [], files: DEFAULT_RULES, searchReady: false, whatsapp: ADMIN_WA, allowTutorCreate: false }

export const skillsApi = {
  call: api.call,
  config: () => api.call<SkillsConfig>('config'),
  adminCheck: () => api.call<{ signedIn: boolean; isAdmin: boolean }>('admin_check'),
  recs: (f: { kind?: string; category?: string; q?: string } = {}) => api.call<Rec[]>('recs', { ...f }),
  submitRec: (r: RecInput) => api.call<{ id: string; status: 'pending' }>('rec_submit', { ...r }),
  vote: (id: string) => api.call<{ votes: number }>('rec_vote', { id }),
  ytSearch: (q: string) => api.call<YtResponse>('yt_search', { q }),
  upcoming: () => api.call<UpcomingSession[]>('sessions_upcoming'),
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
    createMeet: () => api.call<{ meetingUri: string; space: string; open: boolean }>('admin_meet_create'),
    addSession: (s: { classId: string; start: string; minutes: number; title?: string; note?: string }) => api.call<{ id: string; warning: string }>('admin_session_add', { ...s }),
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

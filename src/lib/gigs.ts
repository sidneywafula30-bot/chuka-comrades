import { makeApi, DEFAULT_RULES, type Attachment, type FileRules, type UploadFile } from './hub'

const api = makeApi(import.meta.env.VITE_GIGS_API_URL as string | undefined, 'Gigs', 'VITE_GIGS_API_URL')
export const gigsReady = api.ready

export type PayType = 'fixed' | 'hourly' | 'negotiable' | 'unpaid'
export type Method = 'whatsapp' | 'phone' | 'email'
export type GigStatus = 'pending' | 'approved' | 'rejected'
export type GigsConfig = { categories: string[]; payTypes: PayType[]; files: FileRules }
export type Gig = {
  id: string; title: string; category: string; description: string; payType: PayType; payAmount: string; location: string; deadline: string
  contactMethod: Method; status: GigStatus; rejectReason: string; posterName: string; createdAt: string; attachments: Attachment[]; mine: boolean
  contact?: string; flags?: string; contactCount?: number; posterEmail?: string   // owner/admin only
}
export type GigInput = {
  id?: string; title: string; category: string; description: string; payType: PayType; payAmount?: string; location: string; deadline?: string
  contactMethod: Method; contact: string; files?: UploadFile[]; removeFileIds?: string[]
}
export type GigReport = { id: string; reason: string; createdAt: string; gig: Gig | null }

export const FALLBACK_CONFIG: GigsConfig = { categories: [], payTypes: ['fixed', 'hourly', 'negotiable', 'unpaid'], files: DEFAULT_RULES }
export const PAY_LABELS: Record<PayType, string> = { fixed: 'Fixed price', hourly: 'Per hour', negotiable: 'Negotiable', unpaid: 'Unpaid / volunteer' }
export const payLabel = (g: Pick<Gig, 'payType' | 'payAmount'>) =>
  g.payType === 'fixed' ? `KSh ${Number(g.payAmount).toLocaleString('en-KE')}` : g.payType === 'hourly' ? `KSh ${Number(g.payAmount).toLocaleString('en-KE')}/hr` : PAY_LABELS[g.payType]

export const gigsApi = {
  call: api.call,
  config: () => api.call<GigsConfig>('config'),
  adminCheck: () => api.call<{ signedIn: boolean; isAdmin: boolean }>('admin_check'),
  list: (q: string, category: string) => api.call<Gig[]>('list', { q, category }),
  contact: (gigId: string) => api.call<{ method: Method; contact: string }>('contact', { gigId }),
  post: (g: GigInput) => api.call<{ id: string; status: 'pending' }>('post', { ...g }),
  mine: () => api.call<Gig[]>('my_gigs'),
  deleteMine: (id: string) => api.call<{ deleted: boolean }>('delete_mine', { id }),
  report: (gigId: string, reason: string) => api.call<{ ok: boolean }>('report', { gigId, reason }),
  admin: {
    queue: () => api.call<{ pending: Gig[]; openReports: number }>('admin_queue'),
    review: (id: string, decision: 'approve' | 'reject', reason?: string) => api.call<{ status: GigStatus }>('admin_review', { id, decision, reason }),
    gigs: (q = '', status = '') => api.call<Gig[]>('admin_gigs', { q, status }),
    remove: (id: string) => api.call<{ deleted: boolean }>('admin_delete', { id }),
    reports: () => api.call<GigReport[]>('admin_reports'),
    resolve: (id: string, resolution: 'dismiss' | 'unpublish' | 'delete') => api.call<{ ok: boolean }>('admin_resolve_report', { id, resolution }),
  },
}

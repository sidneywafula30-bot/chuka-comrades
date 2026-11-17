import { auth } from './firebase'
import { currentAcademicYear, type ScanCandidate } from './labs'

/** Background scan jobs. The work itself is done by public/scan-runner.js (shared with the service worker). */

export type JobQuestion = { id: string; number: string; text: string; marks: string; answer: string }
export type JobMeta = { isExamPaper: boolean; unitCode: string; unitName: string; duration: string; totalMarks: string; instructions: string; duplicate: boolean }
export type ScanJob = {
  id: string; uid: string; api: string; token: string; tokenAt: number
  status: 'queued' | 'running' | 'paused' | 'needs_review' | 'done' | 'failed' | 'cancelled'
  message: string; error: string; reason?: string
  createdAt: number; updatedAt: number
  pages: string[]; pageTotal: number; pagesRead: number; results: Record<string, unknown>; built?: boolean
  questions: JobQuestion[]; meta: JobMeta | null; cands: ScanCandidate[]
  examType: string; ay: string; title: string; savedQuestions?: number
}

type Runner = {
  getJob: (id: string) => Promise<ScanJob | null>
  putJob: (job: ScanJob, force?: boolean) => Promise<ScanJob>
  allJobs: () => Promise<ScanJob[]>
  delJob: (id: string) => Promise<void>
  run: (id: string) => Promise<ScanJob | null>
}
declare global { interface Window { __scanRunner?: Runner } }

const API = import.meta.env.VITE_LABS_API_URL as string | undefined
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

let loading: Promise<Runner> | null = null
function runner(): Promise<Runner> {
  if (window.__scanRunner) return Promise.resolve(window.__scanRunner)
  loading ??= new Promise<Runner>((resolve, reject) => {
    const s = document.createElement('script')
    s.src = `${import.meta.env.BASE_URL}scan-runner.js`
    s.onload = () => (window.__scanRunner ? resolve(window.__scanRunner) : reject(new Error('Scan helper missing')))
    s.onerror = () => { loading = null; reject(new Error('Could not load the scan helper. Check your internet and try again.')) }
    document.head.appendChild(s)
  })
  return loading
}

type SyncReg = ServiceWorkerRegistration & { sync?: { register: (tag: string) => Promise<void> } }

async function workerReg(): Promise<SyncReg | null> {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return null
  try {
    return (await Promise.race([navigator.serviceWorker.ready, sleep(2000).then(() => null)])) as SyncReg | null
  } catch { return null }
}

function tellWorker(reg: ServiceWorkerRegistration, id: string): Promise<boolean> {
  return new Promise((resolve) => {
    const w = reg.active
    if (!w) return resolve(false)
    const ch = new MessageChannel()
    const t = setTimeout(() => resolve(false), 2500)
    ch.port1.onmessage = () => { clearTimeout(t); resolve(true) }
    w.postMessage({ type: 'scan-run', id }, [ch.port2])
  })
}

export const scanJob = {
  /** Saves the shrunk page photos (base64, no prefix) as a new job. */
  async create(images: string[]): Promise<ScanJob> {
    const user = auth?.currentUser
    if (!user) throw new Error('Please sign in first.')
    if (!API) throw new Error('Study Labs server not connected yet. Add VITE_LABS_API_URL to .env.')
    const r = await runner()
    const id = `scan-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
    const job: ScanJob = {
      id, uid: user.uid, api: API, token: await user.getIdToken(true), tokenAt: Date.now(),
      status: 'queued', message: 'Preparing your pages…', error: '', createdAt: Date.now(), updatedAt: Date.now(),
      pages: images, pageTotal: images.length, pagesRead: 0, results: {}, questions: [], meta: null, cands: [],
      examType: 'CAT', ay: currentAcademicYear(), title: '',
    }
    return r.putJob(job, true)
  },

  /** Starts the job where it can keep going if the browser closes: Background Sync, then the service worker, then this page. */
  async start(id: string): Promise<void> {
    const r = await runner()
    const reg = await workerReg()
    if (reg) {
      let synced = false
      try { if (reg.sync) { await reg.sync.register('comrades-scan'); synced = true } } catch { /* not supported */ }
      if (synced) {
        await sleep(4000) // the browser normally starts the sync at once; if nothing started, ask the worker directly
        const j = await r.getJob(id)
        if (!j || j.status !== 'queued') return
      }
      if (await tellWorker(reg, id)) return
    }
    void r.run(id)
  },

  /** Picks up an unfinished job (refreshing the sign-in token). `force` restarts one that looks stuck. */
  async resume(id: string, force = false): Promise<void> {
    const r = await runner()
    const j = await r.getJob(id)
    if (!j || !['queued', 'running', 'paused'].includes(j.status)) return
    const active = j.status === 'running' && Date.now() - j.updatedAt < 90_000
    if (active && !force) return
    try {
      const user = auth?.currentUser
      if (user && user.uid === j.uid) { j.token = await user.getIdToken(true); j.tokenAt = Date.now() }
      else if (j.error === 'signin') return
    } catch { /* offline: try with the old token */ }
    j.status = 'queued'; j.error = ''; j.message = 'Continuing…'
    await r.putJob(j)
    await this.start(id)
  },

  async get(id: string) { return (await runner()).getJob(id) },

  /** The newest job of this user that has not been dealt with yet. */
  async pending(uid: string): Promise<ScanJob | null> {
    const r = await runner()
    const all = await r.allJobs()
    const week = 7 * 24 * 3600 * 1000
    for (const j of all) if (Date.now() - j.createdAt > week) void r.delJob(j.id)
    return all.filter((j) => j.uid === uid && j.status !== 'cancelled' && Date.now() - j.createdAt <= week).sort((a, b) => b.createdAt - a.createdAt)[0] ?? null
  },

  /** The person has seen the result: forget the job. */
  async ack(id: string) { await (await runner()).delJob(id).catch(() => {}) },

  /** Stops a running job (the runner notices on its next save). */
  async discard(id: string) {
    const r = await runner()
    const j = await r.getJob(id)
    if (j) { j.status = 'cancelled'; j.pages = []; j.questions = []; await r.putJob(j, true).catch(() => {}) }
  },
}

import { auth } from './firebase'
import { fileToB64, shrinkImage } from './files'

/** Shared plumbing for the Gigs and Skills modules (each has its own Apps Script web app). */
export type Note = { type: 'ok' | 'err'; text: string } | null
export type Attachment = { id: string; name: string; mime: string; sizeKB: number; isImage: boolean }
export type UploadFile = { name: string; data: string }
export type FileRules = { maxFiles: number; maxFileMB: number; maxTotalMB: number; extensions: string[] }
export type Call = <T>(action: string, payload?: Record<string, unknown>) => Promise<T>

export const DEFAULT_RULES: FileRules = {
  maxFiles: 5, maxFileMB: 8, maxTotalMB: 20,
  extensions: ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'txt', 'png', 'jpg', 'jpeg', 'webp'],
}
export const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong. Please try again.')
export const fmtDate = (s: string) => (s ? new Date(s).toLocaleDateString('en-KE') : '')

/** Builds the POST helper for one Apps Script URL. Sends the Firebase ID token; the server verifies it. */
export function makeApi(url: string | undefined, label: string, envName: string): { ready: boolean; call: Call } {
  const call: Call = async <T,>(action: string, payload: Record<string, unknown> = {}) => {
    if (!url) throw new Error(`${label} server not connected yet. Add ${envName} to .env and restart.`)
    const idToken = await auth?.currentUser?.getIdToken()
    // text/plain avoids a CORS preflight (Apps Script cannot answer one). `action` goes last so a payload can never replace it.
    const send = () => fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ ...payload, idToken, action }) })
    let res: Response
    try { res = await send() } catch {
      try { res = await send() } catch { throw new Error(`Could not reach the ${label} server. Check your internet and that the deployment is set to "Anyone".`) }
    }
    let j: { ok: boolean; data?: unknown; error?: string }
    try { j = await res.json() } catch { throw new Error(`The ${label} server sent an unexpected reply. In Apps Script use Deploy > Manage deployments > Edit > New version.`) }
    if (!j.ok) throw new Error(j.error || 'Request failed')
    return j.data as T
  }
  return { ready: Boolean(url), call }
}

/** Converts chosen files to base64 (photos are shrunk) and enforces the size rules before sending. */
export async function packFiles(files: File[], rules: FileRules): Promise<UploadFile[]> {
  const out: UploadFile[] = []
  let total = 0
  for (const f of files) {
    if (f.type.startsWith('image/')) {
      const data = (await shrinkImage(f, 1600, 0.8)).split(',')[1] ?? ''
      total += data.length * 0.75; out.push({ name: f.name.replace(/\.[^.]+$/, '') + '.jpg', data })
    } else {
      const data = await fileToB64(f)
      total += data.length * 0.75; out.push({ name: f.name, data })
    }
  }
  if (total > rules.maxTotalMB * 1024 * 1024) throw new Error(`Files are over ${rules.maxTotalMB} MB in total. Remove some and try again.`)
  return out
}

/** Opens an attachment (private; fetched through the server). The window opens first so popup blockers allow it. */
export async function openAttachment(call: Call, fileId: string) {
  const w = window.open('', '_blank')
  try {
    const r = await call<{ name: string; mime: string; data: string }>('preview', { fileId })
    const bytes = Uint8Array.from(atob(r.data), (c) => c.charCodeAt(0))
    const url = URL.createObjectURL(new Blob([bytes], { type: r.mime }))
    if (w) { w.location.href = url } else { const a = document.createElement('a'); a.href = url; a.download = r.name; a.click() }
    setTimeout(() => URL.revokeObjectURL(url), 120000)
  } catch (e) { w?.close(); throw e }
}

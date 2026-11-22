import type { User } from 'firebase/auth'

const API = import.meta.env.VITE_CYBER_API_URL as string | undefined
export const cyReady = Boolean(API)
export const DEFAULT_WA = '254768963173'
export const ADMIN_KEY = 'cy_admin_token'
export const getAdminToken = () => { try { return localStorage.getItem(ADMIN_KEY) || '' } catch { return '' } }

export type Service = { id: string; category: string; name: string; description: string; price: number | string; unit: string; turnaround: string; needsFile: boolean; template: string }
export type Doc = { id: string; category: string; title: string; description: string; fileUrl: string }
export type Settings = { shopName: string; whatsapp: string; hours: string; mpesa: string; deliveryFee: number }
export type Boot = { services: Service[]; documents: Doc[]; settings: Settings }
export type Profile = { name: string; phone: string; reg: string; hostel: string }
export type Me = { email: string; name: string; isAdmin: boolean; profile: Profile | null }
export type Order = { orderId: string; createdAt: string; email: string; name: string; phone: string; reg: string; hostel: string; serviceName: string; qty: number; notes: string; delivery: string; fileName: string; fileUrl: string; total: number | string; status: string; payStatus: string; mpesaCode: string; updatedAt?: string }

/** text/plain avoids a CORS preflight, which Apps Script cannot answer. */
export async function cy<T>(action: string, body: Record<string, unknown> = {}, user?: User | null): Promise<T> {
  if (!API) throw new Error('Cyber server not connected')
  const token = user ? await user.getIdToken() : undefined
  const res = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action, token, adminToken: getAdminToken() || undefined, ...body }) })
  const j = await res.json()
  if (!j.ok) throw new Error(j.error || 'Request failed')
  return j.data as T
}

export function normPhone(p: string | number) {
  const d = String(p ?? '').replace(/\D/g, '')
  if (d.startsWith('254')) return d
  if (d.startsWith('0')) return '254' + d.slice(1)
  return d.length === 9 ? '254' + d : d
}

export function fillTemplate(t: string, v: Record<string, string | number | undefined>) {
  return t.replace(/\{(\w+)\}/g, (_, k) => { const x = v[k]; return x === undefined || x === '' ? '' : String(x) })
    .replace(/\(\s*[, ]*\)/g, '').replace(/\(([^)]*?),\s*\)/g, '($1)').replace(/\s{2,}/g, ' ').trim()
}

export const waLink = (num: string | number, text: string) => `https://wa.me/${normPhone(num)}?text=${encodeURIComponent(text)}`

export function fileToB64(f: File): Promise<string> {
  return new Promise((ok, no) => {
    const r = new FileReader()
    r.onload = () => ok(String(r.result).split(',')[1] || '')
    r.onerror = () => no(new Error('Could not read file'))
    r.readAsDataURL(f)
  })
}

export const money = (n: number | string) => (n === '' || n === undefined || isNaN(Number(n)) ? 'Ask' : `KES ${Number(n).toLocaleString()}`)

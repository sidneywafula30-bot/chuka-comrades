import { supabase } from './supabase'
import { LANDLORD_GROUP_LINK, STUDENT_GROUP_LINK } from './hostel'

export type WaGroup = { id: string; name: string; description: string; link: string; sort: number; active: boolean }

export const WA_LINK_RE = /^https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9_-]{10,}(\?\S*)?$/i

/** Shown until the database answers, and if Supabase is not set up yet. */
export const FALLBACK_GROUPS: WaGroup[] = [
  { id: 'f1', name: 'Hostels: students', description: 'Find hostels, rooms and roommates.', link: STUDENT_GROUP_LINK, sort: 10, active: true },
  { id: 'f2', name: 'Hostels: landlords', description: 'For landlords and hostel managers.', link: LANDLORD_GROUP_LINK, sort: 20, active: true },
]

const CACHE = 'wa_groups_v1'
export const cachedGroups = (): WaGroup[] | null => {
  try { const v = JSON.parse(localStorage.getItem(CACHE) || 'null'); return Array.isArray(v) ? v : null } catch { return null }
}
const remember = (g: WaGroup[]) => { try { localStorage.setItem(CACHE, JSON.stringify(g)) } catch { /* private mode */ } }

const db = () => { if (!supabase) throw new Error('Supabase is not connected yet.'); return supabase }
const row = (r: Record<string, unknown>): WaGroup => ({ id: String(r.id), name: String(r.name), description: String(r.description ?? ''), link: String(r.link), sort: Number(r.sort) || 0, active: r.active !== false })

export const groupsApi = {
  /** Public list (active groups only for everyone except the admin, who gets all through listAll). */
  async list(): Promise<WaGroup[]> {
    const { data, error } = await db().from('whatsapp_groups').select('*').eq('active', true).order('sort').order('created_at')
    if (error) throw new Error(error.message)
    const g = (data ?? []).map(row); remember(g); return g
  },
  async listAll(): Promise<WaGroup[]> {
    const { data, error } = await db().from('whatsapp_groups').select('*').order('sort').order('created_at')
    if (error) throw new Error(error.message)
    return (data ?? []).map(row)
  },
  async isAdmin(): Promise<boolean> {
    const { data, error } = await db().rpc('is_admin')
    return !error && data === true
  },
  async add(g: { name: string; description: string; link: string }): Promise<void> {
    const name = g.name.trim(), link = g.link.trim()
    if (name.length < 2) throw new Error('Give the group a name.')
    if (!WA_LINK_RE.test(link)) throw new Error('Paste the invite link, which starts with https://chat.whatsapp.com/')
    const { error } = await db().from('whatsapp_groups').insert({ name, description: g.description.trim(), link, sort: 100 })
    if (error) throw new Error(error.message.includes('row-level security') ? 'Only the admin can add groups. Sign in with the admin Google account.' : error.message)
  },
  async setActive(id: string, active: boolean): Promise<void> {
    const { error } = await db().from('whatsapp_groups').update({ active }).eq('id', id)
    if (error) throw new Error(error.message)
  },
  async remove(id: string): Promise<void> {
    const { error } = await db().from('whatsapp_groups').delete().eq('id', id)
    if (error) throw new Error(error.message)
  },
}

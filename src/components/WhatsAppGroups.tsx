import { useCallback, useEffect, useState, type FormEvent } from 'react'
import type { User } from 'firebase/auth'
import { ChevronRight, EyeOff, Eye, Plus, Settings2, Trash2 } from 'lucide-react'
import { WhatsAppLogo } from './BrandLogos'
import { FALLBACK_GROUPS, cachedGroups, groupsApi, type WaGroup } from '../lib/groups'
import { supabaseReady } from '../lib/supabase'

/** Landing-page section: public WhatsApp group links. The admin gets a "Manage groups" panel (add, hide, delete). */
export default function WhatsAppGroups({ user }: { user: User | null }) {
  const [groups, setGroups] = useState<WaGroup[]>(() => cachedGroups() ?? FALLBACK_GROUPS)
  const [isAdmin, setIsAdmin] = useState(false)
  const [manage, setManage] = useState(false)
  const [all, setAll] = useState<WaGroup[]>([])
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [link, setLink] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    if (!supabaseReady) return
    try { setGroups(await groupsApi.list()) } catch { /* keep cached / fallback */ }
  }, [])
  useEffect(() => { void refresh() }, [refresh])
  useEffect(() => {
    setIsAdmin(false); setManage(false)
    if (user && supabaseReady) groupsApi.isAdmin().then(setIsAdmin).catch(() => setIsAdmin(false))
  }, [user])
  useEffect(() => { if (manage) groupsApi.listAll().then(setAll).catch((e) => setMsg({ ok: false, text: e.message })) }, [manage])

  async function act(fn: () => Promise<void>, ok: string) {
    setBusy(true); setMsg(null)
    try { await fn(); setMsg({ ok: true, text: ok }); setAll(await groupsApi.listAll()); await refresh() }
    catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : 'Something went wrong.' }) }
    finally { setBusy(false) }
  }
  async function add(e: FormEvent) {
    e.preventDefault()
    await act(async () => { await groupsApi.add({ name, description: desc, link }); setName(''); setDesc(''); setLink('') }, 'Group added. It is now on the landing page.')
  }

  if (groups.length === 0 && !isAdmin) return null
  return (
    <section className="lp-section" id="community">
      <span className="lp-kicker">COMMUNITY</span>
      <h2>Join our WhatsApp groups</h2>
      <div className="wg-grid">
        {groups.map((g) => (
          <a className="wg-card" key={g.id} href={g.link} target="_blank" rel="noopener noreferrer">
            <WhatsAppLogo size={38} />
            <span><strong>{g.name}</strong>{g.description && <small>{g.description}</small>}</span>
            <span className="wg-join">Join <ChevronRight size={16} /></span>
          </a>
        ))}
        {groups.length === 0 && <p className="lp-hint">No groups yet. Use Manage groups to add the first one.</p>}
      </div>
      {isAdmin && (
        <div className="wg-admin">
          <button className="lp-btn lp-btn-soft" onClick={() => setManage((m) => !m)}><Settings2 size={15} /> {manage ? 'Close' : 'Manage groups'}</button>
          {manage && (
            <div className="wg-panel">
              <form onSubmit={add} className="wg-form">
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Group name, e.g. Chuka Comrades 2026" maxLength={60} />
                <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Short description (optional)" maxLength={160} />
                <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://chat.whatsapp.com/…" />
                <button className="lp-btn" disabled={busy || !name.trim() || !link.trim()}><Plus size={15} /> Add group</button>
              </form>
              {msg && <p className={msg.ok ? 'wg-ok' : 'lp-error'} role="status">{msg.text}</p>}
              <ul className="wg-list">
                {all.map((g) => (
                  <li key={g.id} className={g.active ? '' : 'off'}>
                    <span><strong>{g.name}</strong><small>{g.link}</small></span>
                    <button className="lp-btn lp-btn-soft" disabled={busy} onClick={() => act(() => groupsApi.setActive(g.id, !g.active), g.active ? 'Hidden from the landing page.' : 'Visible again.')} aria-label={g.active ? 'Hide group' : 'Show group'}>{g.active ? <EyeOff size={15} /> : <Eye size={15} />}</button>
                    <button className="lp-btn lp-btn-soft" disabled={busy} onClick={() => { if (window.confirm(`Delete “${g.name}”?`)) void act(() => groupsApi.remove(g.id), 'Deleted.') }} aria-label="Delete group"><Trash2 size={15} /></button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, Loader2, Trash2, X } from 'lucide-react'
import type { FormEvent } from 'react'
import { LIFESTYLE_QUESTIONS, lifestyleLabel, roommateApi, stayRange, type PassRow, type Report, type RoommatePost } from '../lib/roommate'
import { kes, niceDate, niceDateTime, showPhone, timeAgo, waLink, type Settings } from '../lib/hostel'
import { WhatsAppLogo } from '../components/BrandLogos'

type Filter = 'pending' | 'approved' | 'rejected' | 'reported' | 'passes'

export default function RoommateAdmin({ settings }: { settings: Settings }) {
  const [posts, setPosts] = useState<RoommatePost[]>([])
  const [phones, setPhones] = useState<Record<string, string>>({})
  const [reports, setReports] = useState<Report[]>([])
  const [filter, setFilter] = useState<Filter>('pending')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { const r = await roommateApi.adminPosts(); setPosts(r.posts); setPhones(r.phones); setReports(r.reports) }
    catch (e) { setError((e as Error).message) } finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])

  const reportedIds = useMemo(() => new Set(reports.map((r) => r.postId)), [reports])
  const counts = useMemo(() => ({
    pending: posts.filter((p) => p.status === 'pending').length,
    approved: posts.filter((p) => p.status === 'approved').length,
    rejected: posts.filter((p) => p.status === 'rejected').length,
    reported: posts.filter((p) => reportedIds.has(p.id)).length,
  }), [posts, reportedIds])
  const shown = filter === 'passes' ? [] : posts.filter((p) => (filter === 'reported' ? reportedIds.has(p.id) : p.status === filter))

  async function run(id: string, msg: string, fn: () => Promise<void>) {
    setBusy(id); setError(''); setNotice('')
    try { await fn(); await load(); setNotice(msg) } catch (e) { setError((e as Error).message) } finally { setBusy('') }
  }
  const approve = (p: RoommatePost) => run(p.id, `${p.firstName}'s post approved.`, () => roommateApi.review(p.id, true))
  const reject = (p: RoommatePost) => {
    const reason = window.prompt('Reason shown to the student (e.g. "Please use your real first name"):', '')
    if (reason === null) return
    void run(p.id, `${p.firstName}'s post rejected.`, () => roommateApi.review(p.id, false, reason.trim()))
  }
  const remove = (p: RoommatePost) => {
    if (!window.confirm(`Delete ${p.firstName}'s post and all its requests? This cannot be undone.`)) return
    void run(p.id, 'Post deleted.', () => roommateApi.deletePost(p.id))
  }

  return (
    <section className="hs-panel">
      <div className="hs-admin-head">
        <div><span className="hs-kicker dark">ADMIN</span><h2>Roommate requests</h2><p>Approve a post and it appears to students of the same gender. Reject with a reason and the student can edit and resubmit.</p></div>
        <button className="hs-btn hs-btn-soft" onClick={() => void load()} disabled={loading}>{loading ? <Loader2 size={14} className="hs-spin" /> : null} Refresh</button>
      </div>
      <div className="hs-chips">
        {(['pending', 'approved', 'rejected', 'reported'] as Filter[]).map((f) => (
          <button key={f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>{f[0].toUpperCase() + f.slice(1)} ({counts[f as Exclude<Filter, 'passes'>]})</button>
        ))}
        <button className={filter === 'passes' ? 'on' : ''} onClick={() => setFilter('passes')}>Paid passes</button>
      </div>
      {filter === 'passes' && <PassesDesk settings={settings} />}
      {notice && <p className="hs-ok">{notice}</p>}
      {error && <p className="hs-error" role="alert">{error}</p>}
      {filter !== 'passes' && !loading && shown.length === 0 && <p className="hs-empty">Nothing here.</p>}
      <div className="hs-admin-list">
        {shown.map((p) => {
          const rs = reports.filter((r) => r.postId === p.id)
          const phone = phones[p.id]
          return (
            <article key={p.id} className="hs-admin-item">
              <header>
                <div>
                  <h3>{p.firstName} <small>{p.gender === 'female' ? 'Female' : 'Male'} · {p.course} · Year {p.year}</small></h3>
                  {p.stayType === 'graduation' && <p><strong>Graduation stay:</strong> {stayRange(p.stayFrom, p.stayTo)} · needs a host</p>}
                  {p.offersGraduationHosting && <p><strong>Can host graduation guests</strong></p>}
                  <p>{kes(p.budgetMin)} – {kes(p.budgetMax)}{p.stayType === 'graduation' ? ' (whole stay)' : ''} · {p.area}{p.roomType ? ` · ${p.roomType}` : ''} · {p.stayType === 'graduation' ? 'needs a host' : p.hasRoom ? `has a room at ${p.hostelName}` : 'needs a room'}</p>
                </div>
                <span className={`hs-status ${p.status === 'approved' ? 'published' : 'hidden'}`}>{p.status}{p.hidden ? ' · hidden' : ''}</span>
              </header>
              <div className="hs-pchips">{LIFESTYLE_QUESTIONS.map((q) => <span key={q.key} className="hs-pchip included">{lifestyleLabel(q.key, p.lifestyle[q.key])}</span>)}</div>
              {p.bio && <p className="hs-desc">{p.bio}</p>}
              <p className="hs-updated">Updated {timeAgo(p.updatedAt)}{p.status === 'rejected' && p.rejectReason ? ` · rejected: ${p.rejectReason}` : ''}</p>
              {phone && <a className="rm-adminwa" href={waLink(phone, `Hello ${p.firstName}, this is the Chuka Comrades admin about your roommate post.`)} target="_blank" rel="noopener noreferrer"><WhatsAppLogo size={15} /> {showPhone(phone)}</a>}
              {rs.length > 0 && (
                <div className="hs-error">
                  <div><strong>{rs.length} report{rs.length > 1 ? 's' : ''}:</strong> {rs.map((r) => r.reason).join(' · ')}</div>
                </div>
              )}
              <div className="hs-admin-actions">
                {p.status !== 'approved' && <button className="hs-btn hs-btn-green" disabled={busy === p.id} onClick={() => void approve(p)}><Check size={14} /> Approve</button>}
                {p.status !== 'rejected' && <button className="hs-btn hs-btn-soft" disabled={busy === p.id} onClick={() => reject(p)}><X size={14} /> Reject</button>}
                {rs.length > 0 && <button className="hs-btn hs-btn-soft" disabled={busy === p.id} onClick={() => void run(p.id, 'Reports cleared.', () => roommateApi.clearReports(p.id))}>Dismiss reports</button>}
                <button className="hs-btn hs-btn-danger" disabled={busy === p.id} onClick={() => remove(p)}><Trash2 size={14} /> Delete</button>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}

/* ---------- paid posting passes (KSh per semester) ---------- */

function PassesDesk({ settings }: { settings: Settings }) {
  const [rows, setRows] = useState<PassRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [expiresOn, setExpiresOn] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try { setRows(await roommateApi.passList()) } catch (e) { setError((e as Error).message) } finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])

  async function grant(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setError(''); setNotice('')
    try {
      const end = expiresOn || settings.semesterEnd
      if (!end) throw new Error('Set the semester end date first (Admin desk > Semester & prices), or pick an expiry date.')
      await roommateApi.passGrant(email.trim(), code.trim(), new Date(`${end}T23:59:59+03:00`).toISOString())
      setNotice(`${email.trim().toLowerCase()} can post until ${niceDate(end)}.`)
      setEmail(''); setCode(''); setExpiresOn('')
      await load()
    } catch (err) { setError((err as Error).message) } finally { setBusy(false) }
  }
  async function revoke(r: PassRow) {
    if (!window.confirm(`Remove the posting pass for ${r.email}? Their post will be hidden.`)) return
    setBusy(true); setError(''); setNotice('')
    try { await roommateApi.passRevoke(r.email); await load(); setNotice(`${r.email} no longer has a pass.`) }
    catch (err) { setError((err as Error).message) } finally { setBusy(false) }
  }

  return (
    <div>
      <p className="hs-note">Roommate posting costs KSh {settings.roommatePrice} per semester. After a student pays and WhatsApps you their email and M-Pesa code, activate them here.</p>
      <form className="hs-form hs-grant" onSubmit={grant}>
        <div className="hs-fgrid">
          <label>Student&apos;s Google email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="student@gmail.com" /></label>
          <label>M-Pesa code<input value={code} onChange={(e) => setCode(e.target.value)} maxLength={30} /></label>
          <label>Expires on <small>(empty = semester end)</small><input type="date" value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} /></label>
        </div>
        <button className="hs-btn hs-btn-green" disabled={busy || !email.trim()}>{busy ? <Loader2 size={15} className="hs-spin" /> : <Check size={15} />} Activate posting</button>
      </form>
      {notice && <p className="hs-ok">{notice}</p>}
      {error && <p className="hs-error" role="alert">{error}</p>}
      {loading ? <p className="hs-empty">Loading…</p> : rows.length === 0 ? <p className="hs-empty">No passes yet.</p> : (
        <div className="hs-admin-list">
          {rows.map((r) => {
            const active = Date.parse(r.expiresAt) > Date.now()
            return (
              <article className="hs-admin-item" key={r.email}>
                <header>
                  <div><h3>{r.email}</h3><p>Activated {timeAgo(r.grantedAt)}{r.mpesaCode ? ` · ${r.mpesaCode}` : ''} · until {niceDateTime(r.expiresAt)}</p></div>
                  <span className={`hs-status ${active ? 'published' : 'hidden'}`}>{active ? 'Active' : 'Expired'}</span>
                </header>
                <div className="hs-admin-actions"><button className="hs-btn hs-btn-danger" disabled={busy} onClick={() => void revoke(r)}><Trash2 size={14} /> Revoke</button></div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}

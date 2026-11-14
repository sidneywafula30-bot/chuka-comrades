import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import type { User } from 'firebase/auth'
import { CheckCircle2, ExternalLink, Flag, MapPin, Pencil, Plus, Search, ShieldAlert, ShieldCheck, Trash2, Wallet } from 'lucide-react'
import { gigsApi, gigsReady, FALLBACK_CONFIG, PAY_LABELS, payLabel, type Gig, type GigsConfig, type GigReport, type Method, type PayType } from '../lib/gigs'
import { errMsg, fmtDate, packFiles, type Note } from '../lib/hub'
import { AttachList, Empty, FilePicker, HubShell, Loading, Modal, Msg, StatusBadge } from '../components/HubUi'

type Props = { user: User | null; onSignIn: () => void; onBack: () => void }
type View = 'browse' | 'mine' | 'admin'
const call = gigsApi.call

function contactHref(m: Method, c: string) {
  return m === 'email' ? `mailto:${c}` : m === 'phone' ? `tel:${c}` : `https://wa.me/${c.replace(/\D/g, '')}`
}

/* ---------- card ---------- */
function GigCard({ g, user, onSignIn, onError, onReport, children }: {
  g: Gig; user: User | null; onSignIn: () => void; onError: (m: string) => void; onReport?: (g: Gig) => void; children?: ReactNode
}) {
  const [contact, setContact] = useState<{ method: Method; contact: string } | null>(g.contact ? { method: g.contactMethod, contact: g.contact } : null)
  const [busy, setBusy] = useState(false)
  async function reveal() {
    if (!user) return onSignIn()
    setBusy(true)
    try { setContact(await gigsApi.contact(g.id)) } catch (e) { onError(errMsg(e)) } finally { setBusy(false) }
  }
  return (
    <article className="sl-resource">
      <div className="sl-resource-top">
        <span className="sl-chip">{g.category}</span><span className="hub-pay">{payLabel(g)}</span>
        {g.status !== 'approved' && <StatusBadge s={g.status} />}
      </div>
      <h3>{g.title}</h3>
      <div className="hub-meta">
        <span><MapPin size={13} /> {g.location}</span>
        {g.deadline && <span>Apply by {fmtDate(g.deadline)}</span>}
        <span>Posted by {g.posterName || 'a comrade'}{g.posterEmail ? ` · ${g.posterEmail}` : ''} · {fmtDate(g.createdAt)}</span>
      </div>
      <p>{g.description}</p>
      {g.flags && <p className="hub-flag"><ShieldAlert size={14} /> {g.flags}</p>}
      {g.status === 'rejected' && g.rejectReason && <p className="sl-reject">Reason: {g.rejectReason}</p>}
      {typeof g.contactCount === 'number' && <small className="sl-sub">{g.contactCount} {g.contactCount === 1 ? 'person has' : 'people have'} contacted this poster</small>}
      <AttachList items={g.attachments} call={call} onError={onError} />
      {g.status === 'approved' && (contact ? (
        <div className="hub-contact"><span>{contact.method === 'email' ? 'Email' : contact.method === 'phone' ? 'Call' : 'WhatsApp'}:</span>
          <a href={contactHref(contact.method, contact.contact)} target="_blank" rel="noreferrer noopener">{contact.contact} <ExternalLink size={13} /></a></div>
      ) : (
        <button className="sl-primary small" disabled={busy} onClick={reveal}>{user ? (busy ? '…' : 'Show contact') : 'Sign in to contact'}</button>
      ))}
      <div className="sl-resource-foot"><span />
        <span className="sl-foot-actions">{onReport && user && !g.mine && <button className="sl-mini ghost" onClick={() => onReport(g)}><Flag size={13} /> Report</button>}{children}</span>
      </div>
    </article>
  )
}

/* ---------- post / edit ---------- */
function PostModal({ gig, config, onClose, onDone }: { gig?: Gig; config: GigsConfig; onClose: () => void; onDone: () => void }) {
  const [title, setTitle] = useState(gig?.title ?? '')
  const [category, setCategory] = useState(gig?.category ?? config.categories[0] ?? 'Other')
  const [description, setDescription] = useState(gig?.description ?? '')
  const [payType, setPayType] = useState<PayType>(gig?.payType ?? 'fixed')
  const [payAmount, setPayAmount] = useState(gig?.payAmount ?? '')
  const [location, setLocation] = useState(gig?.location ?? 'Chuka campus')
  const [deadline, setDeadline] = useState(gig?.deadline ?? '')
  const [method, setMethod] = useState<Method>(gig?.contactMethod ?? 'whatsapp')
  const [contact, setContact] = useState(gig?.contact ?? '')
  const [files, setFiles] = useState<File[]>([])
  const [removeIds, setRemoveIds] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<Note>(null)
  const [done, setDone] = useState(false)
  const needsAmount = payType === 'fixed' || payType === 'hourly'

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (title.trim().length < 5) return setMsg({ type: 'err', text: 'Give the gig a clear title.' })
    if (description.trim().length < 20) return setMsg({ type: 'err', text: 'Describe the work in a bit more detail (20+ characters).' })
    if (needsAmount && !(Number(payAmount) > 0)) return setMsg({ type: 'err', text: 'Enter the pay amount in KSh.' })
    if (!contact.trim()) return setMsg({ type: 'err', text: 'Add a contact so students can reach you.' })
    setBusy(true); setMsg(null)
    try {
      await gigsApi.post({
        id: gig?.id, title: title.trim(), category, description: description.trim(), payType, payAmount: needsAmount ? payAmount : '',
        location: location.trim(), deadline, contactMethod: method, contact: contact.trim(), files: await packFiles(files, config.files), removeFileIds: removeIds,
      })
      setDone(true); onDone()
    } catch (err) { setMsg({ type: 'err', text: errMsg(err) }) } finally { setBusy(false) }
  }

  if (done) return (
    <Modal title="Sent for approval" onClose={onClose}>
      <div className="sl-done"><CheckCircle2 size={34} /><p>Your gig is waiting for an admin to approve it. It will appear on the board once approved. You can track it under <strong>My gigs</strong>.</p><button className="sl-primary" onClick={onClose}>Done</button></div>
    </Modal>
  )
  return (
    <Modal title={gig ? 'Edit gig' : 'Post a gig'} onClose={onClose}>
      <form className="sl-form" onSubmit={submit}>
        {gig && <p className="hub-warn">Saving changes sends this gig back for admin approval.</p>}
        <label>Title<input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} placeholder="e.g. Need a poster designed for a club event" /></label>
        <label>Category<select value={category} onChange={(e) => setCategory(e.target.value)}>{config.categories.map((c) => <option key={c}>{c}</option>)}</select></label>
        <label>Description<textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1200} placeholder="What needs to be done, when, and what you expect." /></label>
        <div className="sl-two">
          <label>Pay<select value={payType} onChange={(e) => setPayType(e.target.value as PayType)}>{config.payTypes.map((p) => <option key={p} value={p}>{PAY_LABELS[p]}</option>)}</select></label>
          {needsAmount && <label>Amount (KSh)<input type="number" min={1} value={payAmount} onChange={(e) => setPayAmount(e.target.value)} /></label>}
        </div>
        <div className="sl-two">
          <label>Location<input value={location} onChange={(e) => setLocation(e.target.value)} maxLength={100} /></label>
          <label>Apply by (optional)<input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} /></label>
        </div>
        <div className="sl-two">
          <label>Contact via<select value={method} onChange={(e) => setMethod(e.target.value as Method)}><option value="whatsapp">WhatsApp</option><option value="phone">Phone call</option><option value="email">Email</option></select></label>
          <label>{method === 'email' ? 'Email address' : 'Phone number'}<input value={contact} onChange={(e) => setContact(e.target.value)} placeholder={method === 'email' ? 'you@example.com' : '0712345678'} /></label>
        </div>
        <p className="hub-warn">Never ask applicants to pay a fee to get the gig. Gigs that ask for money upfront are rejected.</p>
        <FilePicker files={files} setFiles={setFiles} rules={config.files} onError={(m) => setMsg({ type: 'err', text: m })} existing={gig?.attachments} removeIds={removeIds} setRemoveIds={setRemoveIds} />
        <Msg msg={msg} />
        <button className="sl-primary" disabled={busy}>{busy ? 'Sending…' : 'Submit for approval'}</button>
      </form>
    </Modal>
  )
}

function ReportModal({ gig, onClose }: { gig: Gig; onClose: () => void }) {
  const [reason, setReason] = useState('')
  const [msg, setMsg] = useState<Note>(null)
  const [busy, setBusy] = useState(false)
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true)
    try { await gigsApi.report(gig.id, reason.trim()); setMsg({ type: 'ok', text: 'Thank you. An admin will look at it.' }) } catch (err) { setMsg({ type: 'err', text: errMsg(err) }) } finally { setBusy(false) }
  }
  return (
    <Modal title="Report this gig" onClose={onClose}>
      <form className="sl-form" onSubmit={submit}>
        <p className="sl-sub">{gig.title}</p>
        <label>What is wrong?<textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="e.g. asked me to pay a fee, fake offer, offensive" /></label>
        <Msg msg={msg} />
        <button className="sl-primary" disabled={busy || reason.trim().length < 3}>{busy ? 'Sending…' : 'Send report'}</button>
      </form>
    </Modal>
  )
}

/* ---------- pages ---------- */
function Browse({ user, onSignIn, config, onPost }: { user: User | null; onSignIn: () => void; config: GigsConfig; onPost: () => void }) {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [items, setItems] = useState<Gig[] | null>(null)
  const [msg, setMsg] = useState<Note>(null)
  const [reporting, setReporting] = useState<Gig | null>(null)
  const load = useCallback(() => {
    if (!gigsReady) { setItems([]); return }
    gigsApi.list(q.trim(), cat).then(setItems).catch((e) => { setMsg({ type: 'err', text: errMsg(e) }); setItems([]) })
  }, [q, cat])
  useEffect(() => { load() }, [load, user])
  return (
    <>
      <section className="sl-hero">
        <div><span className="sl-kicker">CHUKA EARNING &amp; GIGS</span><h1>Side hustles &amp; gigs <em>by comrades, for comrades</em></h1>
          <p>Find paid and volunteer work on campus, or post a gig of your own. Every gig is checked by an admin before it goes live.</p></div>
        <div className="sl-hero-art"><Wallet size={46} /><span>Earn on campus</span></div>
      </section>
      <p className="hub-warn">Stay safe: never pay to get a gig, meet in public places, and report anything suspicious.</p>
      <div className="hub-bar">
        <form className="sl-search" onSubmit={(e) => { e.preventDefault(); load() }}><Search size={18} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search gigs…" /></form>
        <button className="sl-primary small" onClick={user ? onPost : onSignIn}><Plus size={15} /> Post a gig</button>
      </div>
      <div className="hub-chips">
        <button className={cat === '' ? 'on' : ''} onClick={() => setCat('')}>All</button>
        {config.categories.map((c) => <button key={c} className={cat === c ? 'on' : ''} onClick={() => setCat(c)}>{c}</button>)}
      </div>
      <Msg msg={msg} />
      {!items ? <Loading /> : items.length === 0 ? <Empty icon={<Wallet size={26} />} title="No gigs yet" text="Be the first to post one, or check back soon." /> : (
        <div className="sl-grid">{items.map((g) => <GigCard key={g.id} g={g} user={user} onSignIn={onSignIn} onError={(m) => setMsg({ type: 'err', text: m })} onReport={setReporting} />)}</div>
      )}
      {reporting && <ReportModal gig={reporting} onClose={() => setReporting(null)} />}
    </>
  )
}

function Mine({ user, onSignIn, config, tick, onChanged }: { user: User | null; onSignIn: () => void; config: GigsConfig; tick: number; onChanged: () => void }) {
  const [items, setItems] = useState<Gig[] | null>(null)
  const [msg, setMsg] = useState<Note>(null)
  const [editing, setEditing] = useState<Gig | null>(null)
  const load = useCallback(() => gigsApi.mine().then(setItems).catch((e) => { setMsg({ type: 'err', text: errMsg(e) }); setItems([]) }), [])
  useEffect(() => { if (user) void load() }, [user, load, tick])
  if (!user) return <Empty title="Sign in to see your gigs" text="Your posted gigs and their approval status appear here." />
  async function del(g: Gig) {
    if (!window.confirm(`Delete “${g.title}”?`)) return
    try { await gigsApi.deleteMine(g.id); await load(); onChanged() } catch (e) { setMsg({ type: 'err', text: errMsg(e) }) }
  }
  return (
    <>
      <div className="sl-page-head"><div><span className="sl-kicker">YOUR ACCOUNT</span><h1>My gigs</h1></div></div>
      <Msg msg={msg} />
      {!items ? <Loading /> : items.length === 0 ? <Empty title="You have not posted any gigs" /> : (
        <div className="sl-grid">{items.map((g) => (
          <GigCard key={g.id} g={g} user={user} onSignIn={onSignIn} onError={(m) => setMsg({ type: 'err', text: m })}>
            <button className="sl-mini" onClick={() => setEditing(g)}><Pencil size={13} /> Edit</button>
            <button className="sl-mini danger" onClick={() => del(g)}><Trash2 size={13} /> Delete</button>
          </GigCard>
        ))}</div>
      )}
      {editing && <PostModal gig={editing} config={config} onClose={() => setEditing(null)} onDone={() => { void load(); onChanged() }} />}
    </>
  )
}

function Admin({ config }: { config: GigsConfig }) {
  void config
  const [tab, setTab] = useState<'queue' | 'all' | 'reports'>('queue')
  const [queue, setQueue] = useState<{ pending: Gig[]; openReports: number } | null>(null)
  const [all, setAll] = useState<Gig[] | null>(null)
  const [reports, setReports] = useState<GigReport[] | null>(null)
  const [reasons, setReasons] = useState<Record<string, string>>({})
  const [msg, setMsg] = useState<Note>(null)
  const err = (e: unknown) => setMsg({ type: 'err', text: errMsg(e) })
  const loadQueue = useCallback(() => gigsApi.admin.queue().then(setQueue).catch(err), [])
  const loadAll = useCallback(() => gigsApi.admin.gigs().then(setAll).catch((e) => { err(e); setAll([]) }), [])
  const loadReports = useCallback(() => gigsApi.admin.reports().then(setReports).catch((e) => { err(e); setReports([]) }), [])
  useEffect(() => { void loadQueue() }, [loadQueue])
  useEffect(() => { if (tab === 'all') void loadAll(); if (tab === 'reports') void loadReports() }, [tab, loadAll, loadReports])
  const noop = () => {}
  async function review(g: Gig, d: 'approve' | 'reject') {
    try { await gigsApi.admin.review(g.id, d, reasons[g.id]?.trim()); setMsg({ type: 'ok', text: d === 'approve' ? 'Approved and published.' : 'Rejected.' }); await loadQueue(); if (tab === 'all') await loadAll() } catch (e) { err(e) }
  }
  async function remove(g: Gig) {
    if (!window.confirm(`Delete “${g.title}” for good?`)) return
    try { await gigsApi.admin.remove(g.id); await loadQueue(); await loadAll() } catch (e) { err(e) }
  }
  async function resolve(id: string, r: 'dismiss' | 'unpublish' | 'delete') {
    try { await gigsApi.admin.resolve(id, r); await loadReports(); await loadQueue() } catch (e) { err(e) }
  }
  return (
    <>
      <div className="sl-page-head"><div><span className="sl-kicker">ADMIN</span><h1>Gigs admin</h1></div></div>
      <div className="sl-tabs">
        <button className={tab === 'queue' ? 'on' : ''} onClick={() => setTab('queue')}>Approval queue <b>{queue?.pending.length ?? 0}</b></button>
        <button className={tab === 'reports' ? 'on' : ''} onClick={() => setTab('reports')}>Reports <b>{queue?.openReports ?? 0}</b></button>
        <button className={tab === 'all' ? 'on' : ''} onClick={() => setTab('all')}>All gigs</button>
      </div>
      <Msg msg={msg} />
      {tab === 'queue' && (!queue ? <Loading /> : queue.pending.length === 0 ? <Empty icon={<CheckCircle2 size={26} />} title="All caught up" text="No gigs are waiting for approval." /> : (
        <div className="sl-grid">{queue.pending.map((g) => (
          <GigCard key={g.id} g={g} user={null} onSignIn={noop} onError={(m) => setMsg({ type: 'err', text: m })}>
            <span className="hub-decide">
              <input placeholder="Reason (if rejecting)" value={reasons[g.id] ?? ''} onChange={(e) => setReasons({ ...reasons, [g.id]: e.target.value })} />
              <button className="sl-mini" onClick={() => review(g, 'approve')}>Approve</button><button className="sl-mini danger" onClick={() => review(g, 'reject')}>Reject</button>
            </span>
          </GigCard>))}</div>
      ))}
      {tab === 'reports' && (!reports ? <Loading /> : reports.length === 0 ? <Empty icon={<CheckCircle2 size={26} />} title="No open reports" /> : (
        <div className="sl-grid">{reports.map((r) => (
          <div key={r.id}>
            <p className="hub-flag"><Flag size={14} /> {r.reason}</p>
            {r.gig ? <GigCard g={r.gig} user={null} onSignIn={noop} onError={(m) => setMsg({ type: 'err', text: m })} /> : <p className="sl-sub">The gig no longer exists.</p>}
            <span className="hub-decide"><button className="sl-mini ghost" onClick={() => resolve(r.id, 'dismiss')}>Dismiss</button>
              <button className="sl-mini" onClick={() => resolve(r.id, 'unpublish')}>Unpublish</button><button className="sl-mini danger" onClick={() => resolve(r.id, 'delete')}>Delete gig</button></span>
          </div>))}</div>
      ))}
      {tab === 'all' && (!all ? <Loading /> : all.length === 0 ? <Empty title="No gigs yet" /> : (
        <div className="sl-grid">{all.map((g) => (
          <GigCard key={g.id} g={g} user={null} onSignIn={noop} onError={(m) => setMsg({ type: 'err', text: m })}>
            {g.status === 'approved' ? <button className="sl-mini" onClick={() => review(g, 'reject')}>Unpublish</button> : <button className="sl-mini" onClick={() => review(g, 'approve')}>Approve</button>}
            <button className="sl-mini danger" onClick={() => remove(g)}><Trash2 size={13} /> Delete</button>
          </GigCard>))}</div>
      ))}
    </>
  )
}

/* ---------- shell ---------- */
export default function Gigs({ user, onSignIn, onBack }: Props) {
  const [view, setView] = useState<View>('browse')
  const [config, setConfig] = useState<GigsConfig>(FALLBACK_CONFIG)
  const [isAdmin, setIsAdmin] = useState(false)
  const [posting, setPosting] = useState(false)
  const [tick, setTick] = useState(0)
  const [fatal, setFatal] = useState('')

  useEffect(() => { if (gigsReady) gigsApi.config().then(setConfig).catch((e) => setFatal(errMsg(e))) }, [])
  useEffect(() => {
    setIsAdmin(false)
    if (gigsReady && user) gigsApi.adminCheck().then((r) => setIsAdmin(r.isAdmin)).catch(() => {})
  }, [user])
  useEffect(() => { window.scrollTo(0, 0) }, [view])

  const gated = (v: View) => (user ? setView(v) : onSignIn())
  return (
    <HubShell name="Earning & Gigs" sub="Chuka Comrades" logo="gigs-logo.svg" backLabel={view === 'browse' ? 'Back to services' : 'Back'}
      onBack={() => (view === 'browse' ? onBack() : setView('browse'))}
      nav={<>
        <button className={view === 'browse' ? 'on' : ''} onClick={() => setView('browse')}>Browse</button>
        <button className={view === 'mine' ? 'on' : ''} onClick={() => gated('mine')}>My gigs</button>
        {isAdmin && <button className={view === 'admin' ? 'on' : ''} onClick={() => setView('admin')}><ShieldCheck size={14} /> Admin</button>}
      </>}>
      {!gigsReady && <Msg msg={{ type: 'err', text: 'Gigs server not connected yet. Add VITE_GIGS_API_URL to .env and restart npm run dev.' }} />}
      {fatal && <Msg msg={{ type: 'err', text: fatal }} />}
      {view === 'browse' && <Browse user={user} onSignIn={onSignIn} config={config} onPost={() => setPosting(true)} />}
      {view === 'mine' && <Mine user={user} onSignIn={onSignIn} config={config} tick={tick} onChanged={() => setTick((n) => n + 1)} />}
      {view === 'admin' && isAdmin && <Admin config={config} />}
      {posting && <PostModal config={config} onClose={() => setPosting(false)} onDone={() => setTick((n) => n + 1)} />}
    </HubShell>
  )
}

import { Component, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { signInWithPopup, type User } from 'firebase/auth'
import { ArrowLeft, FileDown, MessageCircle, Search, Upload } from 'lucide-react'
import { auth, googleProvider } from '../lib/firebase'
import GoogleSignInButton from '../components/GoogleSignInButton'
import { cy, cyReady, DEFAULT_WA, fileToB64, fillTemplate, money, normPhone, waLink, type Boot, type Me, type Order, type Profile, type Service } from '../lib/cyber'
import './Cpl.css'
import './Cyber.css'

const PKEY = 'cy_profile'
const loadP = (): Profile => { try { return { name: '', phone: '', reg: '', hostel: '', ...JSON.parse(localStorage.getItem(PKEY) || '{}') } } catch { return { name: '', phone: '', reg: '', hostel: '' } } }

class Boundary extends Component<{ children: ReactNode }, { err: Error | null }> {
  state = { err: null as Error | null }
  static getDerivedStateFromError(err: Error) { return { err } }
  render() {
    if (!this.state.err) return this.props.children
    return (
      <div className="cpl cy"><main className="cpl-main">
        <p className="cpl-err"><b>Something went wrong in Cyber Services.</b><br />{this.state.err.message}</p>
        <a className="lp-btn" href="#services" onClick={() => this.setState({ err: null })}>Back home</a>{' '}
        <button className="lp-btn lp-btn-soft" onClick={() => location.reload()}>Reload</button>
      </main></div>
    )
  }
}

export default function Cyber(props: { user: User | null; route: string }) {
  return <Boundary><CyberInner {...props} /></Boundary>
}

function CyberInner({ user, route }: { user: User | null; route: string }) {
  const [boot, setBoot] = useState<Boot | null>(null)
  const [err, setErr] = useState('')
  const [me, setMe] = useState<Me | null>(null)
  const [busy, setBusy] = useState(false)
  const [order, setOrder] = useState<Service | null>(null)
  const page = route.split('/')[2] || ''

  const load = useCallback(async () => {
    if (!cyReady) return
    try { setBoot(await cy<Boot>('bootstrap')); setErr('') } catch (e) { setErr((e as Error).message) }
  }, [])
  useEffect(() => { void load() }, [load])
  useEffect(() => {
    if (!user || !cyReady) { setMe(null); return }
    cy<Me>('me', {}, user).then(setMe).catch(() => setMe(null))
  }, [user])

  async function signIn() {
    if (!auth) return
    setBusy(true)
    try { await signInWithPopup(auth, googleProvider) } catch { /* closed */ } finally { setBusy(false) }
  }

  const wa = boot?.settings.whatsapp || DEFAULT_WA
  const tabs: [string, string][] = [['', 'Services'], ['docs', 'Documents'], ['orders', 'My orders'], ...(me?.isAdmin ? [['admin', 'Admin'] as [string, string]] : [])]

  let body
  if (!cyReady) body = <p className="cpl-empty">The cyber server is not connected yet. Add <code>VITE_CYBER_API_URL</code> to <code>.env</code> and restart.</p>
  else if (err) body = <p className="cpl-err">{err} <button className="cy-link" onClick={() => void load()}>Try again</button></p>
  else if (!boot) body = <p className="cpl-empty">Loading…</p>
  else if (page === 'docs') body = <Docs boot={boot} me={me} />
  else if (page === 'orders') body = user ? <Orders user={user} /> : <SignInBox busy={busy} signIn={signIn} />
  else if (page === 'admin') body = me?.isAdmin ? <Admin user={user!} wa={wa} /> : <p className="cpl-empty">Admins only.</p>
  else body = <Services boot={boot} me={me} onOrder={setOrder} />

  return (
    <div className="cpl cy">
      <header className="cpl-top">
        <a className="cpl-back" href="#services"><ArrowLeft size={16} /> Student services</a>
        <img src={`${import.meta.env.BASE_URL}chukalogo.png`} alt="" height={34} />
      </header>
      <main className="cpl-main">
        <div className="cpl-home cy-hero">
          <div className="cy-mark"><img src={`${import.meta.env.BASE_URL}cyber-logo.svg`} alt="Chuka Cyber logo" /></div>
          <h1>{boot?.settings.shopName || 'Chuka Cyber'}</h1>
          <p>{boot?.settings.hours || 'Printing, typing, applications and more.'}</p>
          <a className="lp-btn" href={waLink(wa, 'Hello Chuka Cyber, I need help with a service.')} target="_blank" rel="noopener noreferrer"><MessageCircle size={16} /> Chat on WhatsApp</a>
          <nav className="cy-tabs">{tabs.map(([k, l]) => <a key={k} href={`#/cyber${k ? '/' + k : ''}`} className={'cy-tab' + (page === k ? ' on' : '')}>{l}</a>)}</nav>
        </div>
        <div className="cy-body">{body}</div>
      </main>
      {order && boot && <OrderModal svc={order} boot={boot} user={user} me={me} busy={busy} signIn={signIn} onClose={() => setOrder(null)} />}
    </div>
  )
}

function SignInBox({ busy, signIn }: { busy: boolean; signIn: () => void }) {
  return <div className="cy-box"><p>Sign in to continue.</p><GoogleSignInButton onClick={signIn} disabled={busy} /></div>
}

function Services({ boot, me, onOrder }: { boot: Boot; me: Me | null; onOrder: (s: Service) => void }) {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('All')
  const cats = useMemo(() => ['All', ...Array.from(new Set(boot.services.map((s) => s.category)))], [boot])
  const list = boot.services.filter((s) => (cat === 'All' || s.category === cat) && (s.name + s.description + s.category).toLowerCase().includes(q.toLowerCase()))
  const p = loadP()
  return (
    <>
      <div className="cpl-search"><Search size={16} /><input placeholder="Search services (HELB, printing, KRA…)" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className="cpl-chips">{cats.map((c) => <button key={c} className={c === cat ? 'on' : ''} onClick={() => setCat(c)}>{c}</button>)}</div>
      <div className="cy-grid">
        {list.map((s) => {
          const msg = fillTemplate(s.template || `Hello, I need help with ${s.name}.`, { name: me?.name || p.name, reg: p.reg, phone: p.phone, hostel: p.hostel, qty: 1, notes: '' })
          return (
            <article className="cy-card" key={s.id}>
              <small>{s.category}</small>
              <h3>{s.name}</h3>
              <p>{s.description}</p>
              <div className="cy-meta"><b>{money(s.price)}</b>{s.unit && <span> {s.unit}</span>}{s.turnaround && <span> · {s.turnaround}</span>}</div>
              <div className="cy-row">
                <button className="lp-btn" onClick={() => onOrder(s)}>Order</button>
                <a className="lp-btn lp-btn-soft" href={waLink(boot.settings.whatsapp, msg)} target="_blank" rel="noopener noreferrer"><MessageCircle size={14} /> WhatsApp</a>
              </div>
            </article>
          )
        })}
        {!list.length && <p className="cpl-empty">No services match.</p>}
      </div>
    </>
  )
}

function OrderModal({ svc, boot, user, me, busy, signIn, onClose }: { svc: Service; boot: Boot; user: User | null; me: Me | null; busy: boolean; signIn: () => void; onClose: () => void }) {
  const [p, setP] = useState<Profile>(() => { const l = loadP(); return { ...l, ...(me?.profile || {}), name: me?.profile?.name || l.name || user?.displayName || '' } })
  const [qty, setQty] = useState(1)
  const [notes, setNotes] = useState('')
  const [delivery, setDelivery] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [sending, setSending] = useState(false)
  const [err, setErr] = useState('')
  const [done, setDone] = useState<{ orderId: string; total: number | string; fileUploaded: boolean } | null>(null)
  const set = (k: keyof Profile) => (e: React.ChangeEvent<HTMLInputElement>) => setP({ ...p, [k]: e.target.value })

  async function submit() {
    setErr('')
    if (!p.name.trim() || normPhone(p.phone).length < 11) return setErr('Enter your name and a valid phone number.')
    if (delivery && !p.hostel.trim()) return setErr('Enter your hostel/room for delivery.')
    if (svc.needsFile && !file) return setErr('Please attach your file.')
    if (file && file.size > 10 * 1024 * 1024) return setErr('File is too large (max 10 MB).')
    setSending(true)
    try {
      localStorage.setItem(PKEY, JSON.stringify(p))
      const f = file ? { name: file.name, mime: file.type, data: await fileToB64(file) } : undefined
      setDone(await cy('createOrder', { serviceId: svc.id, qty, notes, delivery, profile: { ...p, phone: normPhone(p.phone) }, file: f }, user))
    } catch (e) { setErr((e as Error).message) } finally { setSending(false) }
  }

  const vars = { name: p.name, reg: p.reg, phone: p.phone, hostel: p.hostel, qty, notes }
  const msg = done ? `${fillTemplate(svc.template || `Hello, I need ${svc.name}.`, vars)} Order ${done.orderId}${done.fileUploaded ? ' (file uploaded in the app)' : ''}.` : ''

  return (
    <div className="cy-modal" onClick={onClose}>
      <div className="cy-sheet" onClick={(e) => e.stopPropagation()}>
        <h2>{svc.name}</h2>
        {!user ? <SignInBox busy={busy} signIn={signIn} /> : done ? (
          <div>
            <p><b>Order {done.orderId} received.</b> {done.total !== '' && <>Total: <b>{money(done.total)}</b>. </>}Pay via M-Pesa: {boot.settings.mpesa || 'ask on WhatsApp'}.</p>
            <a className="lp-btn" href={waLink(boot.settings.whatsapp, msg)} target="_blank" rel="noopener noreferrer"><MessageCircle size={14} /> Confirm on WhatsApp</a>
            <button className="lp-btn lp-btn-soft" onClick={onClose}>Close</button>
          </div>
        ) : (
          <div className="cy-form">
            <label>Name<input value={p.name} onChange={set('name')} /></label>
            <label>Phone<input inputMode="tel" placeholder="07XX XXX XXX" value={p.phone} onChange={set('phone')} /></label>
            <label>Reg number<input value={p.reg} onChange={set('reg')} /></label>
            <label>Quantity {svc.unit && `(${svc.unit})`}<input type="number" min={1} value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))} /></label>
            <label>Notes<textarea rows={3} placeholder="Colour, size, deadline, details…" value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
            <label className="cy-file"><Upload size={16} /> {file ? file.name : svc.needsFile ? 'Attach file (required, max 10 MB)' : 'Attach file (optional, max 10 MB)'}
              <input type="file" hidden onChange={(e) => setFile(e.target.files?.[0] || null)} /></label>
            {boot.settings.deliveryFee > 0 && <label className="cy-check"><input type="checkbox" checked={delivery} onChange={(e) => setDelivery(e.target.checked)} /> Deliver to my hostel (+{money(boot.settings.deliveryFee)})</label>}
            {delivery && <label>Hostel & room<input value={p.hostel} onChange={set('hostel')} /></label>}
            {svc.price !== '' && <p className="cy-meta">Estimate: <b>{money(Number(svc.price) * qty + (delivery ? boot.settings.deliveryFee : 0))}</b></p>}
            {err && <p className="cpl-err">{err}</p>}
            <div className="cy-row"><button className="lp-btn" disabled={sending} onClick={() => void submit()}>{sending ? 'Sending…' : 'Place order'}</button><button className="lp-btn lp-btn-soft" onClick={onClose}>Cancel</button></div>
          </div>
        )}
      </div>
    </div>
  )
}

function Docs({ boot, me }: { boot: Boot; me: Me | null }) {
  const [q, setQ] = useState('')
  const list = boot.documents.filter((d) => (d.title + d.category + d.description).toLowerCase().includes(q.toLowerCase()))
  const cats = Array.from(new Set(list.map((d) => d.category)))
  return (
    <>
      <div className="cpl-search"><Search size={16} /><input placeholder="Search documents…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      {!list.length && <p className="cpl-empty">No documents yet. Ask us on WhatsApp and we'll help.</p>}
      {cats.map((c) => (
        <section key={c}><h3 className="cy-cat">{c}</h3>
          {list.filter((d) => d.category === c).map((d) => (
            <div className="cy-doc" key={d.id}>
              <div><b>{d.title}</b>{d.description && <p>{d.description}</p>}</div>
              <div className="cy-row">
                {d.fileUrl && <a className="lp-btn" href={d.fileUrl} target="_blank" rel="noopener noreferrer"><FileDown size={14} /> Download</a>}
                <a className="lp-btn lp-btn-soft" href={waLink(boot.settings.whatsapp, `Hello Chuka Cyber, I'm ${me?.name || ''}. I need help filling: ${d.title}.`)} target="_blank" rel="noopener noreferrer">Need help?</a>
              </div>
            </div>
          ))}
        </section>
      ))}
    </>
  )
}

function Orders({ user }: { user: User }) {
  const [rows, setRows] = useState<Order[] | null>(null)
  const [err, setErr] = useState('')
  useEffect(() => { cy<Order[]>('myOrders', {}, user).then(setRows).catch((e) => setErr(e.message)) }, [user])
  if (err) return <p className="cpl-err">{err}</p>
  if (!rows) return <p className="cpl-empty">Loading…</p>
  if (!rows.length) return <p className="cpl-empty">No orders yet.</p>
  return <>{rows.map((o) => (
    <div className="cy-doc" key={o.orderId}>
      <div><b>{o.orderId} · {o.serviceName}</b><p>Qty {o.qty} · {o.createdAt} · {o.total !== '' && money(o.total)}</p></div>
      <div className="cy-badges"><span className={`st st-${o.status.replace(/\s/g, '')}`}>{o.status}</span><span className={`st pay-${o.payStatus}`}>{o.payStatus}</span></div>
    </div>
  ))}</>
}

const STATUSES = ['New', 'In progress', 'Ready', 'Collected', 'Cancelled']
const PAY = ['Unpaid', 'Paid', 'Refunded']

function Admin({ user, wa }: { user: User; wa: string }) {
  const [rows, setRows] = useState<Order[] | null>(null)
  const [err, setErr] = useState('')
  const [f, setF] = useState('Open')
  const load = useCallback(() => { cy<Order[]>('adminOrders', {}, user).then(setRows).catch((e) => setErr(e.message)) }, [user])
  useEffect(load, [load])
  async function upd(o: Order, patch: Partial<Order>) {
    setRows((r) => r && r.map((x) => (x.orderId === o.orderId ? { ...x, ...patch } : x)))
    try { await cy('adminUpdate', { orderId: o.orderId, ...patch }, user) } catch (e) { setErr((e as Error).message); load() }
  }
  if (err) return <p className="cpl-err">{err}</p>
  if (!rows) return <p className="cpl-empty">Loading…</p>
  const list = rows.filter((o) => f === 'All' || (f === 'Open' ? !['Collected', 'Cancelled'].includes(o.status) : o.status === f))
  return (
    <>
      <div className="cpl-chips">{['Open', 'All', ...STATUSES].map((s) => <button key={s} className={s === f ? 'on' : ''} onClick={() => setF(s)}>{s}</button>)}<button onClick={load}>Refresh</button></div>
      {!list.length && <p className="cpl-empty">No orders.</p>}
      {list.map((o) => (
        <div className="cy-order" key={o.orderId}>
          <div><b>{o.orderId} · {o.serviceName}</b> ×{o.qty} <span className="cy-meta">{o.total !== '' && money(o.total)} · {o.createdAt}</span>
            <p>{o.name} · {o.phone} · {o.reg}{o.delivery === 'yes' && <> · <b>Deliver: {o.hostel}</b></>}</p>
            {o.notes && <p className="cy-note">{o.notes}</p>}
            {o.fileUrl && <a href={o.fileUrl} target="_blank" rel="noopener noreferrer">📎 {o.fileName || 'File'}</a>}
          </div>
          <div className="cy-row">
            <select value={o.status} onChange={(e) => void upd(o, { status: e.target.value })}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
            <select value={o.payStatus} onChange={(e) => void upd(o, { payStatus: e.target.value })}>{PAY.map((s) => <option key={s}>{s}</option>)}</select>
            <input placeholder="M-Pesa code" defaultValue={o.mpesaCode} onBlur={(e) => e.target.value !== o.mpesaCode && void upd(o, { mpesaCode: e.target.value })} />
            <a className="lp-btn lp-btn-soft" href={waLink(normPhone(o.phone) || wa, `Hello ${o.name}, your order ${o.orderId} (${o.serviceName}) is now: ${o.status}.`)} target="_blank" rel="noopener noreferrer"><MessageCircle size={14} /> Notify</a>
          </div>
        </div>
      ))}
    </>
  )
}

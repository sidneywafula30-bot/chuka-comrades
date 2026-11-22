import { useMemo, useState } from 'react'
import { MessageCircle, Tag } from 'lucide-react'
import GoogleSignInButton from '../components/GoogleSignInButton'
import ImagePicker from '../components/ImagePicker'
import DriveImage from '../components/DriveImage'
import { PayBox, PendingPay, usePayCfg } from '../components/EfPay'
import { PLATFORMS, ef, fmtDay, ksh, waLink, type Listing, type Me } from '../lib/efootball'
import { useApi } from '../lib/efHooks'

type Tab = 'all' | 'sell' | 'buy' | 'mine'

/** Buy and sell eFootball accounts. Posting costs KSh 20; the admin verifies the payment, then the listing goes live for 30 days. */
export default function EfMarket({ me, signedIn, onSignIn }: { me: Me | null; signedIn: boolean; onSignIn: () => void }) {
  const [tab, setTab] = useState<Tab>('all')
  const [platform, setPlatform] = useState('')
  const [q, setQ] = useState('')
  const [posting, setPosting] = useState(false)
  const type = tab === 'sell' || tab === 'buy' ? tab : ''
  const list = useApi<Listing[]>('listings', { type }, 0, tab !== 'mine')
  const mine = useApi<Listing[]>('myListings', {}, 0, signedIn && tab === 'mine')
  const [zoom, setZoom] = useState('')
  const [nonce, setNonce] = useState(0)

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase()
    return (list.data ?? []).filter((l) => (!platform || l.platform === platform) && (!s || l.title.toLowerCase().includes(s) || l.details.toLowerCase().includes(s) || l.owner.username.toLowerCase().includes(s)))
  }, [list.data, platform, q, nonce])

  return (
    <div className="cpl-page">
      <h2>Accounts marketplace</h2>
      <p className="cpl-sub">Buy or sell eFootball accounts between Chuka students. Posting costs KSh 20 and stays up for 30 days once the admin verifies your payment. Always meet or pay safely: the admin only checks the post, not the deal.</p>

      <div className="ef-actions" style={{ marginTop: 0, marginBottom: 14 }}>
        <button className="lp-btn" onClick={() => setPosting((v) => !v)}><Tag size={15} /> {posting ? 'Close' : 'Post a listing'}</button>
      </div>
      {posting && (signedIn
        ? <PostForm me={me} done={() => { setPosting(false); setTab('mine'); setNonce((n) => n + 1) }} />
        : <section className="cpl-card"><p className="cpl-sub" style={{ margin: '0 0 12px' }}>Sign in with Google to post a listing.</p><GoogleSignInButton onClick={onSignIn} label="Sign in to post" /></section>)}

      <div className="ef-tabs" role="tablist">
        {([['all', 'All'], ['sell', 'For sale'], ['buy', 'Wanted'], ['mine', 'My listings']] as [Tab, string][]).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      {tab !== 'mine' && (
        <div className="cpl-inline" style={{ marginBottom: 14 }}>
          <input className="ef-sel" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search listings" aria-label="Search listings" />
          <select className="ef-sel" value={platform} onChange={(e) => setPlatform(e.target.value)} aria-label="Platform"><option value="">All platforms</option>{PLATFORMS.map((x) => <option key={x}>{x}</option>)}</select>
        </div>
      )}

      {tab === 'mine' ? (
        !signedIn ? <p className="cpl-empty">Sign in to see your listings.</p> : !mine.data ? <p className="cpl-empty">{mine.err || 'Loading…'}</p>
          : !mine.data.length ? <p className="cpl-empty">You have not posted anything yet.</p>
          : <div className="ef-card-grid">{mine.data.map((l) => <Card key={l.id} l={l} me={me} mine reload={mine.retry} zoom={setZoom} />)}</div>
      ) : list.err ? <p className="cpl-err" role="alert">{list.err}</p> : !list.data ? <p className="cpl-empty">Loading…</p>
        : !shown.length ? <p className="cpl-empty">No listings yet. Be the first to post one.</p>
        : <div className="ef-card-grid">{shown.map((l) => <Card key={l.id} l={l} me={me} zoom={setZoom} />)}</div>}

      {zoom && <div className="ef-zoom" onClick={() => setZoom('')} role="dialog" aria-label="Account screenshot"><DriveImage id={zoom} w={1200} alt="Account screenshot" /></div>}
    </div>
  )
}

function Card({ l, me, mine, reload, zoom }: { l: Listing; me: Me | null; mine?: boolean; reload?: () => void; zoom: (id: string) => void }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  async function close() {
    if (!confirm('Close this listing?')) return
    setBusy(true); setErr('')
    try { await ef('listingClose', { id: l.id }); reload?.() } catch (x) { setErr((x as Error).message) } finally { setBusy(false) }
  }
  const own = l.owner.uid === me?.uid
  return (
    <article className="ef-pcard ef-listing">
      {l.imageId ? <button type="button" onClick={() => zoom(l.imageId)} aria-label="View screenshot"><DriveImage id={l.imageId} w={400} fallback={<span className="ph"><Tag size={26} /></span>} /></button> : <span className="ph"><Tag size={26} /></span>}
      <div>
        <span className="ef-tags"><span className={`ef-pill${l.type === 'buy' ? ' gold' : ''}`}>{l.type === 'sell' ? 'For sale' : 'Wanted'}</span>{mine && <span className={`ef-pill${l.status === 'active' ? '' : l.status === 'pending' ? ' gold' : ' red'}`}>{l.status === 'pending' ? 'Waiting for admin' : l.status}</span>}</span>
        <strong>{l.title}</strong>
        <b className="ef-price">{ksh(l.price)}</b>
        <small>{l.platform}{l.strength ? ` · strength ${l.strength}` : ''}</small>
        {l.details && <small>{l.details}</small>}
        <small>{l.owner.username}{l.approvedAt ? ` · ${fmtDay(l.approvedAt)}` : ''}</small>
        {!mine && !own && (l.whatsapp
          ? <a className="ef-wa" href={waLink(l.whatsapp, `Hi ${l.owner.username}, I saw your ${l.type === 'sell' ? 'account for sale' : 'wanted post'} "${l.title}" (${ksh(l.price)}) on Chuka eFootball.`)} target="_blank" rel="noopener noreferrer"><MessageCircle size={14} /> Chat on WhatsApp</a>
          : <a className="ef-wa locked" href="#/efootball/profile"><MessageCircle size={14} /> Register to chat</a>)}
        {mine && (l.status === 'active' || l.status === 'pending') && <button className="lp-btn cpl-danger" disabled={busy} onClick={close}>Close listing</button>}
        {err && <small className="cpl-err">{err}</small>}
      </div>
    </article>
  )
}

function PostForm({ me, done }: { me: Me | null; done: () => void }) {
  const cfg = usePayCfg()
  const [type, setType] = useState<'sell' | 'buy'>('sell')
  const [title, setTitle] = useState('')
  const [platform, setPlatform] = useState(me?.profile?.platform ?? 'Mobile')
  const [price, setPrice] = useState('')
  const [strength, setStrength] = useState('')
  const [details, setDetails] = useState('')
  const [image, setImage] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [sent, setSent] = useState(false)

  if (me && !me.profile) return <section className="cpl-card"><p className="cpl-sub" style={{ margin: '0 0 12px' }}>Register as a player first (it is free), then you can post.</p><a className="lp-btn" href="#/efootball/profile">Register</a></section>

  async function post() {
    setBusy(true); setMsg(null)
    try {
      await ef('listingCreate', { type, title, platform, price: Number(price), strength: strength === '' ? '' : Number(strength), details, image: image || undefined, mpesa: code })
      setSent(true); setMsg({ ok: true, text: 'Posted. It goes live as soon as the admin verifies your payment. Chat the admin on WhatsApp to speed it up.' })
    } catch (x) { setMsg({ ok: false, text: (x as Error).message }) }
    finally { setBusy(false) }
  }
  if (sent) return (
    <section className="cpl-card">
      <PendingPay label={`Marketplace listing: ${title}`} amount={cfg.fees.listing} code={code} />
      {msg && <p className={`cpl-msg${msg.ok ? '' : ' bad'}`} role="status">{msg.text}</p>}
      <div className="ef-actions"><button className="lp-btn" onClick={done}>See my listings</button></div>
    </section>
  )
  return (
    <section className="cpl-card cpl-form cpl-wide">
      <h3>Post a listing</h3>
      <div className="ef-tabs" style={{ position: 'static', padding: 0 }} role="group" aria-label="Listing type">
        <button type="button" className={type === 'sell' ? 'on' : ''} onClick={() => setType('sell')}>I am selling</button>
        <button type="button" className={type === 'buy' ? 'on' : ''} onClick={() => setType('buy')}>I want to buy</button>
      </div>
      <label>Title<input type="text" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder={type === 'sell' ? 'Mobile account, strength 3200' : 'Looking for a PS5 account with Messi'} /></label>
      <div className="cpl-grid2">
        <label>Platform<select value={platform} onChange={(e) => setPlatform(e.target.value)}>{PLATFORMS.map((x) => <option key={x}>{x}</option>)}</select></label>
        <label>{type === 'sell' ? 'Price (KSh)' : 'Budget (KSh)'}<input type="number" inputMode="numeric" min={1} value={price} onChange={(e) => setPrice(e.target.value)} /></label>
      </div>
      <label>Team strength (optional)<input type="number" inputMode="numeric" min={500} max={6000} value={strength} onChange={(e) => setStrength(e.target.value)} placeholder="e.g. 3200" /></label>
      <label>Details (optional)<textarea rows={3} maxLength={500} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Players, coins, linked email, anything a buyer should know" /></label>
      <fieldset className="cpl-fs">
        <legend>{type === 'sell' ? 'Account screenshot (required)' : 'Screenshot (optional)'}</legend>
        <ImagePicker current="" fallback={<Tag size={26} />} label="screenshot" max={1280} onChange={(v) => setImage(v.data)} />
        <small>Show the squad and team strength. Never share your password in the post.</small>
      </fieldset>
      <p className="ef-deadline" style={{ color: 'var(--green)' }}>Listing fee: {ksh(cfg.fees.listing)}, paid once per listing.</p>
      <PayBox amount={cfg.fees.listing} label={`Marketplace listing: ${title || 'new listing'}`} code={code} onCode={setCode} onSubmit={post} busy={busy} button="Pay and post" disabled={title.trim().length < 3 || !price || (type === 'sell' && !image)} />
      {msg && <p className={`cpl-msg${msg.ok ? '' : ' bad'}`} role="status">{msg.text}</p>}
    </section>
  )
}

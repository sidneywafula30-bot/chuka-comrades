import { useCallback, useEffect, useState, type FormEvent } from 'react'
import type { User } from 'firebase/auth'
import { Copy, ExternalLink, ImagePlus, Link2, MessageCircle, Pencil, Plus, Search, ShoppingBag, Trash2 } from 'lucide-react'
import { skillsApi, skillsReady, type Order, type PendingOrder, type Product, type SkillsConfig } from '../lib/skills'
import { errMsg, fmtDate, packFiles, type Note } from '../lib/hub'
import { shrinkImage } from '../lib/files'
import { AttachList, Empty, FilePicker, Loading, Modal, Msg } from '../components/HubUi'

const call = skillsApi.call
const kes = (n: number) => (n > 0 ? `KES ${n.toLocaleString('en-KE')}` : 'Free')

/** WhatsApp link to the admin, with the order details filled in so activation is one tap. */
function waLink(config: SkillsConfig, user: User | null, p: { title: string; price: number }, orderId: string, code: string) {
  const text = [
    'Hello Chuka Comrades admin, I have paid for a product on Chuka Skills. Please activate it.',
    '', `Product: ${p.title}`, `Amount: KES ${p.price}`, `Paid to: ${config.payTo}`, `M-Pesa code: ${code || '(will send the SMS)'}`,
    `Order ref: ${orderId}`, `Name: ${user?.displayName ?? ''}`, `Email: ${user?.email ?? ''}`,
  ].join('\n')
  return `https://wa.me/${config.whatsapp}?text=${encodeURIComponent(text)}`
}

/* ---------- shop ---------- */
function Cover({ p }: { p: Pick<Product, 'coverUrl' | 'title'> }) {
  return p.coverUrl
    ? <img className="pr-cover" src={p.coverUrl} alt="" loading="lazy" referrerPolicy="no-referrer" />
    : <div className="pr-cover"><ShoppingBag size={34} /></div>
}

function ProductModal({ p, user, onSignIn, config, onClose, onChanged }: { p: Product; user: User | null; onSignIn: () => void; config: SkillsConfig; onClose: () => void; onChanged: (m?: string) => void }) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<Note>(null)
  const [copied, setCopied] = useState(false)
  async function copy() { try { await navigator.clipboard.writeText(config.payTo); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { /* ignore */ } }
  async function paid() {
    if (!user) return onSignIn()
    setBusy(true); setMsg(null)
    const w = p.price > 0 ? window.open('', '_blank') : null
    try {
      const o = await skillsApi.order(p.id, code.trim())
      if (o.status === 'active') { w?.close(); onChanged('Added to your library.'); onClose(); return }
      const url = waLink(config, user, { title: p.title, price: p.price }, o.id, code.trim().toUpperCase())
      if (w) w.location.href = url; else window.open(url, '_blank')
      setMsg({ type: 'ok', text: 'Order saved. Send the WhatsApp message to the admin so they can activate it. It will then appear in My skills > My library.' })
      onChanged()
    } catch (e) { w?.close(); setMsg({ type: 'err', text: errMsg(e) }) } finally { setBusy(false) }
  }
  return (
    <Modal title={p.title} onClose={onClose}>
      <Cover p={p} />
      <div className="sl-resource-top"><span className="sl-chip">{p.skill}</span><span className="sl-chip">{p.level}</span><span className="sl-chip">{p.format}</span></div>
      <p style={{ whiteSpace: 'pre-wrap', fontSize: 14 }}>{p.description}</p>
      <Msg msg={msg} />
      {p.owned ? (
        <div className="cf-box">
          <strong>You own this</strong>
          {p.deliverLink && <a className="sl-link" href={p.deliverLink} target="_blank" rel="noreferrer noopener"><Link2 size={14} /> Open your download link <ExternalLink size={12} /></a>}
          <AttachList items={p.attachments ?? []} call={call} onError={(m) => setMsg({ type: 'err', text: m })} />
        </div>
      ) : p.price === 0 ? (
        <button className="sl-primary" disabled={busy} onClick={paid}>{user ? (busy ? 'Adding…' : 'Get it free') : 'Sign in to get it'}</button>
      ) : (
        <>
          <ol className="pr-steps">
            <li><span className="pr-num">1</span><div>Pay <b>{kes(p.price)}</b> by M-Pesa to<div className="pr-pay"><code>{config.payTo}</code><button type="button" className="sl-mini" onClick={copy}><Copy size={13} /> {copied ? 'Copied' : 'Copy'}</button></div></div></li>
            <li><span className="pr-num">2</span><div>Tap the green button. It saves your order and opens WhatsApp with the details filled in.</div></li>
            <li><span className="pr-num">3</span><div>The admin activates it, and it appears under <b>My skills &gt; My library</b>.</div></li>
          </ol>
          <label className="sl-form" style={{ display: 'grid', gap: 6, fontSize: 13 }}>M-Pesa code (optional, speeds things up)
            <input value={code} onChange={(e) => setCode(e.target.value)} maxLength={14} placeholder="e.g. QGH7AB12CD" style={{ textTransform: 'uppercase' }} /></label>
          <button className="sl-primary" style={{ marginTop: 10 }} disabled={busy} onClick={paid}><MessageCircle size={15} /> {user ? (busy ? 'Saving…' : p.myOrder === 'pending' ? 'Message admin again' : `I have paid ${kes(p.price)}, message admin`) : 'Sign in to buy'}</button>
          {p.myOrder === 'pending' && <p className="sl-sub" style={{ marginTop: 8 }}>You already have an order for this. It is waiting for the admin to activate it.</p>}
        </>
      )}
    </Modal>
  )
}

function ProductCard({ p, onOpen }: { p: Product; onOpen: (p: Product) => void }) {
  return (
    <article className="sl-resource" onClick={() => onOpen(p)} style={{ cursor: 'pointer' }}>
      <Cover p={p} />
      <div className="sl-resource-top"><span className="sl-chip">{p.skill}</span><span className="sl-chip">{p.format}</span>{p.status !== 'live' && <span className="sl-chip">{p.status}</span>}</div>
      <h3>{p.title}</h3>
      <p>{p.description.length > 110 ? `${p.description.slice(0, 110)}…` : p.description}</p>
      <div className="sl-resource-foot"><span className="pr-price">{kes(p.price)}</span>
        <span className="sl-foot-actions">{p.owned ? <span className="hub-pay">Owned</span> : p.myOrder === 'pending' ? <span className="hub-pay">Waiting</span> : <button className="sl-mini">{p.price === 0 ? 'Get free' : 'View & buy'}</button>}</span></div>
    </article>
  )
}

export function Shop({ user, onSignIn, config }: { user: User | null; onSignIn: () => void; config: SkillsConfig }) {
  const [items, setItems] = useState<Product[] | null>(null)
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [sel, setSel] = useState<Product | null>(null)
  const [msg, setMsg] = useState<Note>(null)
  const load = useCallback(() => {
    if (!skillsReady) { setItems([]); return }
    skillsApi.products().then(setItems).catch((e) => { setMsg({ type: 'err', text: errMsg(e) }); setItems([]) })
  }, [])
  useEffect(() => { load() }, [load, user])
  const shown = (items ?? []).filter((p) => (!cat || p.category === cat) && (!q.trim() || `${p.title} ${p.skill} ${p.format}`.toLowerCase().includes(q.trim().toLowerCase())))
  const cats = Array.from(new Set((items ?? []).map((p) => p.category)))
  return (
    <>
      <div className="sl-page-head"><div><span className="sl-kicker">SHOP</span><h1>Digital products from Chuka Skills</h1></div></div>
      <p className="sl-sub" style={{ marginBottom: 10 }}>Guides, templates and starter packs. Pay by M-Pesa, message the admin on WhatsApp, and your download is activated.</p>
      <div className="hub-bar"><div className="sl-search"><Search size={18} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products…" /></div></div>
      {cats.length > 1 && <div className="hub-chips"><button className={cat === '' ? 'on' : ''} onClick={() => setCat('')}>All</button>{cats.map((c) => <button key={c} className={cat === c ? 'on' : ''} onClick={() => setCat(c)}>{c}</button>)}</div>}
      <Msg msg={msg} />
      {!items ? <Loading /> : shown.length === 0 ? <Empty icon={<ShoppingBag size={26} />} title="No products yet" text="New guides and templates are added by the admin. Check back soon." /> : (
        <div className="sl-grid">{shown.map((p) => <ProductCard key={p.id} p={p} onOpen={setSel} />)}</div>
      )}
      {sel && <ProductModal p={sel} user={user} onSignIn={onSignIn} config={config} onClose={() => setSel(null)} onChanged={(m) => { load(); if (m) setMsg({ type: 'ok', text: m }) }} />}
    </>
  )
}

/** "My library" block shown under My skills. */
export function Library({ config, user }: { config: SkillsConfig; user: User }) {
  const [data, setData] = useState<{ library: Product[]; pending: PendingOrder[] } | null>(null)
  const [msg, setMsg] = useState<Note>(null)
  useEffect(() => { skillsApi.library().then(setData).catch((e) => { setMsg({ type: 'err', text: errMsg(e) }); setData({ library: [], pending: [] }) }) }, [])
  return (
    <>
      <div className="hub-sec"><h2>My library</h2></div>
      <Msg msg={msg} />
      {!data ? <Loading /> : (
        <>
          {data.pending.map((o) => (
            <div className="cf-box" key={o.orderId}>
              <strong>{o.title} <span className="hub-pay">Waiting for activation</span></strong>
              <small>Ordered {fmtDate(o.createdAt)} · KES {o.price}{o.mpesaCode ? ` · ${o.mpesaCode}` : ''}</small>
              <a className="sl-mini" href={waLink(config, user, { title: o.title, price: o.price }, o.orderId, o.mpesaCode)} target="_blank" rel="noreferrer noopener"><MessageCircle size={13} /> Message admin</a>
            </div>
          ))}
          {data.library.length === 0 && data.pending.length === 0 ? <Empty icon={<ShoppingBag size={26} />} title="Nothing here yet" text="Products you buy or get free appear here." /> : (
            <div className="sl-grid">{data.library.map((p) => (
              <article className="sl-resource" key={p.id}>
                <Cover p={p} /><h3>{p.title}</h3><small className="sl-unitline">{p.skill} · {p.format}</small>
                {p.deliverLink && <a className="sl-link" href={p.deliverLink} target="_blank" rel="noreferrer noopener"><Link2 size={14} /> Open download link <ExternalLink size={12} /></a>}
                <AttachList items={p.attachments ?? []} call={call} onError={(m) => setMsg({ type: 'err', text: m })} />
              </article>))}</div>
          )}
        </>
      )}
    </>
  )
}

/* ---------- admin: products ---------- */
function ProductForm({ p, config, onClose, onDone }: { p?: Product; config: SkillsConfig; onClose: () => void; onDone: () => void }) {
  const [title, setTitle] = useState(p?.title ?? '')
  const [skill, setSkill] = useState(p?.skill ?? '')
  const [category, setCategory] = useState(p?.category ?? config.categories[0] ?? 'Other')
  const [level, setLevel] = useState(p?.level ?? 'All levels')
  const [description, setDescription] = useState(p?.description ?? '')
  const [format, setFormat] = useState(p?.format ?? 'PDF guide')
  const [price, setPrice] = useState(String(p?.price ?? 100))
  const [status, setStatus] = useState<'draft' | 'live'>(p?.status === 'live' ? 'live' : 'draft')
  const [deliverLink, setDeliverLink] = useState(p?.deliverLink ?? '')
  const [cover, setCover] = useState<File | null>(null)
  const [files, setFiles] = useState<File[]>([])
  const [removeIds, setRemoveIds] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<Note>(null)
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setMsg(null)
    try {
      const coverData = cover ? (await shrinkImage(cover, 800, 0.78)).split(',')[1] ?? '' : ''
      await skillsApi.admin.saveProduct({
        id: p?.id, title: title.trim(), skill: skill.trim(), category, level, description: description.trim(), format: format.trim(), price: Number(price), status,
        deliverLink: deliverLink.trim(), cover: coverData ? { name: 'cover.jpg', data: coverData } : undefined, files: await packFiles(files, config.files), removeFileIds: removeIds,
      })
      onDone(); onClose()
    } catch (err) { setMsg({ type: 'err', text: errMsg(err) }) } finally { setBusy(false) }
  }
  return (
    <Modal title={p ? 'Edit product' : 'New product'} onClose={onClose}>
      <form className="sl-form" onSubmit={submit}>
        <label>Product title<input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} placeholder="e.g. Barber starter guide" /></label>
        <div className="sl-two">
          <label>Skill<input value={skill} onChange={(e) => setSkill(e.target.value)} maxLength={60} placeholder="e.g. Barbering" /></label>
          <label>Category<select value={category} onChange={(e) => setCategory(e.target.value)}>{config.categories.map((c) => <option key={c}>{c}</option>)}</select></label>
        </div>
        <label>Description (what the buyer gets)<textarea rows={5} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} /></label>
        <div className="sl-two">
          <label>Level<select value={level} onChange={(e) => setLevel(e.target.value)}>{config.levels.map((l) => <option key={l}>{l}</option>)}</select></label>
          <label>Format<input value={format} onChange={(e) => setFormat(e.target.value)} maxLength={40} placeholder="PDF guide, templates, video pack…" /></label>
        </div>
        <div className="sl-two">
          <label>Price (KES, 0 = free)<input type="number" min={0} max={100000} value={price} onChange={(e) => setPrice(e.target.value)} /></label>
          <label>Status<select value={status} onChange={(e) => setStatus(e.target.value as 'draft' | 'live')}><option value="draft">Draft (hidden)</option><option value="live">Live (in the shop)</option></select></label>
        </div>
        <label className="sl-drop pr-cover-pick"><ImagePlus size={18} /> Cover image {p?.coverUrl && !cover ? '(a cover is set; choose a new one to replace it)' : ''}
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setCover(e.target.files?.[0] ?? null)} />
          <small>{cover ? cover.name : 'Wide or square images work best. It is shrunk automatically.'}</small></label>
        <label>Delivery link (optional: Google Drive, Mega… shown only to buyers)<input type="url" value={deliverLink} onChange={(e) => setDeliverLink(e.target.value)} placeholder="https://" /></label>
        <FilePicker files={files} setFiles={setFiles} rules={config.files} onError={(m) => setMsg({ type: 'err', text: m })} existing={p?.attachments} removeIds={removeIds} setRemoveIds={setRemoveIds} />
        <p className="sl-sub">Files are private: only buyers you activate can open them. For files larger than {config.files.maxFileMB} MB, use a delivery link.</p>
        <Msg msg={msg} />
        <button className="sl-primary" disabled={busy}>{busy ? 'Saving…' : 'Save product'}</button>
      </form>
    </Modal>
  )
}

export function AdminProducts({ config, tick }: { config: SkillsConfig; tick: number }) {
  const [items, setItems] = useState<Product[] | null>(null)
  const [edit, setEdit] = useState<Product | 'new' | null>(null)
  const [msg, setMsg] = useState<Note>(null)
  const load = useCallback(() => skillsApi.admin.products().then(setItems).catch((e) => { setMsg({ type: 'err', text: errMsg(e) }); setItems([]) }), [])
  useEffect(() => { void load() }, [load, tick])
  async function remove(p: Product) {
    if (!window.confirm(`Remove “${p.title}”? If it has orders it is archived so buyers keep access.`)) return
    try { const r = await skillsApi.admin.deleteProduct(p.id); setMsg({ type: 'ok', text: r.archived ? 'Archived (buyers keep access).' : 'Deleted.' }); await load() } catch (e) { setMsg({ type: 'err', text: errMsg(e) }) }
  }
  return (
    <>
      <div className="hub-sec"><h2>Products</h2><button className="sl-primary small" onClick={() => setEdit('new')}><Plus size={15} /> New product</button></div>
      <Msg msg={msg} />
      {!items ? <Loading /> : items.length === 0 ? <Empty icon={<ShoppingBag size={26} />} title="No products yet" text="Create your first guide, template or starter pack." /> : (
        <div className="sl-grid">{items.map((p) => (
          <div key={p.id}><ProductCard p={p} onOpen={() => setEdit(p)} />
            <span className="sl-foot-actions" style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <button className="sl-mini" onClick={() => setEdit(p)}><Pencil size={13} /> Edit</button>
              <button className="sl-mini danger" onClick={() => remove(p)}><Trash2 size={13} /> Remove</button></span></div>))}</div>
      )}
      {edit && <ProductForm p={edit === 'new' ? undefined : edit} config={config} onClose={() => setEdit(null)} onDone={() => { void load(); setMsg({ type: 'ok', text: 'Product saved.' }) }} />}
    </>
  )
}

/* ---------- admin: orders ---------- */
export function AdminOrders({ tick }: { tick: number }) {
  const [data, setData] = useState<{ stats: { pending: number; active: number; revenue: number }; orders: Order[] } | null>(null)
  const [only, setOnly] = useState<'pending' | 'all'>('pending')
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [msg, setMsg] = useState<Note>(null)
  const load = useCallback(() => skillsApi.admin.orders().then(setData).catch((e) => { setMsg({ type: 'err', text: errMsg(e) }); setData({ stats: { pending: 0, active: 0, revenue: 0 }, orders: [] }) }), [])
  useEffect(() => { void load() }, [load, tick])
  const decide = (id: string, d: 'activate' | 'reject') => skillsApi.admin.decideOrder(id, d, notes[id]?.trim()).then(() => { setMsg({ type: 'ok', text: d === 'activate' ? 'Activated. The buyer can now open it.' : 'Rejected.' }); return load() }).catch((e) => setMsg({ type: 'err', text: errMsg(e) }))
  const list = (data?.orders ?? []).filter((o) => only === 'all' || o.status === 'pending')
  return (
    <>
      <Msg msg={msg} />
      {data && <div className="pr-stats"><div className="pr-stat"><b>{data.stats.pending}</b>waiting</div><div className="pr-stat"><b>{data.stats.active}</b>activated</div><div className="pr-stat"><b>{kes(data.stats.revenue)}</b>earned</div></div>}
      <div className="hub-chips"><button className={only === 'pending' ? 'on' : ''} onClick={() => setOnly('pending')}>Waiting</button><button className={only === 'all' ? 'on' : ''} onClick={() => setOnly('all')}>All orders</button></div>
      {!data ? <Loading /> : list.length === 0 ? <Empty title={only === 'pending' ? 'No orders waiting' : 'No orders yet'} /> : (
        <div className="sl-grid">{list.map((o) => (
          <article className="sl-resource" key={o.id}>
            <div className="sl-resource-top"><span className={`sl-badge ${o.status === 'active' ? 'approved' : o.status}`}>{o.status === 'active' ? 'Activated' : o.status === 'pending' ? 'Waiting' : 'Rejected'}</span><span className="sl-chip">Ref {o.id}</span></div>
            <h3>{o.productTitle}</h3>
            <div className="hub-meta"><span>{kes(o.price)}</span><span>{o.name || 'Student'} · {o.email}</span><span>{fmtDate(o.createdAt)}</span></div>
            <p>M-Pesa code: <b>{o.mpesaCode || 'not given yet (check the WhatsApp message / SMS)'}</b></p>
            {o.note && <p className="sl-sub">Note: {o.note}</p>}
            <span className="hub-decide">
              <input placeholder="Note (optional)" value={notes[o.id] ?? ''} onChange={(e) => setNotes({ ...notes, [o.id]: e.target.value })} />
              {o.status !== 'active' && <button className="sl-mini" onClick={() => decide(o.id, 'activate')}>Activate</button>}
              {o.status !== 'rejected' && <button className="sl-mini danger" onClick={() => decide(o.id, 'reject')}>{o.status === 'active' ? 'Revoke' : 'Reject'}</button>}
            </span>
          </article>))}</div>
      )}
      <p className="sl-sub" style={{ marginTop: 12 }}>Always match the M-Pesa SMS on your phone (amount and code) before you activate.</p>
    </>
  )
}

/* ---------- admin: settings (categories + playlist import) ---------- */
export function AdminSettings({ config, onSaved }: { config: SkillsConfig; onSaved: () => void }) {
  const [cats, setCats] = useState(config.categories.join('\n'))
  const [url, setUrl] = useState('')
  const [skill, setSkill] = useState('')
  const [category, setCategory] = useState(config.categories[0] ?? 'Other')
  const [limit, setLimit] = useState('15')
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState<Note>(null)
  async function saveCats(e: FormEvent) {
    e.preventDefault(); setBusy('cats'); setMsg(null)
    try { await skillsApi.admin.saveCategories(cats.split('\n').map((s) => s.trim()).filter(Boolean)); setMsg({ type: 'ok', text: 'Categories saved.' }); onSaved() } catch (err) { setMsg({ type: 'err', text: errMsg(err) }) } finally { setBusy('') }
  }
  async function importList(e: FormEvent) {
    e.preventDefault(); setBusy('pl'); setMsg(null)
    try {
      const r = await skillsApi.admin.importPlaylist({ url: url.trim(), skill: skill.trim(), category, limit: Number(limit) })
      setMsg({ type: 'ok', text: `Added ${r.added} videos${r.skipped ? ` (${r.skipped} skipped: already added, private or deleted)` : ''}. They are live in Learn now.` }); setUrl('')
    } catch (err) { setMsg({ type: 'err', text: errMsg(err) }) } finally { setBusy('') }
  }
  return (
    <>
      <Msg msg={msg} />
      <div className="hub-sec"><h2>Import a YouTube playlist</h2></div>
      <form className="sl-form cf-box" onSubmit={importList}>
        <small>Hand-pick a good playlist (for example “barbering for beginners”) and add its videos as recommendations in one go. This uses very little YouTube quota.</small>
        <label>Playlist link<input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.youtube.com/playlist?list=…" /></label>
        <div className="sl-two">
          <label>Skill<input value={skill} onChange={(e) => setSkill(e.target.value)} maxLength={60} placeholder="e.g. Barbering" /></label>
          <label>Category<select value={category} onChange={(e) => setCategory(e.target.value)}>{config.categories.map((c) => <option key={c}>{c}</option>)}</select></label>
        </div>
        <label>How many videos (max 25)<input type="number" min={1} max={25} value={limit} onChange={(e) => setLimit(e.target.value)} /></label>
        <button className="sl-primary small" disabled={busy === 'pl' || !url.trim() || skill.trim().length < 2}>{busy === 'pl' ? 'Importing…' : 'Import videos'}</button>
      </form>
      <div className="hub-sec"><h2>Categories</h2></div>
      <form className="sl-form cf-box" onSubmit={saveCats}>
        <small>One category per line. This list is used for classes, videos, courses and products. Existing items keep the name they already have.</small>
        <textarea rows={12} value={cats} onChange={(e) => setCats(e.target.value)} />
        <button className="sl-primary small" disabled={busy === 'cats'}>{busy === 'cats' ? 'Saving…' : 'Save categories'}</button>
      </form>
    </>
  )
}

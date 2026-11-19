import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import type { User } from 'firebase/auth'
import QRCode from 'qrcode'
import { ArrowLeft, CalendarPlus, Check, ChevronLeft, ChevronRight, Copy, Download, Images, LoaderCircle, MessageCircle, Send, Trash2, X } from 'lucide-react'
import DriveImage from '../components/DriveImage'
import { fileToB64, shrinkImage } from '../lib/files'
import { jcall, journeyReady, MAX_PICS, pageUrl, picDownload, reminder, waAdmin, ytId, fmt, type AdminRow, type Home, type Me, type Msg, type Pic, type PublicGrad } from '../lib/journey'
import './Journey.css'

type Props = { user: User | null; route: string; onSignIn: () => void; onBack: () => void }
const err = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong. Try again.')
const go = (h: string) => { window.location.hash = h }

function useLoad<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null), [error, setError] = useState(''), [tick, setTick] = useState(0)
  useEffect(() => { let live = true; setError(''); fn().then((d) => live && setData(d)).catch((e) => live && setError(err(e))); return () => { live = false } }, [...deps, tick]) // eslint-disable-line react-hooks/exhaustive-deps
  return { data, error, reload: useCallback(() => setTick((t) => t + 1), []) }
}
const Spin = () => <p className="jr-note"><LoaderCircle className="jr-spin" size={16} /> Loading…</p>
function CopyBtn({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [ok, setOk] = useState(false)
  return <button type="button" className="jr-mini" onClick={() => navigator.clipboard.writeText(text).then(() => { setOk(true); setTimeout(() => setOk(false), 1500) })}>{ok ? <Check size={13} /> : <Copy size={13} />} {ok ? 'Copied' : label}</button>
}
function Media({ m }: { m: Msg }) {
  const y = ytId(m.yt || '')
  return (<>
    {(m.photos?.length ?? 0) > 0 && <div className="jr-shots">{m.photos!.map((id) => <a key={id} href={`https://drive.google.com/file/d/${id}/view`} target="_blank" rel="noreferrer noopener"><DriveImage id={id} w={500} alt="Photo from a friend" /></a>)}</div>}
    {m.videoId && <iframe className="jr-video" src={`https://drive.google.com/file/d/${m.videoId}/preview`} title="Video message" allowFullScreen />}
    {y && <iframe className="jr-video" src={`https://www.youtube-nocookie.com/embed/${y}?rel=0`} title="Video message" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />}
  </>)
}
function Remind({ title, date, details, yearly, label }: { title: string; date: string; details: string; yearly?: boolean; label: string }) {
  if (!date) return null
  const r = reminder(title, date, details, yearly)
  return <span className="jr-remind"><CalendarPlus size={14} /> {label}: <a href={r.google} target="_blank" rel="noreferrer noopener">Google</a> · <a href={r.ics} download="reminder.ics">iPhone / Outlook</a></span>
}

/** Photo grid with a full-screen viewer: arrows, swipe, Esc to close. */
function Gallery({ pics }: { pics: Pic[] }) {
  const [open, setOpen] = useState<number | null>(null), [x0, setX0] = useState(0)
  const n = pics.length
  const step = useCallback((d: number) => setOpen((i) => (i === null ? i : (i + d + n) % n)), [n])
  useEffect(() => {
    if (open === null) return
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(null); else if (e.key === 'ArrowRight') step(1); else if (e.key === 'ArrowLeft') step(-1) }
    window.addEventListener('keydown', key); document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', key); document.body.style.overflow = '' }
  }, [open, step])
  if (n === 0) return null
  const p = open === null ? null : pics[open]
  return (<>
    <div className="jr-gal">{pics.map((q, i) => <button key={q.id} type="button" className="jr-tile" onClick={() => setOpen(i)} aria-label={q.caption || `Open photo ${i + 1}`}><DriveImage id={q.photoId} w={500} alt={q.caption || 'Graduation day photo'} /></button>)}</div>
    {p && open !== null && (
      <div className="jr-lb" role="dialog" aria-modal="true" aria-label="Photo viewer" onClick={() => setOpen(null)}
        onTouchStart={(e) => setX0(e.touches[0].clientX)} onTouchEnd={(e) => { const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 60) step(dx < 0 ? 1 : -1) }}>
        <button type="button" className="jr-lb-x" aria-label="Close" onClick={() => setOpen(null)}><X size={22} /></button>
        {n > 1 && <button type="button" className="jr-lb-n prev" aria-label="Previous photo" onClick={(e) => { e.stopPropagation(); step(-1) }}><ChevronLeft size={26} /></button>}
        <figure onClick={(e) => e.stopPropagation()}>
          <DriveImage id={p.photoId} w={1600} alt={p.caption || 'Graduation day photo'} />
          <figcaption>{p.caption && <span>{p.caption}</span>}<small>{open + 1} of {n}</small><a href={picDownload(p.photoId)} target="_blank" rel="noreferrer noopener"><Download size={14} /> Save</a></figcaption>
        </figure>
        {n > 1 && <button type="button" className="jr-lb-n next" aria-label="Next photo" onClick={(e) => { e.stopPropagation(); step(1) }}><ChevronRight size={26} /></button>}
      </div>)}
  </>)
}

/** Owner tools: upload many ceremony photos at once, add a caption, delete. */
function GalleryManager({ slug }: { slug: string }) {
  const { data, error, reload } = useLoad(() => jcall<{ pics: Pic[] }>('gallery', { slug }), [slug])
  const [caption, setCaption] = useState(''), [prog, setProg] = useState<{ done: number; total: number } | null>(null), [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null)
  const pics = data?.pics ?? []
  async function add(list: FileList | null) {
    const files = Array.from(list ?? []).filter((f) => f.type.startsWith('image/'))
    if (files.length === 0) return
    const room = MAX_PICS - pics.length
    if (room <= 0) { setMsg({ ok: false, t: `You have reached the limit of ${MAX_PICS} photos. Delete one to add another.` }); return }
    const take = files.slice(0, room)
    setMsg(null)
    let ok = 0, fail = ''
    for (let i = 0; i < take.length; i++) {
      setProg({ done: i, total: take.length })
      try { const d = await shrinkImage(take[i], 1600, 0.8); await jcall('galleryAdd', { photo: d.split(',')[1] ?? '', caption: caption.trim() }); ok++ }
      catch (x) { fail = err(x); break }
    }
    setProg(null); if (ok > 0) setCaption('')
    const skipped = files.length - take.length
    setMsg(fail ? { ok: false, t: `${ok} uploaded, then it stopped: ${fail}` } : { ok: true, t: `${ok} photo${ok === 1 ? '' : 's'} added.${skipped > 0 ? ` ${skipped} skipped (limit ${MAX_PICS}).` : ''}` })
    reload()
  }
  async function del(id: string) {
    if (!confirm('Delete this photo for good?')) return
    try { await jcall('galleryDel', { id }); reload() } catch (x) { setMsg({ ok: false, t: err(x) }) }
  }
  return (
    <section className="jr-card"><h2><Images size={18} /> Graduation day photos ({pics.length}/{MAX_PICS})</h2>
      <p className="jr-note">Upload photos from your ceremony. They appear on your public page, and anyone with your link can open and save them.</p>
      {error && <p className="jr-alert">{error}</p>}
      <div className="jr-form">
        <input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Caption for the next upload (optional), e.g. With mum at the gate" maxLength={120} />
        <label className="jr-file">Choose photos (you can pick many)
          <input type="file" accept="image/*" multiple disabled={!!prog || pics.length >= MAX_PICS} onChange={(e) => { const el = e.target; void add(el.files).then(() => { el.value = '' }) }} /></label>
        {prog && <p className="jr-note"><LoaderCircle className="jr-spin" size={14} /> Uploading {prog.done + 1} of {prog.total}. Keep this page open.</p>}
        {msg && <p className={msg.ok ? 'jr-ok' : 'jr-alert'}>{msg.t}</p>}
      </div>
      {pics.length > 0 && <div className="jr-gal jr-gal-edit">{pics.map((q) => (
        <div key={q.id} className="jr-tile"><DriveImage id={q.photoId} w={400} alt={q.caption || 'Graduation day photo'} />
          <button type="button" className="jr-del" aria-label="Delete photo" onClick={() => void del(q.id)}><Trash2 size={14} /></button></div>))}</div>}
    </section>
  )
}

export default function Journey({ user, route, onSignIn, onBack }: Props) {
  const [a, b] = route.replace(/^#\/journey\/?/, '').split('/')
  let body: ReactNode
  if (!a) body = <Landing user={user} onSignIn={onSignIn} />
  else if (a === 'me') body = <Account user={user} onSignIn={onSignIn} />
  else if (a === 'admin') body = <Admin user={user} />
  else body = <PublicPage slug={a} write={b === 'write'} />
  return (
    <div className="jr">
      <header className="jr-bar">
        <button className="jr-back" onClick={a ? () => go('#/journey') : onBack} aria-label="Back"><ArrowLeft size={18} /></button>
        <strong>The Long Campus Journey</strong>
        {user && a !== 'me' && <a href="#/journey/me">My account</a>}
      </header>
      <main className="jr-main">{!journeyReady ? <p className="jr-note">Not connected yet. Add VITE_JOURNEY_API_URL to .env and restart.</p> : body}</main>
    </div>
  )
}

function Landing({ user, onSignIn }: { user: User | null; onSignIn: () => void }) {
  const { data: h, error } = useLoad(() => jcall<Home>('home'), [])
  return (
    <section className="jr-hero">
      <p className="jr-year">Chuka class of {h?.classYear ?? '…'}</p>
      <h1>The Long Campus Journey</h1>
      <p className="jr-tag">Our memories. Our journey. Our forever.</p>
      <p>Your own page with your story, your thank-you to the people who carried you, and a QR code anyone can scan to write you a message. Live for one year.</p>
      {error && <p className="jr-alert">{error}</p>}
      <button className="jr-primary" onClick={() => (user ? go('#/journey/me') : onSignIn())}>{user ? 'Open my account' : 'Sign in to open my account'}</button>
      {h && <p className="jr-note">KSh {h.price} once. Pay on M-Pesa, send the code, the admin activates your page.</p>}
    </section>
  )
}

function PublicPage({ slug, write }: { slug: string; write: boolean }) {
  const { data: g, error, reload } = useLoad(() => jcall<PublicGrad>('view', { slug }), [slug])
  const { data: h } = useLoad(() => jcall<Home>('home'), [])
  const { data: gal } = useLoad(() => jcall<{ pics: Pic[] }>('gallery', { slug }).catch(() => ({ pics: [] as Pic[] })), [slug])
  const [name, setName] = useState(''), [text, setText] = useState(''), [priv, setPriv] = useState(false), [trap, setTrap] = useState('')
  const [busy, setBusy] = useState(false), [sent, setSent] = useState(false), [fail, setFail] = useState('')
  const draft = `jr-draft-${slug}`
  const [files, setFiles] = useState<File[]>([]), [vid, setVid] = useState<File | null>(null), [yt, setYt] = useState('')
  useEffect(() => { try { setText(localStorage.getItem(draft) || '') } catch { /* private mode */ } }, [draft])
  async function send(e: FormEvent) {
    e.preventDefault(); setBusy(true); setFail('')
    try {
      const photos = await Promise.all(files.slice(0, 3).map((f) => shrinkImage(f, 1200, 0.8).then((d) => d.split(',')[1] ?? '')))
      if (vid && vid.size > 8 * 1024 * 1024) throw new Error('This video is over 8 MB. Trim it, or paste a YouTube link instead.')
      const video = vid ? { mime: vid.type || 'video/mp4', data: await fileToB64(vid) } : undefined
      await jcall('write', { slug, name, text, priv, website: trap, photos, video, yt }); setSent(true); try { localStorage.removeItem(draft) } catch { /* ignore */ } reload() }
    catch (x) { setFail(err(x)) } finally { setBusy(false) }
  }
  if (error) return <p className="jr-alert">{error}</p>
  if (!g) return <Spin />
  const ytVid = ytId(g.youtube)
  const form = sent ? <p className="jr-ok"><Check size={16} /> Sent to {g.name.split(' ')[0]}. Thank you.</p> : (
    <form className="jr-form" onSubmit={send}>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" maxLength={40} required />
      <textarea value={text} onChange={(e) => { setText(e.target.value); try { localStorage.setItem(draft, e.target.value) } catch { /* ignore */ } }} placeholder={`Write to ${g.name.split(' ')[0]}…`} maxLength={500} rows={4} />
      <label className="jr-file">Add photos (up to 3)<input type="file" accept="image/*" multiple onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 3))} />{files.length > 0 && <small>{files.length} selected</small>}</label>
      <label className="jr-file">Add a short video (up to 8 MB, about 10 seconds)<input type="file" accept="video/*" onChange={(e) => setVid(e.target.files?.[0] ?? null)} />{vid && <small>{vid.name}</small>}</label>
      <input value={yt} onChange={(e) => setYt(e.target.value)} placeholder="Or paste a YouTube link for a longer video" maxLength={120} />
      <input className="jr-trap" tabIndex={-1} autoComplete="off" value={trap} onChange={(e) => setTrap(e.target.value)} aria-hidden="true" name="website" />
      <label className="jr-check"><input type="checkbox" checked={priv} onChange={(e) => setPriv(e.target.checked)} /> Only {g.name.split(' ')[0]} can read this</label>
      {fail && <p className="jr-alert">{fail}</p>}
      {busy && (files.length > 0 || vid) && <p className="jr-note">Uploading. Keep this page open.</p>}
      <button className="jr-primary" disabled={busy}>{busy ? <LoaderCircle className="jr-spin" size={16} /> : <Send size={15} />} Send</button>
    </form>
  )
  if (write) return (
    <section className="jr-write">
      <div className="jr-who jr-card">
        <div className="jr-photo"><DriveImage id={g.photoId} w={700} alt={g.name} fallback={<span>{g.name[0]}</span>} /></div>
        <div><p className="jr-year">Class of {g.classYear}</p><h1>{g.name}</h1><p>{g.course}</p></div>
      </div>
      <h2>Congratulate {g.name.split(' ')[0]}</h2>{form}<a className="jr-link" href={`#/journey/${slug}`}>See {g.name.split(' ')[0]}&apos;s page</a>
    </section>)
  return (
    <article className="jr-page">
      <div className="jr-road">
        <section className="jr-stop jr-who">
          <div className="jr-photo"><DriveImage id={g.photoId} w={700} alt={g.name} fallback={<span>{g.name[0]}</span>} /></div>
          <div><p className="jr-year">Class of {g.classYear}</p><h1>{g.name}</h1><p>{g.course}</p></div>
        </section>
        {g.story && <section className="jr-stop"><h2>My journey</h2><p className="jr-text">{g.story}</p></section>}
        {g.thanks && <section className="jr-stop"><h2>Thank you</h2><p className="jr-text">{g.thanks}</p></section>}
        {gal && gal.pics.length > 0 && <section className="jr-stop"><h2>Graduation day</h2><Gallery pics={gal.pics} /></section>}
        {ytVid && <section className="jr-stop"><h2>Watch</h2><iframe className="jr-video" src={`https://www.youtube-nocookie.com/embed/${ytVid}?rel=0`} title="Video" allow="encrypted-media; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" /></section>}
        <section className="jr-stop"><h2>Messages</h2>
          {g.wall.length === 0 && <p className="jr-note">No messages yet. Be the first.</p>}
          {g.wall.map((m) => <blockquote key={m.id}>{m.text && <p>{m.text}</p>}<Media m={m} /><footer>{m.name}</footer></blockquote>)}
        </section>
        <section className="jr-stop"><h2>Write to {g.name.split(' ')[0]}</h2>{form}</section>
        {g.gift && <section className="jr-stop"><h2>Send a gift</h2><p>M-Pesa: <strong>{g.gift}</strong> <CopyBtn text={g.gift} /></p></section>}
      </div>
      {h?.gradDate && <p className="jr-foot"><Remind title={`${g.name}'s graduation`} date={h.gradDate} details={`Celebrate ${g.name}: ${pageUrl(slug)}`} label="Remind me of graduation day" /></p>}
    </article>
  )
}

function Account({ user, onSignIn }: { user: User | null; onSignIn: () => void }) {
  const { data: me, error, reload } = useLoad(() => (user ? jcall<Me>('me') : Promise.reject(new Error('Sign in to continue.'))), [user?.uid])
  if (!user) return <section className="jr-hero"><h1>My account</h1><button className="jr-primary" onClick={onSignIn}>Sign in with Google</button></section>
  if (error) return <p className="jr-alert">{error}</p>
  if (!me) return <Spin />
  return <Dashboard me={me} reload={reload} />
}

function Dashboard({ me, reload }: { me: Me; reload: () => void }) {
  const g = me.grad
  const [f, setF] = useState({ name: g?.name ?? '', course: g?.course ?? '', story: g?.story ?? '', thanks: g?.thanks ?? '', youtube: g?.youtube ?? '', gift: g?.gift ?? '' })
  const [photo, setPhoto] = useState(''), [mpesa, setMpesa] = useState(''), [busy, setBusy] = useState(false), [note, setNote] = useState<{ ok: boolean; t: string } | null>(null)
  const [qr, setQr] = useState<{ page: string; write: string }>({ page: '', write: '' })
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })
  const run = async (fn: () => Promise<unknown>, ok: string) => { setBusy(true); setNote(null); try { await fn(); setNote({ ok: true, t: ok }); reload() } catch (x) { setNote({ ok: false, t: err(x) }) } finally { setBusy(false) } }
  useEffect(() => {
    if (g?.status !== 'active') return
    void Promise.all([QRCode.toDataURL(pageUrl(g.slug), { width: 360, margin: 2 }), QRCode.toDataURL(pageUrl(g.slug, true), { width: 360, margin: 2 })]).then(([page, write]) => setQr({ page, write }))
  }, [g?.slug, g?.status])
  const wa = g ? waAdmin(`Hi, I have paid KSh ${me.price} for The Long Campus Journey.\nName: ${g.name}\nCourse: ${g.course}\nReference: ${g.ref}\nM-Pesa code: ${g.mpesa || mpesa}`) : ''
  return (
    <div className="jr-acct">
      <h1>{g ? `Hello, ${g.name.split(' ')[0]}` : 'Open your account'}</h1>
      {me.isAdmin && <a className="jr-primary" href="#/journey/admin">Open admin desk</a>}
      {note && <p className={note.ok ? 'jr-ok' : 'jr-alert'}>{note.t}</p>}
      {g && <p className={`jr-status s-${g.status}`}>{g.status === 'draft' ? 'Draft. Pay to go live.' : g.status === 'pending' ? 'Waiting for the admin to activate.' : g.status === 'active' ? `Live until ${fmt(g.expiresAt)}` : g.status === 'rejected' ? `Not activated: ${g.reason}` : 'Expired. Pay again to renew.'}</p>}
      <form className="jr-form" onSubmit={(e) => { e.preventDefault(); void run(() => jcall('save', { ...f, photo }), 'Saved.') }}>
        <input value={f.name} onChange={set('name')} placeholder="Full name" maxLength={60} required />
        <input value={f.course} onChange={set('course')} placeholder="Course, e.g. BSc Computer Science" maxLength={80} />
        <textarea value={f.story} onChange={set('story')} placeholder="My journey: first day, hard CATs, the friends who made it" rows={5} maxLength={1200} />
        <textarea value={f.thanks} onChange={set('thanks')} placeholder="Thank you to parents, sponsors, friends, lecturers" rows={3} maxLength={600} />
        <input value={f.youtube} onChange={set('youtube')} placeholder="YouTube link (unlisted is fine)" maxLength={120} />
        <input value={f.gift} onChange={set('gift')} placeholder="M-Pesa number for gifts (optional)" maxLength={20} inputMode="tel" />
        <label className="jr-file">Photo <input type="file" accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; if (file) void shrinkImage(file, 900, 0.82).then((d) => setPhoto(d.split(',')[1] ?? '')) }} />{photo && <small>Ready to upload</small>}</label>
        <button className="jr-primary" disabled={busy}>{busy ? <LoaderCircle className="jr-spin" size={16} /> : null} Save page</button>
      </form>

      {g && (g.status === 'draft' || g.status === 'rejected' || g.status === 'expired') && (
        <section className="jr-card"><h2>Activate for one year: KSh {me.price}</h2>
          <ol><li>Send KSh {me.price} on M-Pesa to <strong>{me.payTo}</strong> <CopyBtn text={me.payTo} /></li>
            <li>Use this reference: <strong>{g.ref}</strong> <CopyBtn text={g.ref} /></li>
            <li>Paste the M-Pesa code below, then chat the admin.</li></ol>
          <div className="jr-row"><input value={mpesa} onChange={(e) => setMpesa(e.target.value.toUpperCase())} placeholder="M-Pesa code" maxLength={10} />
            <button className="jr-primary" disabled={busy} onClick={() => void run(() => jcall('pay', { mpesa }).then(() => window.open(waAdmin(`Hi, I have paid KSh ${me.price} for The Long Campus Journey.\nName: ${g.name}\nCourse: ${g.course}\nReference: ${g.ref}\nM-Pesa code: ${mpesa}`), '_blank')), 'Sent. The admin will activate your page.')}><MessageCircle size={15} /> Send and chat admin</button></div>
        </section>)}
      {g?.status === 'pending' && <a className="jr-primary" href={wa} target="_blank" rel="noreferrer noopener"><MessageCircle size={15} /> Chat admin on WhatsApp</a>}

      {g?.status === 'active' && (
        <section className="jr-card"><h2>Your links and QR codes</h2>
          <div className="jr-qrs">
            {[['View my page', qr.page, pageUrl(g.slug)], ['Write me a message', qr.write, pageUrl(g.slug, true)]].map(([t, src, url]) => (
              <figure key={t}>{src && <img src={src} alt={`QR: ${t}`} />}<figcaption>{t}</figcaption><CopyBtn text={url} label="Copy link" />{src && <a className="jr-mini" href={src} download={`${g.slug}-${t.includes('Write') ? 'write' : 'page'}.png`}>Download QR</a>}</figure>))}
          </div>
          <p><Remind title="Open my Long Campus Journey" date={me.gradDate} details={pageUrl(g.slug)} label="Graduation day" /></p>
          <p><Remind title="Memory day: read my Long Campus Journey" date={me.gradDate} details={pageUrl(g.slug)} yearly label="Every year" /></p>
        </section>)}

      {g?.status === 'active' && <GalleryManager slug={g.slug} />}

      {g && me.msgs.length > 0 && (
        <section className="jr-card"><h2>Messages ({me.msgs.length})</h2>
          {me.msgs.map((m) => (
            <blockquote key={m.id}>{m.text && <p>{m.text}</p>}<Media m={m} /><footer>{m.name}{m.priv === 'true' ? ' · private' : ''} · {m.status}</footer>
              <div className="jr-row">{m.status !== 'approved' && m.priv !== 'true' && <button className="jr-mini" onClick={() => void run(() => jcall('msg', { id: m.id, status: 'approved' }), 'Message is now on your wall.')}>Show on wall</button>}
                {m.status === 'approved' && <button className="jr-mini" onClick={() => void run(() => jcall('msg', { id: m.id, status: 'hidden' }), 'Hidden.')}>Hide</button>}
                <button className="jr-mini" onClick={() => void run(() => jcall('msg', { id: m.id, status: 'deleted' }), 'Deleted.')}>Delete</button></div></blockquote>))}
        </section>)}
    </div>
  )
}

function Admin({ user }: { user: User | null }) {
  const { data, error, reload } = useLoad(() => (user ? jcall<{ list: AdminRow[]; classYear: number; gradDate: string; revenue: number }>('adminList') : Promise.reject(new Error('Sign in as admin.'))), [user?.uid])
  const [year, setYear] = useState(''), [date, setDate] = useState(''), [note, setNote] = useState('')
  const act = async (fn: () => Promise<unknown>) => { setNote(''); try { await fn(); reload() } catch (x) { setNote(err(x)) } }
  if (error) return <p className="jr-alert">{error}</p>
  if (!data) return <Spin />
  const rows = (s: string) => data.list.filter((g) => g.status === s)
  return (
    <div className="jr-acct"><h1>Admin desk</h1>{note && <p className="jr-alert">{note}</p>}
      <p className="jr-note">Class of {data.classYear} · {data.list.length} accounts · about KSh {data.revenue} collected</p>
      <section className="jr-card"><h2>Waiting for activation ({rows('pending').length})</h2>
        {rows('pending').map((g) => (
          <div key={g.slug} className="jr-line"><span><strong>{g.name}</strong> · {g.course}<br />Ref {g.ref} · Code <b>{g.mpesa}</b></span>
            <span className="jr-row"><button className="jr-mini" onClick={() => void act(() => jcall('adminDecide', { slug: g.slug, ok: true }))}>Activate</button>
              <button className="jr-mini" onClick={() => { const reason = prompt('Reason (the graduate will see this):', 'Payment not found.'); if (reason !== null) void act(() => jcall('adminDecide', { slug: g.slug, ok: false, reason })) }}>Reject</button></span></div>))}
        {rows('pending').length === 0 && <p className="jr-note">Nothing waiting.</p>}
      </section>
      <section className="jr-card"><h2>Active ({rows('active').length})</h2>{rows('active').map((g) => <div key={g.slug} className="jr-line"><a href={`#/journey/${g.slug}`}>{g.name}</a><small>until {fmt(g.expiresAt)}</small></div>)}</section>
      <section className="jr-card"><h2>Class year and graduation day</h2>
        <p className="jr-note">Changing the year starts a new class. Earlier pages stay live until their one year ends.</p>
        <div className="jr-row"><input value={year} onChange={(e) => setYear(e.target.value)} placeholder={`Class year (now ${data.classYear})`} inputMode="numeric" />
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Graduation date" />
          <button className="jr-primary" onClick={() => void act(() => jcall('adminYear', { classYear: year || data.classYear, gradDate: date || data.gradDate }))}>Save</button></div>
        <p className="jr-note">Graduation date now: {data.gradDate || 'not set'}</p>
      </section>
    </div>
  )
}

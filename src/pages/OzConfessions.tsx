import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Download, ImagePlus, Link2, Lock, MessageCircle, Play, Send, Trash2, Users, X, Zap } from 'lucide-react'
import { ago, cleanPhoto, oz, ozLink, pad, prepVideo, waLink, waShare, type Page, type Post, type Prepared, type Upload } from '../lib/ozone'
import { Err, ReportButton, useLoad, type OzCtx } from './OzCommon'
import { canShareFiles, catGradient, confessionImage, downloadBlob } from '../lib/shareCard'
import './OzConfessions.css'

/* Main Chuka O-Zone WhatsApp group (used when the backend/env has no link set). */
export const OZONE_WA_GROUP = 'https://chat.whatsapp.com/KGwAsXnEJtPBIDMREfDi88'

/* Each category gets its own NGL-style gradient (same colours as the share picture). */
const grad = catGradient

/** 254712345678 -> 0712 345 678 */
const showPhone = (n: string) => { const d = n.replace(/\D/g, '').replace(/^254/, '0'); return d.length === 10 ? `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}` : d || 'the admin' }

/* ------------------------------------------------------------------ */
/* WhatsApp group button (top of every confessions screen)            */
/* ------------------------------------------------------------------ */
function WaTop({ ctx }: { ctx: OzCtx }) {
  const url = ctx.cfg?.whatsappGroupUrl || (import.meta.env.VITE_OZONE_WA_GROUP_URL as string | undefined) || OZONE_WA_GROUP
  if (!url) return null
  return (
    <a className="ng-wa" href={url} target="_blank" rel="noopener noreferrer">
      <span className="ng-wa-ic"><MessageCircle size={22} /></span>
      <span className="ng-wa-t"><strong>Join the O-Zone WhatsApp group</strong><small><Users size={12} /> Campus updates &amp; trending confessions</small></span>
      <span className="ng-wa-go">Join</span>
    </a>
  )
}

/* ------------------------------------------------------------------ */
/* The NGL-style card: header, big prompt box, black Send! button      */
/* ------------------------------------------------------------------ */
function SendCard({ ctx, replyTo, onSent }: { ctx: OzCtx; replyTo?: number; onSent?: () => void }) {
  const { cfg, user, me, signIn, busy: signing } = ctx
  const cats = cfg?.confessionCategories || {}
  const lim = cfg?.limits
  const max = lim?.confessionMax ?? 600
  const [cat, setCat] = useState('other')
  const [text, setText] = useState('')
  const [media, setMedia] = useState<Prepared[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const fee = cfg?.confessionFee ?? 30
  const paidOnly = !!cfg?.confessionPaidOnly
  const activated = !!me?.activated
  const payNo = showPhone(cfg?.payPhone || '')
  const adminNo = cfg?.adminWhatsapp || cfg?.payPhone || '254184198432'
  const [showAct, setShowAct] = useState(paidOnly)
  const [done, setDone] = useState<{ number: number; status: string; paid?: boolean; deleteCode: string; message: string; support: { message: string; lines: string[] } | null; cat: string; text: string } | null>(null)
  const file = useRef<HTMLInputElement>(null)

  async function addFiles(list: FileList | null) {
    if (!list || !lim) return
    setErr('')
    try {
      const out: Prepared[] = []
      for (const f of Array.from(list)) {
        if (media.length + out.length >= lim.maxMedia) throw new Error(`Up to ${lim.maxMedia} photos or videos.`)
        out.push(f.type.startsWith('video/') ? await prepVideo(f, lim.videoBytes) : await cleanPhoto(f, lim.imageBytes))
      }
      setMedia((p) => [...p, ...out])
    } catch (e) { setErr((e as Error).message) }
    if (file.current) file.current.value = ''
  }

  async function send(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setErr('')
    try {
      const uploads: Upload[] = media.map((m) => ({ name: m.name, data: m.data }))
      const r = await oz<NonNullable<typeof done>>('confession_submit', { text, category: cat, replyTo: replyTo || undefined, media: uploads })
      setDone({ ...r, cat, text })
      setText(''); setMedia([])
      onSent?.()
    } catch (x) { setErr((x as Error).message) } finally { setBusy(false) }
  }

  if (done) {
    const live = done.status === 'published'
    return (
      <div className="ng-card ng-done">
        <div className="ng-head" style={{ background: live ? 'linear-gradient(135deg,#25d366,#128c4a)' : 'linear-gradient(135deg,#ffb100,#ff6a00)' }}>
          <span className="ng-av">{live ? '🎉' : '✅'}</span><div><b>{live ? 'Live now!' : 'Sent!'}</b><small>{live ? 'Activated · posted instantly' : 'Waiting for admin review'}</small></div>
        </div>
        <div className="ng-body">
          <p>{done.message}</p>
          <div className="ng-code"><small>Your delete code for #{pad(done.number)}</small><strong>{done.deleteCode}</strong></div>
          {done.support && <div className="ng-support"><b>{done.support.message}</b><ul>{done.support.lines.map((l) => <li key={l}>{l}</li>)}</ul></div>}
          {live && (
            <>
              <button type="button" className="ng-wa-share" onClick={() => void shareCardPicture({ number: done.number, category: done.cat, categoryLabel: cats[done.cat] || '', text: done.text }, ozLink(`thread/${done.number}`), canShareFiles() ? 'share' : 'save')}>
                <MessageCircle size={17} /> Share it on WhatsApp
              </button>
              <a className="ng-send ng-send-soft" href={`#/ozone/thread/${done.number}`}>See it live</a>
            </>
          )}
          <button type="button" className="ng-send" onClick={() => setDone(null)}>Send another</button>
        </div>
      </div>
    )
  }

  const blocked = me?.banned ? 'Your account cannot post.' : me && me.studentOk === false ? 'Use your student email to post.' : ''

  return (
    <form className="ng-card" onSubmit={send}>
      <div className="ng-head" style={{ background: grad(cat) }}>
        <span className="ng-av"><img src={`${import.meta.env.BASE_URL}ozone.jfif`} alt="" /></span>
        <div><b>{replyTo ? `reply to #${pad(replyTo)}` : '@chuka.ozone'}</b><small>{replyTo ? 'anonymous reply' : 'send your confession!'}</small></div>
      </div>
      <div className="ng-body">
        <div className="ng-cats" role="radiogroup" aria-label="Category">
          {Object.entries(cats).map(([k, l]) => (
            <button key={k} type="button" role="radio" aria-checked={cat === k} className={cat === k ? 'on' : ''} style={cat === k ? { background: grad(k) } : undefined} onClick={() => setCat(k)}>{l}</button>
          ))}
        </div>
        {activated ? (
          <p className="ng-active"><Zap size={14} /> Account activated · post whatever you like, it goes live instantly</p>
        ) : (
          <div className="ng-mode" role="radiogroup" aria-label="Posting option">
            {!paidOnly && <button type="button" role="radio" aria-checked={!showAct} className={!showAct ? 'on' : ''} onClick={() => setShowAct(false)}>Free<small>admin reviews first</small></button>}
            <button type="button" role="radio" aria-checked={showAct} className={showAct ? 'on pay' : 'pay'} onClick={() => setShowAct(true)}><Zap size={14} /> Activate<small>KSh {fee} once · post freely</small></button>
          </div>
        )}
        <textarea
          className="ng-text" value={text} maxLength={max} rows={5} required
          placeholder={replyTo ? 'say it anonymously…' : 'tell me your confession…'}
          onChange={(e) => setText(e.target.value)} aria-label="Your confession"
        />
        {splitVideos(text).videos.length > 0 && <p className="ng-vidhint">🎬 Video link found. It will play as a video once approved.</p>}
        <div className="ng-meta">
          <span>{text.length}/{max}</span>
          <button type="button" className="ng-attach" onClick={() => file.current?.click()}><ImagePlus size={15} /> Photo / video</button>
          <input ref={file} type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" multiple hidden onChange={(e) => void addFiles(e.target.files)} />
        </div>
        {media.length > 0 && (
          <div className="ng-thumbs">
            {media.map((m, i) => (
              <span key={i}>{m.preview ? <img src={m.preview} alt="" /> : <em>🎬</em>}<button type="button" aria-label="Remove" onClick={() => setMedia((p) => p.filter((_, j) => j !== i))}><X size={12} /></button></span>
            ))}
          </div>
        )}
        {!activated && showAct && (
          <div className="ng-pay">
            <p><b>One-time KSh {fee} activation.</b> Pay once, then post whenever and however you want. No code per post.</p>
            <p><b>1.</b> Send <strong>KSh {fee}</strong> by M-Pesa to <strong>{payNo}</strong></p>
            <p><b>2.</b> Chat the admin on WhatsApp with your M-Pesa code and the email you sign in with. You get activated right after.</p>
            <a className="ng-wa-share" target="_blank" rel="noopener noreferrer"
              href={waLink(adminNo, `Hi admin, I paid KSh ${fee} to ${payNo} for Chuka O-Zone activation. M-Pesa code: ____ . My sign-in email: ${user?.email || '____'}`)}>
              <MessageCircle size={17} /> Chat admin on WhatsApp · {payNo}
            </a>
            <small>Activated accounts go live the moment they send. Photos or videos, and anything sensitive (phone numbers, self-harm, etc.), are still checked by the admin first.</small>
          </div>
        )}
        <p className="ng-safe"><Lock size={13} /> anonymous · {activated ? 'goes live instantly' : 'reviewed by admin before it goes live'}</p>
        <Err msg={err || blocked} />
        {user ? (
          <button type="submit" className="ng-send" disabled={busy || !!blocked || text.trim().length < 10 || (paidOnly && !activated)}>{busy ? 'Sending…' : activated ? <>Post instantly <Zap size={16} /></> : <>Send! <Send size={16} /></>}</button>
        ) : (
          <button type="button" className="ng-send" disabled={signing} onClick={signIn}>Sign in with Google to send</button>
        )}
        <small className="ng-hint">Minimum 10 characters{activated ? '' : ` · ${lim?.confessionPerDay ?? 3} free per day`} · paste a YouTube, TikTok, Instagram, Facebook or Vimeo link to share a long video</small>
      </div>
    </form>
  )
}


/* ------------------------------------------------------------------ */
/* Video links: a pasted YouTube / TikTok / Vimeo / Instagram / Facebook */
/* / .mp4 link is shown as a video player instead of a bare link.      */
/* ------------------------------------------------------------------ */
type Vid = { src: string; label: string; thumb: string; vertical: boolean; file: boolean; url: string }
const URL_RE = /https?:\/\/[^\s<>"']+/gi

function videoFromUrl(raw: string): Vid | null {
  const url = raw.replace(/[.,!?;:)\]]+$/, '')
  let u: URL
  try { u = new URL(url) } catch { return null }
  const host = u.hostname.replace(/^(www|m|mobile|web)\./, '')
  const path = u.pathname
  if (/\.(mp4|webm)$/i.test(path)) return { src: url, label: 'Video', thumb: '', vertical: false, file: true, url }
  if (host === 'youtu.be' || host === 'youtube.com' || host === 'music.youtube.com') {
    const id = host === 'youtu.be' ? path.slice(1, 12) : u.searchParams.get('v') || /^\/(?:shorts|live|embed)\/([\w-]{11})/.exec(path)?.[1] || ''
    if (!/^[\w-]{11}$/.test(id)) return null
    return { src: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1`, label: 'YouTube', thumb: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`, vertical: path.startsWith('/shorts/'), file: false, url }
  }
  if (host === 'tiktok.com') {
    const id = /\/video\/(\d{8,25})/.exec(path)?.[1]
    if (!id) return null
    return { src: `https://www.tiktok.com/player/v1/${id}?autoplay=1&loop=0`, label: 'TikTok', thumb: '', vertical: true, file: false, url }
  }
  if (host === 'vimeo.com') {
    const id = /^\/(\d{5,12})/.exec(path)?.[1]
    return id ? { src: `https://player.vimeo.com/video/${id}?autoplay=1`, label: 'Vimeo', thumb: '', vertical: false, file: false, url } : null
  }
  if (host === 'instagram.com') {
    const m = /^\/(reel|reels|p|tv)\/([\w-]+)/.exec(path)
    return m ? { src: `https://www.instagram.com/${m[1] === 'reels' ? 'reel' : m[1]}/${m[2]}/embed`, label: 'Instagram', thumb: '', vertical: true, file: false, url } : null
  }
  if (host === 'facebook.com' || host === 'fb.watch') {
    if (host === 'facebook.com' && !/(\/videos?\/|\/reel\/|\/watch)/.test(path)) return null
    return { src: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false&autoplay=1`, label: 'Facebook', thumb: '', vertical: false, file: false, url }
  }
  return null
}

/** Splits a confession into its words and any video links (max 2). */
export function splitVideos(text: string): { body: string; videos: Vid[] } {
  const videos: Vid[] = []
  const body = text.replace(URL_RE, (m) => {
    const v = videos.length < 2 ? videoFromUrl(m) : null
    if (!v || videos.some((x) => x.src === v.src)) return m
    videos.push(v)
    return ''
  }).replace(/ {2,}/g, ' ').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
  return { body, videos }
}

function VideoEmbed({ v }: { v: Vid }) {
  const [on, setOn] = useState(false)
  const [bad, setBad] = useState(false)
  return (
    <div className={`ng-vid${v.vertical ? ' v' : ''}`}>
      {v.file ? <video src={v.src} controls playsInline preload="metadata" />
        : on ? <iframe title={`${v.label} video`} src={v.src} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
        : (
          <button type="button" className="ng-vid-go" onClick={() => setOn(true)} aria-label={`Play ${v.label} video`}>
            {v.thumb && !bad && <img src={v.thumb} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBad(true)} />}
            <span className="ng-vid-play"><Play size={26} fill="currentColor" /></span>
            <span className="ng-vid-tag">{v.label}</span>
          </button>
        )}
      {!v.file && <a className="ng-vid-open" href={v.url} target="_blank" rel="noopener noreferrer">Open on {v.label} ↗</a>}
    </div>
  )
}


/** NGL-style share: the whole confession card goes out as a picture. */
async function shareCardPicture(p: { number: number; category: string; categoryLabel: string; text: string }, link: string, mode: 'share' | 'save') {
  const { body, videos } = splitVideos(p.text)
  const site = window.location.host
  const blob = await confessionImage(p, body || (videos.length ? '' : p.text), site)
  const name = `chuka-ozone-confession-${String(p.number).padStart(4, '0')}.png`
  if (mode === 'save') { downloadBlob(blob, name); return 'saved' as const }
  const file = new File([blob], name, { type: 'image/png' })
  try {
    await navigator.share({ files: [file], text: `Confession #${String(p.number).padStart(4, '0')} on Chuka O-Zone 👀\n${link}` })
    return 'shared' as const
  } catch (e) {
    if ((e as Error).name === 'AbortError') return 'cancelled' as const
    downloadBlob(blob, name)
    return 'saved' as const
  }
}

/* ------------------------------------------------------------------ */
/* Feed bubble                                                         */
/* ------------------------------------------------------------------ */
function Bubble({ p, ctx, full, onDeleted }: { p: Post; ctx: OzCtx; full?: boolean; onDeleted?: (n: number) => void }) {
  const { body, videos } = splitVideos(p.text)
  const link = ozLink(`thread/${p.number}`)
  const snippet = p.text.length > 300 ? `${p.text.slice(0, 299)}…` : p.text
  const [copied, setCopied] = useState(false)
  const [err, setErr] = useState('')
  const [gone, setGone] = useState(false)
  const [making, setMaking] = useState(false)

  async function picture(mode: 'share' | 'save') {
    setMaking(true); setErr('')
    try { await shareCardPicture(p, link, mode) } catch (e) { setErr((e as Error).message) } finally { setMaking(false) }
  }

  async function remove() {
    if (!window.confirm(`Delete confession #${pad(p.number)} for everyone? This cannot be undone.`)) return
    try { await oz('admin_confession_delete', { number: p.number }); setGone(true); onDeleted?.(p.number) }
    catch (e) { setErr((e as Error).message) }
  }
  if (gone) return <article className="ng-post ng-gone"><p>Confession #{pad(p.number)} deleted.</p></article>

  return (
    <article className="ng-post">
      <header style={{ background: grad(p.category) }}>
        <span>{p.categoryLabel || '🤫 Confession'}</span>
        <small>#{pad(p.number)} · {ago(p.publishedAt)}</small>
      </header>
      <div className="ng-post-body">
        {body && <p>{body}</p>}
        {videos.map((v) => <VideoEmbed key={v.src} v={v} />)}
        {p.media.length > 0 && (
          <div className="ng-media">
            {p.media.map((m, i) => m.type === 'video'
              ? <video key={i} src={m.url} poster={m.thumb} controls preload="none" playsInline />
              : <img key={i} src={m.url} alt="" loading="lazy" referrerPolicy="no-referrer" />)}
          </div>
        )}
        <a
          className="ng-wa-share" href={waShare(`Confession #${pad(p.number)} on Chuka O-Zone:\n\n${snippet}\n\n${link}`)} target="_blank" rel="noopener noreferrer"
          aria-busy={making}
          onClick={(e) => { if (!canShareFiles()) return; e.preventDefault(); void picture('share') }}
        >
          <MessageCircle size={17} /> {making ? 'Making picture…' : 'Share on WhatsApp'}
        </a>
        <footer>
          {!full && <a href={`#/ozone/thread/${p.number}`}><MessageCircle size={14} /> {p.replies > 0 ? `${p.replies} repl${p.replies === 1 ? 'y' : 'ies'}` : 'Reply'}</a>}
          <button type="button" className="ng-ghost" disabled={making} onClick={() => void picture('save')}><Download size={14} /> Save picture</button>
          <button type="button" className="ng-ghost" onClick={() => { void navigator.clipboard?.writeText(link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) }) }}>
            <Link2 size={14} /> {copied ? 'Copied' : 'Copy link'}
          </button>
          <ReportButton ctx={ctx} kind="confession" refId={String(p.number)} />
          {ctx.me?.isAdmin && <button type="button" className="ng-ghost ng-danger" onClick={() => void remove()}><Trash2 size={14} /> Delete</button>}
        </footer>
        <Err msg={err} />
      </div>
    </article>
  )
}

/* ------------------------------------------------------------------ */
/* Screens used by Ozone.tsx                                           */
/* ------------------------------------------------------------------ */
export function Feed({ ctx }: { ctx: OzCtx }) {
  const cats = ctx.cfg?.confessionCategories || {}
  const [cat, setCat] = useState('')
  const [items, setItems] = useState<Post[]>([])
  const [next, setNext] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  const load = useCallback(async (before?: number) => {
    setLoading(true)
    try {
      const r = await oz<Page<Post>>('feed', { category: cat || undefined, before })
      setItems((p) => (before ? [...p, ...r.items.filter((n) => !p.some((x) => x.number === n.number))] : r.items))
      setNext(r.nextBefore); setErr('')
    } catch (e) { setErr((e as Error).message) } finally { setLoading(false) }
  }, [cat])
  useEffect(() => { setItems([]); void load() }, [load])

  return (
    <div className="ng-wrap">
      <WaTop ctx={ctx} />
      <SendCard ctx={ctx} />

      <h3 className="ng-sec">👇 see what comrades confessed</h3>
      <div className="ng-chips" role="tablist" aria-label="Filter">
        <button type="button" className={cat === '' ? 'on' : ''} onClick={() => setCat('')}>All</button>
        {Object.entries(cats).map(([k, l]) => <button key={k} type="button" className={cat === k ? 'on' : ''} onClick={() => setCat(k)}>{l}</button>)}
      </div>

      <Err msg={err} />
      <div className="ng-list">{items.map((p) => <Bubble key={p.number} p={p} ctx={ctx} onDeleted={(n) => setItems((prev) => prev.filter((x) => x.number !== n))} />)}</div>
      {loading && <p className="ng-empty">Loading…</p>}
      {!loading && !err && items.length === 0 && <p className="ng-empty">Nothing here yet. Be the first to confess 👆</p>}
      {next !== null && !loading && <button type="button" className="ng-more" onClick={() => void load(next)}>Load more</button>}

      <DeleteBox />
    </div>
  )
}

export function Compose({ ctx, replyTo }: { ctx: OzCtx; replyTo?: string }) {
  const n = parseInt(replyTo || '', 10) || undefined
  return (
    <div className="ng-wrap">
      <WaTop ctx={ctx} />
      <SendCard ctx={ctx} replyTo={n} />
      <a className="ng-back" href={n ? `#/ozone/thread/${n}` : '#/ozone/confessions'}>← Back to confessions</a>
    </div>
  )
}

export function Thread({ ctx, number }: { ctx: OzCtx; number: string }) {
  const { data, err, loading } = useLoad(() => oz<{ post: Post; replies: Post[] }>('thread', { number }), [number])
  return (
    <div className="ng-wrap">
      <WaTop ctx={ctx} />
      <Err msg={err} />
      {loading && <p className="ng-empty">Loading…</p>}
      {data && (
        <>
          <Bubble p={data.post} ctx={ctx} full />
          <h3 className="ng-sec">💬 {data.replies.length} {data.replies.length === 1 ? 'reply' : 'replies'}</h3>
          <div className="ng-list ng-replies">{data.replies.map((r) => <Bubble key={r.number} p={r} ctx={ctx} full />)}</div>
          <h3 className="ng-sec">Reply anonymously</h3>
          <SendCard ctx={ctx} replyTo={data.post.number} />
        </>
      )}
      <a className="ng-back" href="#/ozone/confessions">← Back to confessions</a>
    </div>
  )
}

/* Delete with the code shown after posting. */
function DeleteBox() {
  const [open, setOpen] = useState(false)
  const [num, setNum] = useState('')
  const [code, setCode] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  async function del(e: FormEvent) {
    e.preventDefault(); setErr(''); setMsg('')
    try { await oz('confession_delete', { number: num.replace(/\D/g, ''), code }); setMsg('Deleted.'); setNum(''); setCode('') }
    catch (x) { setErr((x as Error).message) }
  }
  return (
    <div className="ng-del">
      <button type="button" onClick={() => setOpen((o) => !o)}><Trash2 size={13} /> Delete my confession</button>
      {open && (
        <form onSubmit={del}>
          <input value={num} onChange={(e) => setNum(e.target.value)} placeholder="Number e.g. 0012" inputMode="numeric" required />
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Delete code" autoCapitalize="characters" required />
          <button type="submit">Delete</button>
          <Err msg={err} />{msg && <p className="ng-ok">{msg}</p>}
        </form>
      )}
    </div>
  )
}

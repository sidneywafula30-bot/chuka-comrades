import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { ImagePlus, Lock, MessageCircle, Send, Trash2, Users, X } from 'lucide-react'
import { ago, cleanPhoto, oz, pad, prepVideo, type Page, type Post, type Prepared, type Upload } from '../lib/ozone'
import { Err, ReportButton, ShareButton, useLoad, type OzCtx } from './OzCommon'
import './OzConfessions.css'

/* Main Chuka O-Zone WhatsApp group (used when the backend/env has no link set). */
export const OZONE_WA_GROUP = 'https://chat.whatsapp.com/KGwAsXnEJtPBIDMREfDi88'

/* Each category gets its own NGL-style gradient. */
const GRAD: Record<string, string> = {
  spicy: 'linear-gradient(135deg,#ff5a3c,#ff2d75)',
  heartbreak: 'linear-gradient(135deg,#ff2d75,#a62bd6)',
  academics: 'linear-gradient(135deg,#3b82f6,#6d4aff)',
  funny: 'linear-gradient(135deg,#ffb100,#ff6a00)',
  deep: 'linear-gradient(135deg,#6d4aff,#2b1b8a)',
  other: 'linear-gradient(135deg,#2dd4bf,#3b82f6)',
}
const grad = (c: string) => GRAD[c] || GRAD.other

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
  const [done, setDone] = useState<{ number: number; deleteCode: string; message: string; support: { message: string; lines: string[] } | null } | null>(null)
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
      setDone(await oz('confession_submit', { text, category: cat, replyTo: replyTo || undefined, media: uploads }))
      setText(''); setMedia([])
      onSent?.()
    } catch (x) { setErr((x as Error).message) } finally { setBusy(false) }
  }

  if (done) {
    return (
      <div className="ng-card ng-done">
        <div className="ng-head" style={{ background: 'linear-gradient(135deg,#25d366,#128c4a)' }}><span className="ng-av">✅</span><div><b>Sent!</b><small>Waiting for admin review</small></div></div>
        <div className="ng-body">
          <p>{done.message}</p>
          <div className="ng-code"><small>Your delete code for #{pad(done.number)}</small><strong>{done.deleteCode}</strong></div>
          {done.support && <div className="ng-support"><b>{done.support.message}</b><ul>{done.support.lines.map((l) => <li key={l}>{l}</li>)}</ul></div>}
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
        <textarea
          className="ng-text" value={text} maxLength={max} rows={5} required
          placeholder={replyTo ? 'say it anonymously…' : 'tell me your confession…'}
          onChange={(e) => setText(e.target.value)} aria-label="Your confession"
        />
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
        <p className="ng-safe"><Lock size={13} /> anonymous · reviewed by admin before it goes live</p>
        <Err msg={err || blocked} />
        {user ? (
          <button type="submit" className="ng-send" disabled={busy || !!blocked || text.trim().length < 10}>{busy ? 'Sending…' : <>Send! <Send size={16} /></>}</button>
        ) : (
          <button type="button" className="ng-send" disabled={signing} onClick={signIn}>Sign in with Google to send</button>
        )}
        <small className="ng-hint">Minimum 10 characters · {lim?.confessionPerDay ?? 3} per day</small>
      </div>
    </form>
  )
}

/* ------------------------------------------------------------------ */
/* Feed bubble                                                         */
/* ------------------------------------------------------------------ */
function Bubble({ p, ctx, full }: { p: Post; ctx: OzCtx; full?: boolean }) {
  return (
    <article className="ng-post">
      <header style={{ background: grad(p.category) }}>
        <span>{p.categoryLabel || '🤫 Confession'}</span>
        <small>#{pad(p.number)} · {ago(p.publishedAt)}</small>
      </header>
      <div className="ng-post-body">
        <p>{p.text}</p>
        {p.media.length > 0 && (
          <div className="ng-media">
            {p.media.map((m, i) => m.type === 'video'
              ? <video key={i} src={m.url} poster={m.thumb} controls preload="none" playsInline />
              : <img key={i} src={m.url} alt="" loading="lazy" referrerPolicy="no-referrer" />)}
          </div>
        )}
        <footer>
          {!full && <a href={`#/ozone/thread/${p.number}`}><MessageCircle size={14} /> {p.replies > 0 ? `${p.replies} repl${p.replies === 1 ? 'y' : 'ies'}` : 'Reply'}</a>}
          <ShareButton text={`Confession #${pad(p.number)} on Chuka O-Zone:\n\n${p.text.length > 180 ? `${p.text.slice(0, 179)}…` : p.text}`} path={`thread/${p.number}`} />
          <ReportButton ctx={ctx} kind="confession" refId={String(p.number)} />
        </footer>
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
      <div className="ng-list">{items.map((p) => <Bubble key={p.number} p={p} ctx={ctx} />)}</div>
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

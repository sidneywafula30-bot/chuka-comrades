import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { CornerDownRight, MessageCircle, PenLine, Trash2 } from 'lucide-react'
import { ago, oz, pad, snip, type Page, type Post, type Upload } from '../lib/ozone'
import { CopyButton, Err, Gate, MediaPicker, MediaView, ReportButton, ShareButton, SupportBox, useLoad, type OzCtx } from './OzCommon'
import type { Support } from '../lib/ozone'

function PostCard({ ctx, p, thread }: { ctx: OzCtx; p: Post; thread?: boolean }) {
  return (
    <article className="cpl-card oz-post">
      <header>
        <strong>#{pad(p.number)}</strong>
        <span className="oz-pill">{p.categoryLabel}</span>
        <small>{ago(p.publishedAt)}</small>
      </header>
      {p.replyTo && <a className="oz-replyto" href={`#/ozone/thread/${p.replyTo}`}><CornerDownRight size={13} /> Reply to #{pad(p.replyTo)}</a>}
      <p className="oz-text">{p.text}</p>
      <MediaView media={p.media} />
      <footer>
        {!thread && <a className="oz-ghost" href={`#/ozone/thread/${p.number}`}><MessageCircle size={14} /> {p.replies ? `${p.replies} repl${p.replies === 1 ? 'y' : 'ies'}` : 'Open'}</a>}
        <a className="oz-ghost" href={`#/ozone/confess/${p.number}`}><CornerDownRight size={14} /> Reply anonymously</a>
        <ShareButton text={`Confession #${pad(p.number)} on Chuka O-Zone (${p.categoryLabel}): “${snip(p.text)}”`} path={`thread/${p.number}`} />
        <ReportButton ctx={ctx} kind="confession" refId={p.number} />
      </footer>
    </article>
  )
}

export function Feed({ ctx }: { ctx: OzCtx }) {
  const [cat, setCat] = useState('')
  const [items, setItems] = useState<Post[]>([])
  const [next, setNext] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  const load = useCallback(async (before?: number) => {
    setLoading(true); setErr('')
    try {
      const r = await oz<Page<Post>>('feed', { category: cat || undefined, before })
      setItems((cur) => (before ? [...cur, ...r.items] : r.items)); setNext(r.nextBefore)
    } catch (e) { setErr((e as Error).message) }
    finally { setLoading(false) }
  }, [cat])
  useEffect(() => { void load() }, [load])

  const cats = ctx.cfg?.confessionCategories ?? {}
  return (
    <div className="oz-wrap">
      <div className="oz-title">
        <div><h2>Confessions</h2><p className="cpl-sub">Anonymous. Posted only after the admin approves.</p></div>
        <a className="lp-btn" href="#/ozone/confess"><PenLine size={15} /> Confess</a>
      </div>
      <div className="cpl-chips oz-left" role="group" aria-label="Category">
        <button type="button" className={!cat ? 'on' : ''} onClick={() => setCat('')}>All</button>
        {Object.entries(cats).map(([k, v]) => <button key={k} type="button" className={cat === k ? 'on' : ''} onClick={() => setCat(k)}>{v}</button>)}
      </div>
      <Err msg={err} />
      <div className="oz-list">
        {items.map((p) => <PostCard key={p.number} ctx={ctx} p={p} />)}
        {!loading && !items.length && !err && <p className="cpl-empty">Nothing here yet. Be the first to confess.</p>}
      </div>
      {loading && <p className="cpl-empty">Loading…</p>}
      {!loading && next !== null && <button type="button" className="lp-btn lp-btn-soft oz-more" onClick={() => void load(next)}>Load more</button>}
      <DeleteBox />
    </div>
  )
}

export function Thread({ ctx, number }: { ctx: OzCtx; number: string }) {
  const { data, err, loading } = useLoad(() => oz<{ post: Post; replies: Post[] }>('thread', { number: Number(number) }), [number])
  return (
    <div className="oz-wrap">
      <a className="cpl-back" href="#/ozone/confessions">← All confessions</a>
      <Err msg={err} />
      {loading && <p className="cpl-empty">Loading…</p>}
      {data && (
        <>
          <PostCard ctx={ctx} p={data.post} thread />
          <h3 className="cpl-h3">{data.replies.length} repl{data.replies.length === 1 ? 'y' : 'ies'}</h3>
          <div className="oz-list">{data.replies.map((r) => <PostCard key={r.number} ctx={ctx} p={r} thread />)}</div>
        </>
      )}
    </div>
  )
}

export function Compose({ ctx, replyTo }: { ctx: OzCtx; replyTo: string }) {
  const cfg = ctx.cfg!
  const [text, setText] = useState('')
  const [cat, setCat] = useState('other')
  const [media, setMedia] = useState<Upload[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [done, setDone] = useState<{ number: number; deleteCode: string; message: string; support: Support | null } | null>(null)
  const [saved, setSaved] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setErr('')
    try {
      setDone(await oz('confession_submit', { text, category: cat, replyTo: replyTo ? Number(replyTo) : undefined, media: media.length ? media : undefined }))
    } catch (x) { setErr((x as Error).message) }
    finally { setBusy(false) }
  }

  if (done) {
    return (
      <div className="oz-wrap">
        <div className="cpl-card oz-done">
          <h3>Received, #{pad(done.number)}</h3>
          <p>{done.message}</p>
          <div className="oz-code">
            <span>Your delete code</span>
            <strong>{done.deleteCode}</strong>
            <CopyButton text={`Confession #${done.number} delete code: ${done.deleteCode}`} />
          </div>
          <label className="cpl-file"><input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} /> I have saved my code. It is shown only once.</label>
          <SupportBox support={done.support} />
          <div className="ef-actions">
            <a className="lp-btn" href="#/ozone/confessions" aria-disabled={!saved} onClick={(e) => { if (!saved) e.preventDefault() }} style={{ opacity: saved ? 1 : .5 }}>Back to confessions</a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="oz-wrap">
      <a className="cpl-back" href="#/ozone/confessions">← All confessions</a>
      <h2>{replyTo ? `Reply to #${pad(Number(replyTo))}` : 'Confess anonymously'}</h2>
      <p className="cpl-sub">Nobody sees who you are, not even the admin. Do not name people, share phone numbers or registration numbers.</p>
      <Gate ctx={ctx} what="post a confession">
        <form className="cpl-card cpl-form oz-form" onSubmit={submit}>
          <label>Your confession
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} maxLength={cfg.limits.confessionMax} required minLength={10} />
            <small>{text.length}/{cfg.limits.confessionMax} · up to {cfg.limits.confessionPerDay} a day</small>
          </label>
          {!replyTo && (
            <label>Category
              <select value={cat} onChange={(e) => setCat(e.target.value)}>
                {Object.entries(cfg.confessionCategories).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
          )}
          <div><span className="oz-lbl">Photo or video (optional)</span><MediaPicker cfg={cfg} allowVideo onChange={setMedia} /></div>
          <small>Photos have their location data removed here before they are sent. Videos: MP4 or WEBM, under 30 seconds.</small>
          <Err msg={err} />
          <button className="lp-btn" disabled={busy || text.trim().length < 10}>{busy ? 'Sending…' : 'Send for review'}</button>
        </form>
      </Gate>
    </div>
  )
}

/** Delete with the code shown after posting. Works from any phone and needs no sign-in. */
function DeleteBox() {
  const [open, setOpen] = useState(false)
  const [num, setNum] = useState('')
  const [code, setCode] = useState('')
  const [msg, setMsg] = useState('')
  const [bad, setBad] = useState(false)
  async function del(e: FormEvent) {
    e.preventDefault()
    try { await oz('confession_delete', { number: Number(num.replace(/\D/g, '')), code }); setMsg('Deleted.'); setBad(false) }
    catch (x) { setMsg((x as Error).message); setBad(true) }
  }
  if (!open) return <p className="cpl-note"><button type="button" className="cpl-linkbtn" onClick={() => setOpen(true)}><Trash2 size={12} /> Delete one of my confessions</button></p>
  return (
    <form className="cpl-card cpl-form oz-form" onSubmit={del}>
      <h3>Delete my confession</h3>
      <div className="cpl-grid2">
        <label>Number<input type="text" inputMode="numeric" value={num} onChange={(e) => setNum(e.target.value)} placeholder="e.g. 42" required /></label>
        <label>Delete code<input type="text" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} required /></label>
      </div>
      {msg && <p className={`cpl-msg${bad ? ' bad' : ''}`} role="status">{msg}</p>}
      <button className="lp-btn cpl-danger">Delete</button>
    </form>
  )
}

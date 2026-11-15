import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import type { User } from 'firebase/auth'
import { Camera, Flag, Link2, LifeBuoy, MessageCircle, Video, X } from 'lucide-react'
import GoogleSignInButton from '../components/GoogleSignInButton'
import { cleanPhoto, driveIdFrom, oz, ozLink, prepVideo, waShare, type Config, type Me, type Media, type Prepared, type Support, type Upload } from '../lib/ozone'

export type OzCtx = {
  user: User | null; me: Me | null; cfg: Config | null; busy: boolean
  signIn: () => Promise<void>; reload: () => Promise<void>
}

/** Shows `children` once signed in (and not banned); otherwise a sign-in prompt. */
export function Gate({ ctx, what, children }: { ctx: OzCtx; what: string; children: ReactNode }) {
  if (!ctx.user) {
    return (
      <div className="cpl-card oz-gate">
        <p>Sign in with Google to {what}.</p>
        <GoogleSignInButton onClick={ctx.signIn} disabled={ctx.busy} />
        {ctx.cfg?.studentEmailRequired && <small>Use your university e-mail.</small>}
      </div>
    )
  }
  if (!ctx.me) return <p className="cpl-empty">Checking your account…</p>
  if (ctx.me.banned) return <p className="cpl-err" role="alert">This account has been blocked from posting.</p>
  if (ctx.me.studentOk === false) return <p className="cpl-err" role="alert">Please sign in with your university e-mail to {what}.</p>
  return <>{children}</>
}

export function SupportBox({ support }: { support: Support | null | undefined }) {
  if (!support) return null
  return (
    <div className="oz-support" role="note">
      <LifeBuoy size={18} />
      <div>
        <strong>{support.message}</strong>
        <ul>{support.lines.map((l) => <li key={l}>{l}</li>)}</ul>
      </div>
    </div>
  )
}

export function MediaView({ media }: { media: Media[] }) {
  const [zoom, setZoom] = useState('')
  if (!media.length) return null
  return (
    <>
      <div className={`oz-media n${Math.min(media.length, 3)}`}>
        {media.map((m, i) => m.type === 'video'
          ? <iframe key={i} title="Video" src={m.url} allow="autoplay" allowFullScreen loading="lazy" />
          : <button key={i} type="button" onClick={() => setZoom(m.url)} aria-label="Open photo"><img src={m.thumb} alt="" loading="lazy" /></button>)}
      </div>
      {zoom && (
        <div className="ef-zoom" onClick={() => setZoom('')} role="dialog" aria-label="Photo">
          <img src={zoom} alt="" />
        </div>
      )}
    </>
  )
}

/** Up to N photos, or one short video. Photos are re-drawn as clean JPEGs (no GPS data) before upload. */
export function MediaPicker({ cfg, allowVideo, onChange, label = 'Add photo' }: {
  cfg: Config; allowVideo: boolean; label?: string; onChange: (u: Upload[]) => void
}) {
  const [items, setItems] = useState<(Prepared & { kind: 'image' | 'video' })[]>([])
  const [err, setErr] = useState('')
  const [work, setWork] = useState(false)
  const push = (next: typeof items) => { setItems(next); onChange(next.map(({ name, data }) => ({ name, data }))) }
  const hasVideo = items.some((i) => i.kind === 'video')

  async function pick(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (!files.length) return
    setErr(''); setWork(true)
    try {
      let next = items.slice()
      for (const f of files) {
        if (f.type.startsWith('video/')) {
          if (!allowVideo) throw new Error('Videos are not allowed here.')
          if (next.length) throw new Error('Add a video on its own, with no photos.')
          const v = await prepVideo(f, cfg.limits.videoBytes)
          next = [{ ...v, kind: 'video' }]
        } else {
          if (hasVideo || next.some((i) => i.kind === 'video')) throw new Error('Remove the video first to add photos.')
          if (next.length >= cfg.limits.maxMedia) throw new Error(`At most ${cfg.limits.maxMedia} photos.`)
          next.push({ ...(await cleanPhoto(f, cfg.limits.imageBytes)), kind: 'image' })
        }
      }
      push(next)
    } catch (x) { setErr((x as Error).message) }
    finally { setWork(false) }
  }

  const full = hasVideo || items.length >= cfg.limits.maxMedia
  return (
    <div className="oz-picker">
      <div className="oz-thumbs">
        {items.map((it, i) => (
          <span key={i} className="oz-thumb">
            {it.kind === 'image' ? <img src={it.preview} alt="" /> : <span className="oz-vid"><Video size={22} /><small>{it.name}</small></span>}
            <button type="button" aria-label="Remove" onClick={() => push(items.filter((_, j) => j !== i))}><X size={13} /></button>
          </span>
        ))}
      </div>
      {!full && (
        <label className="cpl-upload">
          <Camera size={15} /> {work ? 'Preparing…' : label}{allowVideo ? ' or video' : ''}
          <input type="file" hidden multiple={!hasVideo} onChange={pick}
            accept={allowVideo ? 'image/png,image/jpeg,image/webp,video/mp4,video/webm' : 'image/png,image/jpeg,image/webp'} />
        </label>
      )}
      {err && <small className="cpl-msg bad" role="alert">{err}</small>}
    </div>
  )
}

/** A small "Report" control: asks for a reason, then tells the admin. */
export function ReportButton({ ctx, kind, refId }: { ctx: OzCtx; kind: 'confession' | 'issue' | 'profile' | 'aspirant'; refId: string | number }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle')
  const [err, setErr] = useState('')
  if (state === 'done') return <small className="cpl-msg">Thanks, the admin will look at it.</small>
  if (!open) {
    return <button type="button" className="oz-ghost" onClick={() => (ctx.user ? setOpen(true) : void ctx.signIn())}><Flag size={13} /> Report</button>
  }
  async function send() {
    setState('busy'); setErr('')
    try { await oz('report', { kind, ref: String(refId), reason }); setState('done') }
    catch (x) { setErr((x as Error).message); setState('idle') }
  }
  return (
    <span className="oz-report">
      <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder="What is wrong with it?" aria-label="Reason" autoFocus />
      <button type="button" className="lp-btn" disabled={state === 'busy' || reason.trim().length < 3} onClick={send}>Send</button>
      <button type="button" className="oz-ghost" onClick={() => setOpen(false)}>Cancel</button>
      {err && <small className="cpl-msg bad" role="alert">{err}</small>}
    </span>
  )
}

export function Pill({ tone, children }: { tone?: 'gold' | 'red' | 'green' | 'grey' | 'blue'; children: ReactNode }) {
  return <span className={`oz-pill ${tone ?? ''}`}>{children}</span>
}

/** Share to WhatsApp (contacts or groups) plus copy-link. Give `path` for a page inside O-Zone, or `url` for any other link. */
export function ShareButton({ text, path, url, label = 'Share' }: { text: string; path?: string; url?: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  const link = url ?? (path !== undefined ? ozLink(path) : '')
  const message = link ? `${text}\n\n${link}` : text
  return (
    <span className="oz-share">
      <a className="oz-ghost oz-wa-share" href={waShare(message)} target="_blank" rel="noopener noreferrer" aria-label={`${label} on WhatsApp`}><MessageCircle size={14} /> {label}</a>
      {link && (
        <button type="button" className="oz-ghost" onClick={() => { void navigator.clipboard?.writeText(link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) }) }}>
          <Link2 size={14} /> {copied ? 'Copied' : 'Copy link'}
        </button>
      )}
    </span>
  )
}

/** Copy-to-clipboard button. */
export function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false)
  return (
    <button type="button" className="lp-btn lp-btn-soft" onClick={() => { void navigator.clipboard?.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1500) }) }}>
      {done ? 'Copied' : label}
    </button>
  )
}

/** Admin-only image: tries Drive's thumbnail, and if the browser is not signed in to Google falls back to the API. */
export function AdminImg({ src, alt = '' }: { src: string; alt?: string }) {
  const [url, setUrl] = useState(src)
  const tried = useRef(false)
  useEffect(() => { setUrl(src); tried.current = false }, [src])
  if (!src) return null
  async function fallback() {
    if (tried.current) return
    tried.current = true
    try {
      const r = await oz<{ mime: string; data: string }>('admin_media_data', { id: driveIdFrom(src) })
      setUrl(`data:${r.mime};base64,${r.data}`)
    } catch { setUrl('') }
  }
  return url ? <img className="oz-adminimg" src={url} alt={alt} onError={() => void fallback()} /> : <span className="cpl-msg bad">Image unavailable</span>
}

/** Loads data once, with a retry. */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[]): { data: T | null; err: string; loading: boolean; reload: () => void } {
  const [data, setData] = useState<T | null>(null)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(true)
  const [n, setN] = useState(0)
  useEffect(() => {
    let live = true
    setLoading(true); setErr('')
    fn().then((d) => { if (live) setData(d) }).catch((e: Error) => { if (live) setErr(e.message) }).finally(() => { if (live) setLoading(false) })
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, n])
  return { data, err, loading, reload: () => setN((x) => x + 1) }
}

export function Err({ msg }: { msg: string }) { return msg ? <p className="cpl-err" role="alert">{msg}</p> : null }

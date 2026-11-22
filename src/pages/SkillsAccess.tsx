import { useCallback, useEffect, useState, type FormEvent } from 'react'
import type { User } from 'firebase/auth'
import { Copy, Lock, MessageCircle, Radio, RefreshCw, Video } from 'lucide-react'
import { CHANNEL_URL, skillsApi, skillsReady, type AccessKind, type ChannelVideo, type ClassItem, type MyAccess, type SkillsConfig } from '../lib/skills'
import { errMsg, type Note } from '../lib/hub'
import { Msg } from '../components/HubUi'
import { ChatRoom } from '../components/CitChat'
import '../components/Cit.css'

const kes = (n: number) => (n > 0 ? `KES ${n.toLocaleString('en-KE')}` : 'Free')
const fmtWhen = (s: string) => new Date(s).toLocaleString('en-KE', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

function waLink(config: SkillsConfig, user: User | null, title: string, price: number, ref: string, code: string) {
  const text = ['Hello CIT admin, I have paid. Please activate my access.', '', `For: ${title}`, `Amount: KES ${price}`, `Paid to: ${config.payTo}`,
    `M-Pesa code: ${code || '(will send the SMS)'}`, `Order ref: ${ref}`, `Name: ${user?.displayName ?? ''}`, `Email: ${user?.email ?? ''}`].join('\n')
  return `https://wa.me/${config.whatsapp}?text=${encodeURIComponent(text)}`
}

/**
 * Shown on a class page. Lets a student pay for the Full Pass, this whole course, or ONE session, and shows what they already have.
 * Payment: pay by M-Pesa to the admin number, paste the code, tap "I have paid", then message the admin. The admin activates it.
 */
export function AccessPanel({ cls, user, onSignIn, config, onChanged }: { cls: ClassItem; user: User | null; onSignIn: () => void; config: SkillsConfig; onChanged: () => void }) {
  const [acc, setAcc] = useState<MyAccess | null>(null)
  const [pick, setPick] = useState<AccessKind>('course')
  const [sessionId, setSessionId] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<Note>(null)
  const [done, setDone] = useState<{ id: string; title: string; price: number; code: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const pr = acc?.prices ?? config.prices
  const upcoming = cls.sessions.filter((s) => new Date(s.endAt).getTime() >= Date.now() && !s.paid)
  const load = useCallback(() => { if (user && skillsReady) skillsApi.myAccess().then(setAcc).catch(() => setAcc(null)) }, [user])
  useEffect(() => { load() }, [load, cls.id])
  useEffect(() => { if (!sessionId && upcoming[0]) setSessionId(upcoming[0].id) }, [upcoming, sessionId])

  if (cls.access === 'all') return <p><span className="cit-paid">✓ You have access to this course</span></p>
  const price = pick === 'full' ? pr.full : pick === 'course' ? pr.course : pr.session
  const pending = acc?.pending.find((p) => p.classId === cls.id || p.kind === 'full')
  async function copy() { try { await navigator.clipboard.writeText(config.payTo); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { /* ignore */ } }
  async function pay(e: FormEvent) {
    e.preventDefault()
    if (!user) return onSignIn()
    setBusy(true); setMsg(null)
    try {
      const r = await skillsApi.accessOrder({ kind: pick, classId: pick === 'full' ? undefined : cls.id, sessionId: pick === 'session' ? sessionId : undefined, mpesaCode: code.trim() || undefined })
      if (r.status === 'active') { setMsg({ type: 'ok', text: 'Unlocked. Enjoy the class!' }); onChanged() }
      else setDone({ id: r.id, title: r.title, price: r.price, code: code.trim().toUpperCase() })
      load()
    } catch (err) { setMsg({ type: 'err', text: errMsg(err) }) } finally { setBusy(false) }
  }

  return (
    <section className="cit-price">
      <h3><Lock size={16} style={{ verticalAlign: -2 }} /> Get access</h3>
      {acc?.full && <p><span className="cit-paid">✓ You have the Full Pass{acc.passExpires ? ` until ${new Date(acc.passExpires).toLocaleDateString('en-KE')}` : ''}</span></p>}
      {pending && !done && (
        <p className="sl-alert">Your payment for <b>{pending.title}</b> is waiting for the admin. <a className="sl-link" href={waLink(config, user, pending.title, pending.price, pending.orderId, pending.mpesaCode)} target="_blank" rel="noreferrer noopener">Message the admin</a> · <button className="sl-mini" onClick={() => { load(); onChanged() }}><RefreshCw size={12} /> Check again</button></p>
      )}
      {!done ? (
        <form className="cit-pay" onSubmit={pay}>
          <div className="cit-price-opts">
            <button type="button" className={`cit-opt ${pick === 'full' ? 'on' : ''}`} onClick={() => setPick('full')}><b>{kes(pr.full)}</b><span>Full Pass: every course{pr.passDays ? `, ${pr.passDays} days` : ''}</span></button>
            <button type="button" className={`cit-opt ${pick === 'course' ? 'on' : ''}`} onClick={() => setPick('course')}><b>{kes(pr.course)}</b><span>This whole course</span></button>
            <button type="button" className={`cit-opt ${pick === 'session' ? 'on' : ''}`} onClick={() => setPick('session')} disabled={upcoming.length === 0}><b>{kes(pr.session)}</b><span>{upcoming.length ? 'One session' : 'No upcoming session'}</span></button>
          </div>
          {pick === 'session' && upcoming.length > 0 && (
            <label>Which session?<select value={sessionId} onChange={(e) => setSessionId(e.target.value)}>{upcoming.map((s) => <option key={s.id} value={s.id}>{fmtWhen(s.startAt)} · {s.title}</option>)}</select></label>
          )}
          <p>1. Pay <b>{kes(price)}</b> by M-Pesa to <code>{config.payTo}</code> <button type="button" className="sl-mini" onClick={copy}><Copy size={13} /> {copied ? 'Copied' : 'Copy'}</button></p>
          <label>2. M-Pesa code from the SMS (optional, speeds up activation)<input value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. QGH7XXXXXX" maxLength={14} /></label>
          <Msg msg={msg} />
          <button className="sl-primary" disabled={busy || (pick === 'session' && !sessionId)}>{user ? (busy ? 'Sending…' : price === 0 ? 'Unlock for free' : 'I have paid') : 'Sign in to continue'}</button>
          <small className="sl-sub">Then message the admin so they can activate it. Single-session access opens the class link 30 minutes before that session. Payments are not refundable.</small>
        </form>
      ) : (
        <div className="cit-pay">
          <p className="sl-alert ok">Order recorded. Now send it to the admin on WhatsApp so it is activated.</p>
          <a className="sl-primary" style={{ textAlign: 'center' }} href={waLink(config, user, done.title, done.price, done.id, done.code)} target="_blank" rel="noreferrer noopener"><MessageCircle size={15} style={{ verticalAlign: -2 }} /> Message the admin</a>
          <button className="sl-mini" onClick={() => { setDone(null); onChanged() }}>Done</button>
        </div>
      )}
    </section>
  )
}

/** Live now: the YouTube stream (for people with access, or everyone when it is free) with the realtime chat beside it. */
export function LiveRoom({ config, user, onSignIn, isAdmin, onOpenClass }: { config: SkillsConfig; user: User | null; onSignIn: () => void; isAdmin: boolean; onOpenClass: (id: string) => void }) {
  const live = config.live
  return (
    <>
      <div className="sl-page-head"><div><span className="sl-kicker">{live.on ? 'LIVE NOW' : 'LIVE'}</span><h1>{live.on ? live.title || 'CIT live class' : 'Live classes'}</h1></div></div>
      {!live.on ? (
        <div className="cit-note">No live class right now. Check the schedule under <b>Classes</b>, or watch past lessons on <a className="sl-link" href={CHANNEL_URL} target="_blank" rel="noreferrer noopener">our YouTube channel</a>.</div>
      ) : (
        <div className="cit-live split">
          <div>
            {live.locked || !live.videoId ? (
              <div className="cit-price"><h3><Lock size={16} style={{ verticalAlign: -2 }} /> This live class is for students with access</h3>
                <p>Get the Full Pass or buy the course to watch live.</p>
                {live.classId ? <button className="sl-primary small" onClick={() => onOpenClass(live.classId as string)}>See prices</button> : <p className="sl-sub">Open any class to see the Full Pass price.</p>}
              </div>
            ) : (
              <div className="cit-live-wrap"><iframe src={`https://www.youtube-nocookie.com/embed/${live.videoId}?autoplay=1&rel=0`} title={live.title || 'Live class'} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen /></div>
            )}
          </div>
          <ChatRoom room="live" user={user} onSignIn={onSignIn} isAdmin={isAdmin} title="Live chat" sub="Be kind and stay on topic" placeholder="Ask or comment…" />
        </div>
      )}
    </>
  )
}

/** Latest public videos of the CIT YouTube channel (free RSS feed, no quota). */
export function ChannelShelf({ config }: { config: SkillsConfig }) {
  const [items, setItems] = useState<ChannelVideo[] | null>(null)
  useEffect(() => { if (skillsReady && config.channelId) skillsApi.channelFeed().then((r) => setItems(r.items)).catch(() => setItems([])) }, [config.channelId])
  if (!config.channelId) return null
  return (
    <>
      <div className="hub-sec"><h2><Video size={18} style={{ verticalAlign: -3 }} /> From our YouTube channel</h2></div>
      {items && items.length > 0 ? (
        <div className="cit-shelf">{items.map((v) => (
          <a key={v.videoId} href={`https://www.youtube.com/watch?v=${v.videoId}`} target="_blank" rel="noreferrer noopener">
            <img src={v.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" /><span>{v.title}</span>
          </a>))}
        </div>
      ) : <p className="sl-sub">New videos will appear here.</p>}
      <p style={{ marginTop: 8 }}><a className="sl-mini" href={`${CHANNEL_URL}?sub_confirmation=1`} target="_blank" rel="noreferrer noopener">Subscribe to @{config.channelHandle}</a></p>
    </>
  )
}

/** Admin: switch "Live now" on or off. Paste the YouTube live link (use Unlisted for paid classes). */
export function AdminLive({ config, classes, onSaved }: { config: SkillsConfig; classes: ClassItem[]; onSaved: () => void }) {
  const [link, setLink] = useState('')
  const [title, setTitle] = useState(config.live.title ?? '')
  const [classId, setClassId] = useState(config.live.classId ?? '')
  const [free, setFree] = useState(!!config.live.free)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<Note>(null)
  async function save(on: boolean) {
    setBusy(true); setMsg(null)
    try { await skillsApi.admin.setLive({ on, videoId: link.trim(), title: title.trim(), classId, free }); setMsg({ type: 'ok', text: on ? 'You are live. Students will see it.' : 'Live is off.' }); onSaved() }
    catch (e) { setMsg({ type: 'err', text: errMsg(e) }) } finally { setBusy(false) }
  }
  return (
    <form className="sl-form cf-box" onSubmit={(e) => { e.preventDefault(); void save(true) }}>
      <strong><Radio size={15} /> Live now {config.live.on && <span className="cit-paid">ON</span>}</strong>
      <small>Start a YouTube live stream (set it to Unlisted for paid classes), paste its link here, and tap Go live. Paid students get the video; the chat opens for everyone signed in.</small>
      <label>YouTube live link<input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://www.youtube.com/watch?v=…" /></label>
      <label>Title<input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} placeholder="e.g. Google Sheets: formulas night" /></label>
      <label>For which class?<select value={classId} onChange={(e) => setClassId(e.target.value)}><option value="">Full Pass holders only</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
      <label className="cf-check"><input type="checkbox" checked={free} onChange={(e) => setFree(e.target.checked)} /> Free for everyone (open lesson)</label>
      <Msg msg={msg} />
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="sl-primary small" disabled={busy || !link.trim()}>{busy ? 'Saving…' : 'Go live'}</button>
        {config.live.on && <button type="button" className="sl-mini danger" disabled={busy} onClick={() => void save(false)}>Stop live</button>}
      </div>
    </form>
  )
}

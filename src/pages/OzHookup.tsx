import { useState, type FormEvent } from 'react'
import { EyeOff, Heart, MessageCircle, ShieldCheck, Trash2 } from 'lucide-react'
import { avatarFor, day, oz, ozLink, waShare, type HookupCard, type IntroRow, type MyProfile } from '../lib/ozone'
import { canShareFiles, downloadBlob, profileImage } from '../lib/shareCard'
import { Err, Gate, Pill, ReportButton, ShareButton, useLoad, type OzCtx } from './OzCommon'

type Tab = 'browse' | 'mine' | 'intros'

export default function Hookup({ ctx }: { ctx: OzCtx }) {
  const [adult, setAdult] = useState(false)
  const [tab, setTab] = useState<Tab>('browse')

  if (!adult) {
    return (
      <div className="oz-wrap">
        <div className="cpl-card oz-gate">
          <ShieldCheck size={30} />
          <h2>Hookup · 18+ only</h2>
          <p>Profiles here are hidden: each one shows a random avatar instead of a photo, and no names or phone numbers are shown. The admin connects two people only after <b>both</b> say yes.</p>
          <p className="cpl-sub">You must be 18 or older to look at this section.</p>
          <div className="ef-actions">
            <button type="button" className="lp-btn" onClick={() => setAdult(true)}>I am 18 or older</button>
            <a className="lp-btn lp-btn-soft" href="#/ozone">Take me back</a>
          </div>
        </div>
      </div>
    )
  }
  return (
    <div className="oz-wrap">
      <h2>Hookup</h2>
      <p className="cpl-sub">Hidden profiles, admin-brokered intros. Be respectful and be safe: meet in public and tell a friend.</p>
      <ShareButton text="Chuka O-Zone Hookup (18+ only): hidden profiles, and the admin connects two people only when both say yes." path="hookup" />
      <nav className="ef-tabs" aria-label="Hookup">
        {([['browse', 'Browse'], ['mine', 'My profile'], ['intros', 'My intros']] as const).map(([id, l]) => (
          <button key={id} type="button" className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>{l}</button>
        ))}
      </nav>
      {tab === 'browse' && <Browse ctx={ctx} goMine={() => setTab('mine')} />}
      {tab === 'mine' && <Gate ctx={ctx} what="manage your profile"><Mine ctx={ctx} /></Gate>}
      {tab === 'intros' && <Gate ctx={ctx} what="see your intros"><Intros /></Gate>}
    </div>
  )
}

/** Shares the exact profile card as a picture (WhatsApp Status, chats, groups), like confessions do. */
async function shareProfilePicture(p: HookupCard, mode: 'share' | 'save') {
  const blob = await profileImage(p, window.location.host)
  const name = `chuka-ozone-${p.code}.png`
  if (mode === 'save') { downloadBlob(blob, name); return }
  const file = new File([blob], name, { type: 'image/png' })
  try {
    await navigator.share({ files: [file], text: `${p.code} on Chuka O-Zone Hookup 👀 (18+)\n${ozLink('hookup')}` })
  } catch (e) {
    if ((e as Error).name === 'AbortError') return
    downloadBlob(blob, name)
  }
}

function ShareProfile({ p }: { p: HookupCard }) {
  const [making, setMaking] = useState(false)
  const [err, setErr] = useState('')
  const text = `${p.code} on Chuka O-Zone Hookup (18+)\n${p.gender} · ${p.ageBand} · Looking for: ${p.lookingFor}\n"${p.vibe}"\n${ozLink('hookup')}`
  return (
    <>
      <a
        className="oz-wa" href={waShare(text)} target="_blank" rel="noopener noreferrer" aria-busy={making}
        onClick={(e) => {
          if (!canShareFiles()) return
          e.preventDefault(); setMaking(true); setErr('')
          shareProfilePicture(p, 'share').catch((x: Error) => setErr(x.message)).finally(() => setMaking(false))
        }}
      >
        <MessageCircle size={15} /> {making ? 'Making picture…' : 'Share on WhatsApp'}
      </a>
      {err && <small className="cpl-msg bad" role="alert">{err}</small>}
    </>
  )
}

function Card({ p, children }: { p: HookupCard; children?: React.ReactNode }) {
  return (
    <article className="oz-profile">
      <div className="oz-ph"><img src={avatarFor(p.gender, p.code)} alt="Profile avatar" loading="lazy" /></div>
      <div className="oz-pbody">
        <header><strong>{p.code}</strong><small>{p.gender} · {p.ageBand}</small></header>
        <Pill tone="gold">{p.lookingFor}</Pill>
        <p>{p.vibe}</p>
        {p.tags.length > 0 && <div className="oz-tags">{p.tags.map((t) => <span key={t}>{t}</span>)}</div>}
        {children}
      </div>
    </article>
  )
}

function Browse({ ctx, goMine }: { ctx: OzCtx; goMine: () => void }) {
  const hk = ctx.cfg?.hookup
  const [g, setG] = useState('')
  const [a, setA] = useState('')
  const [l, setL] = useState('')
  const { data, err, loading } = useLoad(() => oz<{ items: HookupCard[] }>('profiles_list', { gender: g || undefined, ageBand: a || undefined, lookingFor: l || undefined }), [g, a, l])
  const [target, setTarget] = useState<HookupCard | null>(null)
  const live = ctx.me?.profile?.status === 'published'

  return (
    <>
      <div className="oz-filters">
        <select className="ef-sel" value={g} onChange={(e) => setG(e.target.value)} aria-label="Gender"><option value="">Any gender</option>{hk?.genders.map((x) => <option key={x}>{x}</option>)}</select>
        <select className="ef-sel" value={a} onChange={(e) => setA(e.target.value)} aria-label="Age"><option value="">Any age</option>{hk?.ageBands.map((x) => <option key={x}>{x}</option>)}</select>
        <select className="ef-sel" value={l} onChange={(e) => setL(e.target.value)} aria-label="Looking for"><option value="">Looking for…</option>{hk?.lookingFor.map((x) => <option key={x}>{x}</option>)}</select>
      </div>
      {!live && <p className="cpl-note oz-left">To ask for an intro you need your own approved profile. <button type="button" className="cpl-linkbtn" onClick={goMine}>Create or check yours</button></p>}
      <Err msg={err} />{loading && <p className="cpl-empty">Loading…</p>}
      <div className="oz-profiles">
        {data?.items.map((p) => (
          <Card key={p.code} p={p}>
            <div className="oz-actions">
              <button type="button" className="lp-btn" onClick={() => (ctx.user ? setTarget(p) : void ctx.signIn())} disabled={ctx.me?.profile?.code === p.code}><Heart size={14} /> Ask for intro</button>
              <ShareProfile p={p} />
              <ReportButton ctx={ctx} kind="profile" refId={p.code} />
            </div>
          </Card>
        ))}
      </div>
      {data && !data.items.length && <p className="cpl-empty">No profiles match yet.</p>}
      {target && <IntroDialog p={target} cfg={ctx.cfg!} onClose={() => setTarget(null)} />}
    </>
  )
}

function IntroDialog({ p, cfg, onClose }: { p: HookupCard; cfg: NonNullable<OzCtx['cfg']>; onClose: () => void }) {
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [res, setRes] = useState<{ waUrl: string } | null>(null)
  async function send(e: FormEvent) {
    e.preventDefault(); setBusy(true); setErr('')
    try { setRes(await oz('intro_request', { targetCode: p.code, note })) } catch (x) { setErr((x as Error).message) } finally { setBusy(false) }
  }
  return (
    <div className="ef-zoom" role="dialog" aria-label="Ask for an intro" onClick={onClose}>
      <form className="cpl-card cpl-form oz-dialog" onSubmit={send} onClick={(e) => e.stopPropagation()}>
        <h3>Intro to {p.code}</h3>
        {res ? (
          <>
            <p>Sent. Message the admin on WhatsApp so they can follow up quickly. They contact {p.code} first, and your number is only shared if they say yes.</p>
            <a className="lp-btn" href={res.waUrl} target="_blank" rel="noopener noreferrer"><MessageCircle size={15} /> Message the admin</a>
            <button type="button" className="lp-btn lp-btn-soft" onClick={onClose}>Close</button>
          </>
        ) : (
          <>
            <label>Short note (optional)<textarea rows={3} value={note} maxLength={cfg.limits.introNoteMax} onChange={(e) => setNote(e.target.value)} />
              <small>No phone numbers. The admin connects you.</small></label>
            <Err msg={err} />
            <button className="lp-btn" disabled={busy}>{busy ? 'Sending…' : 'Send request'}</button>
            <button type="button" className="lp-btn lp-btn-soft" onClick={onClose}>Cancel</button>
          </>
        )}
      </form>
    </div>
  )
}

const STATUS: Record<string, [string, 'gold' | 'green' | 'grey' | 'red']> = {
  pending: ['Waiting for admin approval', 'gold'], published: ['Live', 'green'], hidden: ['Hidden', 'grey'], removed: ['Removed by admin', 'red'],
}

function Mine({ ctx }: { ctx: OzCtx }) {
  const { data, err, loading, reload } = useLoad(() => oz<MyProfile>('profile_mine'), [])
  const [msg, setMsg] = useState('')
  async function set(op: 'hide' | 'show' | 'delete') {
    if (op === 'delete' && !confirm('Delete your profile? Your name and phone are wiped for good.')) return
    try { await oz('profile_set', { op }); await ctx.reload(); reload() } catch (x) { setMsg((x as Error).message) }
  }
  if (loading && !data) return <p className="cpl-empty">Loading…</p>
  if (err) return <Err msg={err} />
  if (!data?.profile) return <CreateForm ctx={ctx} onDone={() => { void ctx.reload(); reload() }} />
  const [label, tone] = STATUS[data.status ?? ''] ?? [data.status ?? '', 'grey' as const]
  return (
    <div className="oz-mine">
      <div className="cpl-card">
        <header className="oz-hd"><h3>Your profile</h3><Pill tone={tone}>{label}</Pill></header>
        <Card p={data.profile}>{data.status === 'published' && <div className="oz-actions"><ShareProfile p={data.profile} /></div>}</Card>
        <p className="cpl-sub oz-small">Only you and the admin can see your name ({data.realName}) and phone ({data.phone}). Others see this card.</p>
        <div className="oz-actions">
          {data.status === 'published' && <button type="button" className="lp-btn lp-btn-soft" onClick={() => void set('hide')}><EyeOff size={14} /> Hide</button>}
          {data.status === 'hidden' && <button type="button" className="lp-btn lp-btn-soft" onClick={() => void set('show')}>Show again</button>}
          <button type="button" className="lp-btn cpl-danger" onClick={() => void set('delete')}><Trash2 size={14} /> Delete</button>
        </div>
        <Err msg={msg} />
      </div>
      {data.status === 'pending' && <p className="cpl-note">The admin may message you on WhatsApp to confirm you are 18+.</p>}
    </div>
  )
}

function CreateForm({ ctx, onDone }: { ctx: OzCtx; onDone: () => void }) {
  const cfg = ctx.cfg!, hk = cfg.hookup
  const [f, setF] = useState({ gender: hk.genders[0] ?? '', ageBand: hk.ageBands[0] ?? '', lookingFor: hk.lookingFor[0] ?? '', vibe: '', tags: '', realName: '', phone: '' })
  const [ageOk, setAgeOk] = useState(false)
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }))

  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setErr('')
    try {
      await oz('profile_submit', {
        ...f, tags: f.tags.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 5), ageConfirmed: ageOk, consent,
      })
      onDone()
    } catch (x) { setErr((x as Error).message) } finally { setBusy(false) }
  }

  return (
    <form className="cpl-card cpl-form oz-form" onSubmit={submit}>
      <h3>Create your hidden profile</h3>
      <p className="cpl-sub oz-small">No photo needed: your card gets a random avatar for your gender.</p>
      <div className="cpl-grid2">
        <label>Gender<select value={f.gender} onChange={(e) => set('gender', e.target.value)}>{hk.genders.map((x) => <option key={x}>{x}</option>)}</select></label>
        <label>Age<select value={f.ageBand} onChange={(e) => set('ageBand', e.target.value)}>{hk.ageBands.map((x) => <option key={x}>{x}</option>)}</select></label>
      </div>
      <label>Looking for<select value={f.lookingFor} onChange={(e) => set('lookingFor', e.target.value)}>{hk.lookingFor.map((x) => <option key={x}>{x}</option>)}</select></label>
      <label>Your vibe in one line<input type="text" value={f.vibe} minLength={10} maxLength={cfg.limits.vibeMax} required onChange={(e) => set('vibe', e.target.value)} placeholder="Calm, funny, loves football and chai" />
        <small>{f.vibe.length}/{cfg.limits.vibeMax}. Public. No names or phone numbers.</small></label>
      <label>Interests (up to 5, comma separated)<input type="text" value={f.tags} onChange={(e) => set('tags', e.target.value)} placeholder="music, football, movies" /></label>
      <fieldset className="cpl-fs">
        <legend>Private: only the admin sees these</legend>
        <label>Real name<input type="text" value={f.realName} minLength={2} maxLength={60} required onChange={(e) => set('realName', e.target.value)} /></label>
        <label>WhatsApp number<input type="tel" value={f.phone} required onChange={(e) => set('phone', e.target.value)} placeholder="07XX XXX XXX" /></label>
      </fieldset>
      <label className="cpl-file"><input type="checkbox" checked={ageOk} onChange={(e) => setAgeOk(e.target.checked)} /> I confirm that I am 18 or older.</label>
      <label className="cpl-file"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} /> I agree to be listed with a random avatar (no photo) and that the admin keeps my name, number and e-mail to arrange intros. I can delete everything any time.</label>
      <Err msg={err} />
      <button className="lp-btn" disabled={busy || !ageOk || !consent}>{busy ? 'Sending…' : 'Submit for approval'}</button>
    </form>
  )
}

function Intros() {
  const { data, err, loading } = useLoad(() => oz<{ items: IntroRow[] }>('intro_mine'), [])
  return (
    <div className="oz-list">
      <Err msg={err} />{loading && <p className="cpl-empty">Loading…</p>}
      {data?.items.map((i) => (
        <div key={i.id} className="cpl-card oz-intro">
          <strong>To {i.targetCode}</strong><Pill tone={i.status === 'both_agreed' ? 'green' : i.status === 'declined' ? 'red' : 'gold'}>{i.label}</Pill><small>{day(i.createdAt)}</small>
        </div>
      ))}
      {data && !data.items.length && <p className="cpl-empty">No intro requests yet.</p>}
    </div>
  )
}

import { useState, type FormEvent, type ReactNode } from 'react'
import { Ban, Check, ExternalLink, MessageCircle, X } from 'lucide-react'
import { oz, pad, stamp, waLink } from '../lib/ozone'
import { AdminImg, CopyButton, Err, Pill, useLoad } from './OzCommon'

type Counts = Record<'confession' | 'issue' | 'profile' | 'aspirant' | 'aspirantq' | 'intro' | 'report' | 'trend', number>
type Kind = keyof Counts
type Stats = { queues: Counts; published: { confessions: number; issues: number; profiles: number }; bans: number; replyOverdue: number }
type AMedia = { id: string; type: 'image' | 'video'; url: string }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>

const LABEL: Record<Kind, string> = {
  confession: 'Confessions', issue: 'Issues', profile: 'Profiles', aspirant: 'Aspirants', aspirantq: 'Questions', intro: 'Intros', report: 'Reports', trend: 'Videos',
}
const KINDS = Object.keys(LABEL) as Kind[]

export default function Admin() {
  const [tab, setTab] = useState<Kind | 'content'>('confession')
  const stats = useLoad(() => oz<Stats>('admin_stats'), [])
  const reloadStats = stats.reload
  return (
    <div className="oz-wrap oz-admin">
      <h2>O-Zone admin desk</h2>
      <Err msg={stats.err} />
      {stats.data && (
        <p className="cpl-sub">
          Live: {stats.data.published.confessions} confessions · {stats.data.published.issues} issues · {stats.data.published.profiles} profiles · {stats.data.bans} blocked
          {stats.data.replyOverdue > 0 && <> · <b className="oz-over">{stats.data.replyOverdue} right-of-reply window(s) passed</b></>}
        </p>
      )}
      <nav className="ef-tabs" aria-label="Queues">
        {KINDS.map((k) => (
          <button key={k} type="button" className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
            {LABEL[k]}{stats.data && stats.data.queues[k] > 0 ? ` (${stats.data.queues[k]})` : ''}
          </button>
        ))}
        <button type="button" className={tab === 'content' ? 'on' : ''} onClick={() => setTab('content')}>Content & settings</button>
      </nav>
      {tab === 'content' ? <Content /> : <Queue key={tab} kind={tab} onChange={reloadStats} />}
    </div>
  )
}

function Queue({ kind, onChange }: { kind: Kind; onChange: () => void }) {
  const { data, err, loading, reload } = useLoad(() => oz<Row[]>('admin_queue', { kind }), [kind])
  const done = () => { reload(); onChange() }
  return (
    <div className="oz-list">
      <Err msg={err} />{loading && !data && <p className="cpl-empty">Loading…</p>}
      {data && !data.length && <p className="cpl-empty">Nothing waiting. 🎉</p>}
      {data?.map((r) => {
        const key = kind === 'profile' ? r.code : r.id
        return (
          <div className="cpl-card oz-q" key={key}>
            {kind === 'confession' && <Confession r={r} done={done} />}
            {kind === 'issue' && <IssueItem r={r} done={done} />}
            {kind === 'profile' && <ProfileItem r={r} done={done} />}
            {kind === 'aspirant' && <AspirantItem r={r} done={done} />}
            {kind === 'aspirantq' && <QuestionItem r={r} done={done} />}
            {kind === 'trend' && <TrendItem r={r} done={done} />}
            {kind === 'intro' && <IntroItem r={r} done={done} />}
            {kind === 'report' && <ReportItem r={r} done={done} />}
          </div>
        )
      })}
    </div>
  )
}

/* ---------- shared bits ---------- */

function Flags({ flags }: { flags?: string[] }) {
  if (!flags?.length) return null
  return <div className="oz-flags">{flags.map((f) => <Pill key={f} tone={f === 'self-harm' || f === 'possible-minor' ? 'red' : 'gold'}>{f}</Pill>)}</div>
}
function Media({ media }: { media?: AMedia[] }) {
  if (!media?.length) return null
  return <div className="oz-admedia">{media.map((m) => m.type === 'video'
    ? <iframe key={m.id} title="Video" src={m.url} allowFullScreen />
    : <AdminImg key={m.id} src={m.url} />)}</div>
}

/** Runs an admin call, shows errors, then refreshes the queue. */
function useAct(done: () => void) {
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  async function act<T>(action: string, payload: Record<string, unknown>, then?: (r: T) => void) {
    setBusy(true); setErr('')
    try { const r = await oz<T>(action, payload); if (then) then(r); else done() }
    catch (x) { setErr((x as Error).message) }
    finally { setBusy(false) }
  }
  return { act, err, busy }
}

function Ban_({ kind, id, done }: { kind: string; id: string | number; done: () => void }) {
  const { act, busy } = useAct(done)
  return (
    <button type="button" className="oz-ghost" disabled={busy} onClick={() => { if (confirm('Block this person from posting? You never see who they are.')) void act('admin_ban', { kind, id, reason: 'Blocked from the admin desk' }, () => alert('Blocked.')) }}>
      <Ban size={13} /> Block author
    </button>
  )
}

/* ---------- queue items ---------- */

function Confession({ r, done }: { r: Row; done: () => void }) {
  const [text, setText] = useState<string>(r.text)
  const [note, setNote] = useState('')
  const { act, err, busy } = useAct(done)
  const edited = text !== r.text
  return (
    <>
      <header className="oz-hd"><strong>#{pad(r.id)}</strong><Pill>{r.category}</Pill>{r.replyTo && <small>reply to #{pad(r.replyTo)}</small>}<small>{stamp(r.createdAt)}</small></header>
      <Flags flags={r.flags} />
      <textarea className="oz-edit" rows={4} value={text} onChange={(e) => setText(e.target.value)} aria-label="Confession text" />
      {edited && <small>Edited: your version will be published.</small>}
      <Media media={r.media} />
      <input className="oz-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Private note (optional)" maxLength={300} />
      <div className="oz-actions">
        <button type="button" className="lp-btn" disabled={busy} onClick={() => void act('admin_review', { kind: 'confession', id: r.id, decision: 'approve', note, editedText: edited ? text : undefined })}><Check size={14} /> Approve</button>
        <button type="button" className="lp-btn cpl-danger" disabled={busy} onClick={() => void act('admin_review', { kind: 'confession', id: r.id, decision: 'reject', note })}><X size={14} /> Reject</button>
        <Ban_ kind="confession" id={r.id} done={done} />
      </div>
      <Err msg={err} />
    </>
  )
}

function IssueItem({ r, done }: { r: Row; done: () => void }) {
  const [title, setTitle] = useState<string>(r.title)
  const [details, setDetails] = useState<string>(r.details)
  const [evidence, setEvidence] = useState('reported')
  const [note, setNote] = useState('')
  const { act, err, busy } = useAct(done)
  const payload = { kind: 'issue', id: r.id, note, editedTitle: title !== r.title ? title : undefined, editedDetails: details !== r.details ? details : undefined }
  return (
    <>
      <header className="oz-hd"><strong>#{pad(r.id, 3)}</strong><Pill tone={r.status === 'notified' ? 'blue' : 'grey'}>{r.status}</Pill><small>{r.facultyName} · {r.category}</small>{r.aspirantId && <Pill tone="blue">For aspirant #{r.aspirantId}</Pill>}<small>{stamp(r.createdAt)}</small></header>
      {r.status === 'notified' && <small className={r.replyOverdue ? 'oz-over' : ''}>Right of reply until {stamp(r.replyDeadline)}{r.replyOverdue ? ' (passed)' : ''}</small>}
      <Flags flags={r.flags} />
      <input className="oz-edit" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Title" />
      <textarea className="oz-edit" rows={4} value={details} onChange={(e) => setDetails(e.target.value)} aria-label="Details" />
      <Media media={r.media} />
      <div className="oz-actions">
        <select className="ef-sel" value={evidence} onChange={(e) => setEvidence(e.target.value)} aria-label="Evidence level">
          <option value="reported">Reported (several reports)</option><option value="confirmed">Confirmed (I saw proof)</option>
        </select>
        <input className="oz-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Private note (optional)" maxLength={300} />
      </div>
      <div className="oz-actions">
        {r.status === 'pending' && <button type="button" className="lp-btn lp-btn-soft" disabled={busy} onClick={() => void act('admin_review', { ...payload, decision: 'notify' })}>Notify office (72 h reply)</button>}
        <button type="button" className="lp-btn" disabled={busy} onClick={() => void act('admin_review', { ...payload, decision: 'approve', evidence })}><Check size={14} /> Approve</button>
        <button type="button" className="lp-btn cpl-danger" disabled={busy} onClick={() => void act('admin_review', { ...payload, decision: 'reject' })}><X size={14} /> Reject</button>
        <Ban_ kind="issue" id={r.id} done={done} />
      </div>
      <Err msg={err} />
    </>
  )
}

function ProfileItem({ r, done }: { r: Row; done: () => void }) {
  const [checked, setChecked] = useState(false)
  const [note, setNote] = useState('')
  const { act, err, busy } = useAct(done)
  return (
    <>
      <header className="oz-hd"><strong>{r.code}</strong><small>{r.gender} · {r.ageBand} · {r.lookingFor}</small><small>{stamp(r.createdAt)}</small></header>
      <Flags flags={r.flags} />
      <p className="oz-text">“{r.vibe}” {r.tags?.length ? <small>· {r.tags.join(', ')}</small> : null}</p>
      <div className="oz-admedia"><div><AdminImg src={r.originalPhoto} /><small>Original (private)</small></div><div><AdminImg src={r.blurPhoto} /><small>Public (blurred)</small></div></div>
      <div className="oz-priv">
        <b>{r.realName}</b> · +{r.phone} · {r.email}
        <a className="oz-ghost" href={waLink(r.phone, `Hi ${r.realName}, Chuka O-Zone admin here. Quick check before your profile goes live: please confirm you are 18 or older. Thanks!`)} target="_blank" rel="noopener noreferrer"><MessageCircle size={13} /> Check age on WhatsApp</a>
      </div>
      <label className="cpl-file"><input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} /> Age checked: I confirmed this person is 18+</label>
      <input className="oz-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Private note (optional)" maxLength={300} />
      <div className="oz-actions">
        <button type="button" className="lp-btn" disabled={busy || !checked} onClick={() => void act('admin_review', { kind: 'profile', id: r.code, decision: 'approve', ageChecked: true, note })}><Check size={14} /> Approve</button>
        <button type="button" className="lp-btn cpl-danger" disabled={busy} onClick={() => void act('admin_review', { kind: 'profile', id: r.code, decision: 'reject', note })}><X size={14} /> Reject</button>
        <Ban_ kind="profile" id={r.code} done={done} />
      </div>
      <Err msg={err} />
    </>
  )
}

function AspirantItem({ r, done }: { r: Row; done: () => void }) {
  const [src, setSrc] = useState('')
  const { act, err, busy } = useAct(done)
  return (
    <>
      <header className="oz-hd"><strong>{r.name}</strong><Pill>{r.facultyCode}</Pill><small>{r.position} · {r.yearCourse}</small></header>
      <AdminImg src={r.photo} />
      <p className="oz-text">{r.manifesto}</p>
      {r.gallery?.length > 0 && <div className="oz-admedia">{(r.gallery as AMedia[]).map((m) => <AdminImg key={m.id} src={m.url} />)}</div>}
      {r.contact && <small>Contact: {r.contact}</small>}
      {r.whatsappUrl && <small>WhatsApp: <a href={r.whatsappUrl} target="_blank" rel="noopener noreferrer">{r.whatsappUrl}</a></small>}
      {r.links?.length > 0 && <small>Links: {(r.links as { label: string; url: string }[]).map((l) => <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer" style={{ marginRight: 8 }}>{l.label}</a>)}</small>}
      <input className="oz-note" value={src} onChange={(e) => setSrc(e.target.value)} placeholder="Official notice link or reference (required to clear)" />
      <div className="oz-actions">
        <button type="button" className="lp-btn" disabled={busy || src.trim().length < 5} onClick={() => void act('admin_review', { kind: 'aspirant', id: r.id, decision: 'approve', sourceUrl: src })}><Check size={14} /> Clear</button>
        <button type="button" className="lp-btn cpl-danger" disabled={busy} onClick={() => void act('admin_review', { kind: 'aspirant', id: r.id, decision: 'reject' })}><X size={14} /> Reject</button>
        <Ban_ kind="aspirant" id={r.id} done={done} />
      </div>
      <Err msg={err} />
    </>
  )
}

function TrendItem({ r, done }: { r: Row; done: () => void }) {
  const { act, err, busy } = useAct(done)
  return (
    <>
      <header className="oz-hd"><Pill>{r.source}</Pill><small>{stamp(r.createdAt)}</small></header>
      {r.thumb && <img className="oz-adminimg" src={r.thumb} alt="" referrerPolicy="no-referrer" />}
      <p className="oz-text"><b>{r.title}</b> <small>{r.author}</small></p>
      <a className="oz-ghost" href={r.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} /> Open the video</a>
      <div className="oz-actions">
        <button type="button" className="lp-btn" disabled={busy} onClick={() => void act('admin_review', { kind: 'trend', id: r.id, decision: 'approve' })}><Check size={14} /> Publish</button>
        <button type="button" className="lp-btn cpl-danger" disabled={busy} onClick={() => void act('admin_review', { kind: 'trend', id: r.id, decision: 'reject' })}><X size={14} /> Reject</button>
      </div>
      <Err msg={err} />
    </>
  )
}

function QuestionItem({ r, done }: { r: Row; done: () => void }) {
  const [deadline, setDeadline] = useState('')
  const { act, err, busy } = useAct(done)
  return (
    <>
      <header className="oz-hd"><Pill>{r.facultyCode}</Pill><small>{r.position}</small><small>{stamp(r.createdAt)}</small></header>
      <Flags flags={r.flags} />
      <p className="oz-text"><b>{r.question}</b></p>
      <input className="oz-note" value={deadline} onChange={(e) => setDeadline(e.target.value)} placeholder="Answer deadline, e.g. 2026-12-01 (optional)" />
      <div className="oz-actions">
        <button type="button" className="lp-btn" disabled={busy} onClick={() => void act('admin_review', { kind: 'aspirantq', id: r.id, decision: 'approve', deadline })}><Check size={14} /> Publish</button>
        <button type="button" className="lp-btn cpl-danger" disabled={busy} onClick={() => void act('admin_review', { kind: 'aspirantq', id: r.id, decision: 'reject' })}><X size={14} /> Reject</button>
        <Ban_ kind="aspirantq" id={r.id} done={done} />
      </div>
      <Err msg={err} />
    </>
  )
}

type Pack = {
  requester: { code: string; realName: string; phone: string; originalPhoto: string }; target: { code: string; realName: string; phone: string; originalPhoto: string }
  messages: Record<'askTarget' | 'connectRequester' | 'connectTarget', { text: string; url: string }>
}
const INTRO_STATUS = ['pending', 'asked_target', 'both_agreed', 'declined', 'closed']

function IntroItem({ r, done }: { r: Row; done: () => void }) {
  const [pack, setPack] = useState<Pack | null>(null)
  const { act, err, busy } = useAct(done)
  const m = pack?.messages
  return (
    <>
      <header className="oz-hd"><strong>#{r.id}</strong><small>{r.requesterCode} → {r.targetCode}</small><Pill tone={r.status === 'both_agreed' ? 'green' : 'gold'}>{r.status}</Pill><small>{stamp(r.createdAt)}</small></header>
      {r.note && <p className="oz-text">“{r.note}”</p>}
      <div className="oz-actions">
        <button type="button" className="lp-btn lp-btn-soft" disabled={busy} onClick={() => void act<Pack>('admin_intro_pack', { id: r.id }, setPack)}>Open intro pack</button>
        <select className="ef-sel" value={r.status} aria-label="Status" onChange={(e) => void act('admin_intro_set', { id: r.id, status: e.target.value })}>
          {INTRO_STATUS.map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>
      {pack && m && (
        <div className="oz-pack">
          <p className="cpl-sub oz-small">Ask the target first. Connect only after <b>both</b> say yes.</p>
          {([['1. Ask ' + pack.target.code, m.askTarget], ['2. Tell ' + pack.requester.code + ' (after YES)', m.connectRequester], ['3. Tell ' + pack.target.code + ' (after YES)', m.connectTarget]] as [string, { text: string; url: string }][]).map(([t, x]) => (
            <div key={t} className="oz-msg"><b>{t}</b><p>{x.text}</p>
              <div className="oz-actions">{x.url && <a className="lp-btn" href={x.url} target="_blank" rel="noopener noreferrer"><MessageCircle size={14} /> WhatsApp</a>}<CopyButton text={x.text} /></div></div>
          ))}
          <div className="oz-admedia"><div><AdminImg src={pack.requester.originalPhoto} /><small>{pack.requester.code}</small></div><div><AdminImg src={pack.target.originalPhoto} /><small>{pack.target.code}</small></div></div>
        </div>
      )}
      <Err msg={err} />
    </>
  )
}

function ReportItem({ r, done }: { r: Row; done: () => void }) {
  const { act, err, busy } = useAct(done)
  const link = r.kind === 'confession' ? `#/ozone/thread/${r.ref}` : r.kind === 'issue' ? `#/ozone/issue/${r.ref}` : ''
  return (
    <>
      <header className="oz-hd"><Pill tone="red">{r.kind} {r.ref}</Pill><small>{stamp(r.createdAt)}</small>{link && <a className="oz-ghost" href={link}><ExternalLink size={13} /> Open</a>}</header>
      <p className="oz-text">Reason: <b>{r.reason}</b></p>
      {r.preview && <blockquote className="oz-quote">{r.preview}</blockquote>}
      <div className="oz-actions">
        <button type="button" className="lp-btn cpl-danger" disabled={busy} onClick={() => void act('admin_report_resolve', { id: r.id, op: 'remove' })}>Remove the item</button>
        <button type="button" className="lp-btn lp-btn-soft" disabled={busy} onClick={() => void act('admin_report_resolve', { id: r.id, op: 'dismiss' })}>Dismiss</button>
      </div>
      <Err msg={err} />
    </>
  )
}

/* ---------- content, share text, settings ---------- */

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <details className="cpl-card oz-sec"><summary>{title}</summary><div>{children}</div></details>
}

function Content() {
  return (
    <div className="oz-list">
      <ShareTools />
      <IssueUpdates />
      <Section title="Chuka Trends videos"><TrendTools /></Section>
      <Section title="Polls"><PollForm /></Section>
      <Section title="Promises"><PromiseForm /></Section>
      <Section title="Leaders"><LeaderForm /></Section>
      <Section title="Aspirant answers & status"><AspirantTools /></Section>
      <Section title="Activations (KSh 30, one time)"><ActivationTools /></Section>
      <Section title="Settings"><Settings /></Section>
    </div>
  )
}

function Result({ text, url }: { text: string; url: string }) {
  return (
    <div className="oz-msg">
      <pre>{text}</pre>
      <div className="oz-actions"><a className="lp-btn" href={url} target="_blank" rel="noopener noreferrer"><MessageCircle size={14} /> Open in WhatsApp</a><CopyButton text={text} /></div>
    </div>
  )
}

function ShareTools() {
  const [kind, setKind] = useState<'confession' | 'issue'>('confession')
  const [id, setId] = useState('')
  const [out, setOut] = useState<{ text: string; waUrl: string } | null>(null)
  const [err, setErr] = useState('')
  async function go(fn: () => Promise<{ text: string; waUrl: string }>) {
    setErr(''); setOut(null)
    try { setOut(await fn()) } catch (x) { setErr((x as Error).message) }
  }
  return (
    <Section title="WhatsApp share text & weekly digest">
      <div className="oz-actions">
        <select className="ef-sel" value={kind} onChange={(e) => setKind(e.target.value as 'confession' | 'issue')}><option value="confession">Confession</option><option value="issue">Issue</option></select>
        <input className="oz-note" value={id} inputMode="numeric" onChange={(e) => setId(e.target.value.replace(/\D/g, ''))} placeholder="Number" />
        <button type="button" className="lp-btn" disabled={!id} onClick={() => void go(() => oz('admin_share_text', { kind, id: Number(id) }))}>Make share text</button>
        <button type="button" className="lp-btn lp-btn-soft" onClick={() => void go(() => oz('admin_digest'))}>Weekly digest</button>
      </div>
      <Err msg={err} />{out && <Result text={out.text} url={out.waUrl} />}
    </Section>
  )
}

const UPD = ['sent', 'response', 'resolved', 'no_response', 'correction', 'note'] as const
function IssueUpdates() {
  const [f, setF] = useState({ id: '', kind: 'sent' as (typeof UPD)[number], note: '', evidence: 'reported' })
  const [msg, setMsg] = useState('')
  const [bad, setBad] = useState(false)
  async function go(e: FormEvent) {
    e.preventDefault()
    try { await oz('admin_issue_update', { ...f, id: Number(f.id) }); setMsg('Saved.'); setBad(false); setF({ ...f, note: '' }) }
    catch (x) { setMsg((x as Error).message); setBad(true) }
  }
  return (
    <Section title="Log an issue update (sent, response, resolved…)">
      <form className="cpl-form oz-form" onSubmit={go}>
        <div className="cpl-grid2">
          <label>Issue number<input type="text" inputMode="numeric" value={f.id} required onChange={(e) => setF({ ...f, id: e.target.value.replace(/\D/g, '') })} /></label>
          <label>Update<select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as (typeof UPD)[number] })}>{UPD.map((u) => <option key={u}>{u}</option>)}</select></label>
        </div>
        {f.kind === 'sent' && <label>Evidence (needed if it was still private)<select value={f.evidence} onChange={(e) => setF({ ...f, evidence: e.target.value })}><option value="reported">reported</option><option value="confirmed">confirmed</option></select></label>}
        <label>Note (public)<input type="text" value={f.note} minLength={3} maxLength={400} required onChange={(e) => setF({ ...f, note: e.target.value })} /></label>
        {msg && <p className={`cpl-msg${bad ? ' bad' : ''}`} role="status">{msg}</p>}
        <button className="lp-btn">Save update</button>
      </form>
    </Section>
  )
}

function useSave() {
  const [msg, setMsg] = useState('')
  const [bad, setBad] = useState(false)
  async function save(action: string, payload: Record<string, unknown>, ok = 'Saved.') {
    try { await oz(action, payload); setMsg(ok); setBad(false); return true }
    catch (x) { setMsg((x as Error).message); setBad(true); return false }
  }
  return { msg, bad, save }
}
const Msg = ({ msg, bad }: { msg: string; bad: boolean }) => (msg ? <p className={`cpl-msg${bad ? ' bad' : ''}`} role="status">{msg}</p> : null)

function PollForm() {
  const [f, setF] = useState({ question: '', options: '', showResults: 'after_close', closesAt: '' })
  const { msg, bad, save } = useSave()
  return (
    <>
    <form className="cpl-form oz-form" onSubmit={async (e) => { e.preventDefault(); if (await save('admin_poll_save', { question: f.question, options: f.options.split('\n').map((x) => x.trim()).filter(Boolean), showResults: f.showResults, closesAt: f.closesAt || undefined, status: 'open' }, 'Poll created.')) setF({ ...f, question: '', options: '' }) }}>
      <label>Question<input type="text" value={f.question} required minLength={8} maxLength={200} onChange={(e) => setF({ ...f, question: e.target.value })} placeholder="What should be fixed first?" /></label>
      <label>Options (one per line, 2 to 6)<textarea rows={4} value={f.options} onChange={(e) => setF({ ...f, options: e.target.value })} required /></label>
      <div className="cpl-grid2">
        <label>Results<select value={f.showResults} onChange={(e) => setF({ ...f, showResults: e.target.value })}><option value="after_close">After it closes</option><option value="live">Live</option></select></label>
        <label>Closes on<input type="date" value={f.closesAt} onChange={(e) => setF({ ...f, closesAt: e.target.value })} /></label>
      </div>
      <Msg msg={msg} bad={bad} /><button className="lp-btn">Create poll</button>
      <small>To close or delete a poll, use the Polls tab of the Google Sheet or Delete below.</small>
    </form>
    <DeleteRow table="Polls" />
    </>
  )
}

type TPreview = { source: string; title: string; author: string; thumb: string; exists: boolean }
type TRow = { id: number; source: string; title: string; author: string; pinned: boolean; status: string; addedBy: string; url: string }

function TrendTools() {
  const [url, setUrl] = useState('')
  const [pin, setPin] = useState(false)
  const [pv, setPv] = useState<TPreview | null>(null)
  const { msg, bad, save } = useSave()
  const [perr, setPerr] = useState('')
  const list = useLoad(() => oz<TRow[]>('admin_trends_list'), [])
  async function preview() {
    setPerr(''); setPv(null)
    try { setPv(await oz<TPreview>('admin_trend_preview', { url })) } catch (x) { setPerr((x as Error).message) }
  }
  async function change(id: number, patch: Record<string, unknown>) {
    if (await save('admin_trend_set', { id, ...patch }, 'Updated.')) list.reload()
  }
  return (
    <>
      <div className="cpl-form oz-form">
        <label>YouTube or TikTok link<input type="url" inputMode="url" value={url} onChange={(e) => { setUrl(e.target.value); setPv(null) }} placeholder="https://www.tiktok.com/@name/video/..." /></label>
        <label className="oz-chk"><input type="checkbox" checked={pin} onChange={(e) => setPin(e.target.checked)} /> Pin to the top</label>
        <div className="oz-actions">
          <button type="button" className="lp-btn lp-btn-soft" disabled={!url.trim()} onClick={() => void preview()}>Preview</button>
          <button type="button" className="lp-btn" disabled={!url.trim()} onClick={async () => { if (await save('admin_trend_save', { url, pinned: pin }, 'Added to Chuka Trends.')) { setUrl(''); setPv(null); list.reload() } }}>Add video</button>
        </div>
        <Err msg={perr} />
        {pv && (
          <div className="oz-msg">
            {pv.thumb && <img className="oz-adminimg" src={pv.thumb} alt="" referrerPolicy="no-referrer" />}
            <p><b>{pv.title}</b> <small>{pv.author} · {pv.source}</small></p>
            {pv.exists && <p className="cpl-msg bad">Already in the list.</p>}
          </div>
        )}
        <Msg msg={msg} bad={bad} />
        <small>Your YouTube channel videos and live streams appear automatically. Use this for TikTok links or extra videos.</small>
      </div>
      <BulkAdd onDone={list.reload} />
      <Err msg={list.err} />
      {list.data?.map((t) => (
        <div className="oz-trow" key={t.id}>
          <div><b>{t.title}</b> <small>{t.author} · {t.source} · {t.addedBy}</small>{' '}{t.pinned && <Pill tone="gold">pinned</Pill>}{' '}{t.status === 'hidden' && <Pill tone="grey">hidden</Pill>}</div>
          <div className="oz-actions">
            <button type="button" className="lp-btn lp-btn-soft" onClick={() => void change(t.id, { pinned: !t.pinned })}>{t.pinned ? 'Unpin' : 'Pin'}</button>
            <button type="button" className="lp-btn lp-btn-soft" onClick={() => void change(t.id, { status: t.status === 'hidden' ? 'live' : 'hidden' })}>{t.status === 'hidden' ? 'Show' : 'Hide'}</button>
            <button type="button" className="lp-btn cpl-danger" onClick={() => { if (confirm('Delete this video?')) void save('admin_delete_row', { table: 'Trends', id: t.id }, 'Deleted.').then((ok) => ok && list.reload()) }}>Delete</button>
          </div>
        </div>
      ))}
    </>
  )
}

type BulkRow = { url: string; state: 'wait' | 'busy' | 'ok' | 'bad'; note: string }
const BULK_MAX = 20

/** Paste many TikTok / YouTube links at once. Each is added one after another (the server checks each link, so this is kept sequential). */
function BulkAdd({ onDone }: { onDone: () => void }) {
  const [text, setText] = useState('')
  const [pin, setPin] = useState(false)
  const [rows, setRows] = useState<BulkRow[]>([])
  const [running, setRunning] = useState(false)

  const links = Array.from(new Set((text.match(/https?:\/\/[^\s<>"']+/gi) ?? []).map((u) => u.replace(/[),.;]+$/, ''))))
  const over = links.length > BULK_MAX

  async function run(list: string[]) {
    setRunning(true)
    setRows(list.map((url) => ({ url, state: 'wait', note: '' })))
    const set = (i: number, patch: Partial<BulkRow>) => setRows((cur) => cur.map((r, j) => (j === i ? { ...r, ...patch } : r)))
    for (let i = 0; i < list.length; i++) {
      set(i, { state: 'busy' })
      try { await oz('admin_trend_save', { url: list[i], pinned: pin }); set(i, { state: 'ok', note: 'Added' }) }
      catch (x) { set(i, { state: 'bad', note: (x as Error).message }) }
    }
    setRunning(false)
    onDone()
  }

  const failed = rows.filter((r) => r.state === 'bad')
  const added = rows.filter((r) => r.state === 'ok').length
  const finished = rows.length > 0 && !running

  return (
    <div className="cpl-form oz-form">
      <label>Add many videos at once
        <textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder={'Paste TikTok or YouTube links, one per line (or all mixed together)'} disabled={running} />
      </label>
      <small>{links.length ? `${links.length} link${links.length === 1 ? '' : 's'} found` : 'No links found yet'}{over && ` · only ${BULK_MAX} at a time, please split the list`}</small>
      <label className="oz-chk"><input type="checkbox" checked={pin} onChange={(e) => setPin(e.target.checked)} disabled={running} /> Pin all to the top</label>
      <div className="oz-actions">
        <button type="button" className="lp-btn" disabled={running || !links.length || over} onClick={() => void run(links)}>
          {running ? `Adding ${rows.filter((r) => r.state === 'ok' || r.state === 'bad').length + 1} of ${rows.length}…` : `Add ${links.length || ''} video${links.length === 1 ? '' : 's'}`}
        </button>
        {finished && failed.length > 0 && (
          <button type="button" className="lp-btn lp-btn-soft" onClick={() => { setText(failed.map((r) => r.url).join('\n')); setRows([]) }}>Keep only the {failed.length} that failed</button>
        )}
      </div>
      {rows.length > 0 && (
        <ul className="oz-bulk" aria-live="polite">
          {rows.map((r) => (
            <li key={r.url} className={r.state}>
              <span>{r.state === 'ok' ? '✓' : r.state === 'bad' ? '✕' : r.state === 'busy' ? '…' : '·'}</span>
              <span className="oz-bulk-u">{r.url.replace(/^https?:\/\/(www\.)?/, '')}</span>
              {r.note && <small>{r.note}</small>}
            </li>
          ))}
        </ul>
      )}
      {finished && <p className={`cpl-msg${failed.length ? ' bad' : ''}`} role="status">{added} added{failed.length ? `, ${failed.length} failed (see above)` : '.'}</p>}
      <small>Videos already on Trends are skipped with a note. Short links (vm.tiktok.com) work too.</small>
    </div>
  )
}

function DeleteRow({ table }: { table: 'Leaders' | 'Promises' | 'Polls' }) {
  const [id, setId] = useState('')
  const { msg, bad, save } = useSave()
  return (
    <div className="oz-actions">
      <input className="oz-note" value={id} inputMode="numeric" onChange={(e) => setId(e.target.value.replace(/\D/g, ''))} placeholder={`${table.slice(0, -1)} number to delete`} />
      <button type="button" className="lp-btn cpl-danger" disabled={!id} onClick={() => { if (confirm(`Delete ${table.slice(0, -1)} ${id}?`)) void save('admin_delete_row', { table, id }, 'Deleted.') }}>Delete</button>
      <Msg msg={msg} bad={bad} />
    </div>
  )
}

function PromiseForm() {
  const [f, setF] = useState({ office: '', promise: '', sourceUrl: '', due: '', status: 'pending' })
  const { msg, bad, save } = useSave()
  return (
    <>
    <form className="cpl-form oz-form" onSubmit={async (e) => { e.preventDefault(); if (await save('admin_promise_save', f)) setF({ ...f, promise: '' }) }}>
      <label>Office<input type="text" value={f.office} required onChange={(e) => setF({ ...f, office: e.target.value })} placeholder="CUSA Chairperson" /></label>
      <label>Promise<textarea rows={3} value={f.promise} required minLength={10} onChange={(e) => setF({ ...f, promise: e.target.value })} /></label>
      <label>Source (link or reference)<input type="text" value={f.sourceUrl} required minLength={5} onChange={(e) => setF({ ...f, sourceUrl: e.target.value })} /></label>
      <div className="cpl-grid2">
        <label>Due<input type="date" value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} /></label>
        <label>Status<select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option>pending</option><option>delivered</option><option>missed</option></select></label>
      </div>
      <Msg msg={msg} bad={bad} /><button className="lp-btn">Save promise</button>
    </form>
    <DeleteRow table="Promises" />
    </>
  )
}

function LeaderForm() {
  const facs = useLoad(() => oz<{ faculties: { code: string }[] }>('faculties'), [])
  const [f, setF] = useState({ facultyCode: 'ALL', role: '', name: '', term: '', sourceUrl: '', status: 'current' })
  const { msg, bad, save } = useSave()
  return (
    <>
    <form className="cpl-form oz-form" onSubmit={async (e) => { e.preventDefault(); if (await save('admin_leader_save', f)) setF({ ...f, role: '', name: '' }) }}>
      <div className="cpl-grid2">
        <label>Faculty<select value={f.facultyCode} onChange={(e) => setF({ ...f, facultyCode: e.target.value })}><option value="ALL">Whole university</option>{facs.data?.faculties.map((x) => <option key={x.code}>{x.code}</option>)}</select></label>
        <label>Status<select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option>current</option><option>former</option></select></label>
      </div>
      <div className="cpl-grid2">
        <label>Role<input type="text" value={f.role} required onChange={(e) => setF({ ...f, role: e.target.value })} placeholder="Faculty Representative" /></label>
        <label>Name<input type="text" value={f.name} required minLength={3} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
      </div>
      <label>Term<input type="text" value={f.term} onChange={(e) => setF({ ...f, term: e.target.value })} placeholder="2025/2026" /></label>
      <label>Source (CUSA notice, results link)<input type="text" value={f.sourceUrl} required minLength={5} onChange={(e) => setF({ ...f, sourceUrl: e.target.value })} /></label>
      <Msg msg={msg} bad={bad} /><button className="lp-btn">Save leader</button>
    </form>
    <DeleteRow table="Leaders" />
    </>
  )
}

function AspirantTools() {
  const [ans, setAns] = useState({ questionId: '', aspirantId: '', text: '' })
  const [st, setSt] = useState({ id: '', status: 'elected' })
  const a = useSave(), b = useSave()
  return (
    <div className="oz-two">
      <form className="cpl-form oz-form" onSubmit={async (e) => { e.preventDefault(); if (await a.save('admin_answer_save', { questionId: Number(ans.questionId), aspirantId: Number(ans.aspirantId), text: ans.text })) setAns({ ...ans, text: '' }) }}>
        <b>Record an answer</b>
        <div className="cpl-grid2">
          <label>Question #<input type="text" inputMode="numeric" value={ans.questionId} required onChange={(e) => setAns({ ...ans, questionId: e.target.value.replace(/\D/g, '') })} /></label>
          <label>Aspirant #<input type="text" inputMode="numeric" value={ans.aspirantId} required onChange={(e) => setAns({ ...ans, aspirantId: e.target.value.replace(/\D/g, '') })} /></label>
        </div>
        <label>Answer<textarea rows={3} value={ans.text} required minLength={3} maxLength={600} onChange={(e) => setAns({ ...ans, text: e.target.value })} /></label>
        <Msg msg={a.msg} bad={a.bad} /><button className="lp-btn">Save answer</button>
      </form>
      <form className="cpl-form oz-form" onSubmit={async (e) => { e.preventDefault(); await b.save('admin_aspirant_set', { id: Number(st.id), status: st.status }) }}>
        <b>Change aspirant status</b>
        <div className="cpl-grid2">
          <label>Aspirant #<input type="text" inputMode="numeric" value={st.id} required onChange={(e) => setSt({ ...st, id: e.target.value.replace(/\D/g, '') })} /></label>
          <label>Status<select value={st.status} onChange={(e) => setSt({ ...st, status: e.target.value })}><option>cleared</option><option>elected</option><option>withdrew</option><option>rejected</option></select></label>
        </div>
        <Msg msg={b.msg} bad={b.bad} /><button className="lp-btn">Update</button>
      </form>
    </div>
  )
}

type Act = { email: string; amount: string; mpesaCode: string; note: string; createdAt: string }
function ActivationTools() {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [q, setQ] = useState('')
  const list = useLoad(() => oz<{ total: number; items: Act[] }>('admin_activations_list', { q }), [q])
  const { msg, bad, save } = useSave()
  async function go(e: FormEvent) {
    e.preventDefault()
    if (await save('admin_activate', { email, mpesaCode: code }, 'Activated. They can post instantly now.')) { setEmail(''); setCode(''); list.reload() }
  }
  async function revoke(em: string) {
    if (!confirm(`Remove activation for ${em}?`)) return
    if (await save('admin_deactivate', { email: em }, 'Activation removed.')) list.reload()
  }
  return (
    <div className="oz-form">
      <form className="cpl-form" onSubmit={go}>
        <p className="cpl-sub oz-small">After a student pays KSh 30 to the pay-to number and messages you on WhatsApp, enter the Google email they sign in with. Activation is permanent.</p>
        <div className="cpl-grid2">
          <label>Student sign-in email<input type="email" value={email} required onChange={(e) => setEmail(e.target.value)} /></label>
          <label>M-Pesa code (optional)<input type="text" value={code} maxLength={10} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} /></label>
        </div>
        <Msg msg={msg} bad={bad} /><button className="lp-btn">Activate account</button>
      </form>
      <label>Find an activated email<input type="text" value={q} onChange={(e) => setQ(e.target.value)} /></label>
      <Err msg={list.err} />
      {list.data && <p className="cpl-sub oz-small">{list.data.total} activated in total</p>}
      {list.data?.items.map((a) => (
        <div className="cpl-card" key={a.email}>
          <small>{a.email}{a.mpesaCode ? ` · ${a.mpesaCode}` : ''} · {stamp(a.createdAt)}</small>
          <div className="oz-actions"><button type="button" className="oz-ghost" onClick={() => void revoke(a.email)}><X size={13} /> Remove</button></div>
        </div>
      ))}
    </div>
  )
}

const SETTING_LABELS: Record<string, string> = {
  SITE_URL: 'Site URL', ELECTION_MODE: 'Election mode', POSITIONS: 'Positions (JSON list)', STUDENT_EMAIL_DOMAINS: 'Student e-mail domains', BLOCKLIST: 'Extra blocked words', ADMIN_WHATSAPP: 'Admin WhatsApp', WA_GROUP_URL: 'WhatsApp group link (https://chat.whatsapp.com/...)',
  NEWS_RSS_URLS: 'News RSS feed links (https, comma separated)', AUTO_PURGE_DAYS: 'Auto-clean confessions after N days (empty = off)',
  PAY_PHONE: 'M-Pesa number students pay to activate (254184198432)', CONFESSION_FEE: 'One-time activation fee in KSh (default 30)', CONFESSION_PAID_ONLY: 'Only activated accounts can post',
}
function Settings() {
  const { data, err, loading } = useLoad(() => oz<Record<string, string | boolean>>('admin_settings_get'), [])
  const [vals, setVals] = useState<Record<string, string> | null>(null)
  const { msg, bad, save } = useSave()
  if (loading && !data) return <p className="cpl-empty">Loading…</p>
  if (err) return <Err msg={err} />
  const cur = vals ?? Object.fromEntries(Object.keys(SETTING_LABELS).map((k) => [k, String(data?.[k] ?? '')]))
  const set = (k: string, v: string) => setVals({ ...cur, [k]: v })
  return (
    <form className="cpl-form oz-form" onSubmit={(e) => { e.preventDefault(); void save('admin_settings_save', { values: cur }) }}>
      <p className="cpl-sub oz-small">Firebase key: {data?.FIREBASE_CONFIGURED ? 'set' : <b className="oz-over">missing</b>} · Image check (Vision): {data?.VISION_CONFIGURED ? 'on' : 'off'} · GNews key: {data?.NEWS_CONFIGURED ? 'set' : 'not set'}</p>
      {Object.entries(SETTING_LABELS).map(([k, l]) => k === 'ELECTION_MODE' || k === 'CONFESSION_PAID_ONLY'
        ? <label key={k} className="cpl-file"><input type="checkbox" checked={cur[k] === 'true'} onChange={(e) => set(k, e.target.checked ? 'true' : 'false')} /> {l}{k === 'ELECTION_MODE' ? ' (shows aspirants on faculty pages)' : ' (switches off free posting)'}</label>
        : <label key={k}>{l}<input type="text" value={cur[k] ?? ''} onChange={(e) => set(k, e.target.value)} /></label>)}
      <Msg msg={msg} bad={bad} /><button className="lp-btn">Save settings</button>
    </form>
  )
}

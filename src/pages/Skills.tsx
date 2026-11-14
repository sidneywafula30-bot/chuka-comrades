import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import type { User } from 'firebase/auth'
import { BookOpen, CalendarDays, CalendarPlus, CheckCircle2, ExternalLink, GraduationCap, Link2, MessageCircle, Pencil, Play, Plus, Search, ShieldCheck, ThumbsUp, Trash2, Users, Video } from 'lucide-react'
import { skillsApi, skillsReady, ADMIN_WA, FALLBACK_CONFIG, type ClassDetail, type ClassItem, type Mode, type Rec, type SkillsConfig, type UpcomingSession, type YtResponse } from '../lib/skills'
import { COURSE_PROVIDERS, PROVIDER_TYPES, providerLink } from '../lib/courseProviders'
import ProviderLogo from '../components/ProviderLogo'
import { errMsg, fmtDate, packFiles, type Note } from '../lib/hub'
import { AttachList, Empty, FilePicker, HubShell, Loading, Modal, Msg, StatusBadge } from '../components/HubUi'

type Props = { user: User | null; onSignIn: () => void; onBack: () => void }
type View = { name: 'learn' | 'classes' | 'teach' | 'admin' } | { name: 'class'; id: string }
const call = skillsApi.call

/* ---------- recommendations ---------- */
function RecCard({ r, user, onSignIn, onError, children }: { r: Rec; user: User | null; onSignIn: () => void; onError: (m: string) => void; children?: ReactNode }) {
  const [votes, setVotes] = useState(r.votes)
  const [mine, setMine] = useState(r.myVote)
  const [play, setPlay] = useState(false)
  async function vote() {
    if (!user) return onSignIn()
    try { const v = await skillsApi.vote(r.id); setVotes(v.votes); setMine(!mine) } catch (e) { onError(errMsg(e)) }
  }
  return (
    <article className="sl-resource">
      <div className="sl-resource-top">
        <span className="sl-chip">{r.kind === 'video' ? 'Video' : 'Course'}</span><span className="sl-chip">{r.skill}</span>
        {r.kind === 'course' && r.isFree === 'yes' && <span className="hub-pay">Free</span>}
        {r.status !== 'approved' && <StatusBadge s={r.status} />}
      </div>
      {r.kind === 'video' && r.videoId && (play
        ? <iframe className="hub-video" src={`https://www.youtube-nocookie.com/embed/${r.videoId}?autoplay=1`} title={r.title} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
        : r.thumbnail ? <img className="hub-thumb" src={r.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" onClick={() => setPlay(true)} /> : null)}
      <h3>{r.title}</h3>
      <small className="sl-unitline">{r.kind === 'video' ? r.channel : r.provider}{r.category ? ` · ${r.category}` : ''}</small>
      <p>{r.reason}</p>
      {r.status === 'rejected' && r.rejectReason && <p className="sl-reject">Reason: {r.rejectReason}</p>}
      <small className="sl-sub">Recommended by {r.userName || 'a comrade'}{r.userEmail ? ` · ${r.userEmail}` : ''} · {fmtDate(r.createdAt)}</small>
      <div className="sl-resource-foot"><span className="sl-foot-actions">
        {r.status === 'approved' && <button className={`hub-vote ${mine ? 'on' : ''}`} onClick={vote}><ThumbsUp size={14} /> {votes}</button>}
        {r.kind === 'video' && r.videoId && !play && <button className="sl-mini" onClick={() => setPlay(true)}><Play size={13} /> Watch here</button>}
        <a className="sl-mini ghost" href={r.url} target="_blank" rel="noreferrer noopener"><ExternalLink size={13} /> Open</a>
        {children}
      </span></div>
    </article>
  )
}

function RecModal({ config, prefill, onClose, onDone }: { config: SkillsConfig; prefill?: { url: string; title: string }; onClose: () => void; onDone: () => void }) {
  const [kind, setKind] = useState<'video' | 'course'>('video')
  const [url, setUrl] = useState(prefill?.url ?? '')
  const [title, setTitle] = useState(prefill?.title ?? '')
  const [skill, setSkill] = useState('')
  const [category, setCategory] = useState(config.categories[0] ?? 'Other')
  const [reason, setReason] = useState('')
  const [provider, setProvider] = useState('')
  const [isFree, setIsFree] = useState('unsure')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<Note>(null)
  const [done, setDone] = useState(false)
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setMsg(null)
    try {
      await skillsApi.submitRec({ kind, url: url.trim(), title: title.trim(), skill: skill.trim(), category, reason: reason.trim(), ...(kind === 'course' ? { provider: provider.trim(), isFree } : {}) })
      setDone(true); onDone()
    } catch (err) { setMsg({ type: 'err', text: errMsg(err) }) } finally { setBusy(false) }
  }
  if (done) return <Modal title="Thank you!" onClose={onClose}><div className="sl-done"><CheckCircle2 size={34} /><p>Your recommendation will appear once an admin approves it. Track it under <strong>My skills</strong>.</p><button className="sl-primary" onClick={onClose}>Done</button></div></Modal>
  return (
    <Modal title="Recommend a video or course" onClose={onClose}>
      <form className="sl-form" onSubmit={submit}>
        <div className="hub-chips"><button type="button" className={kind === 'video' ? 'on' : ''} onClick={() => setKind('video')}>YouTube video</button><button type="button" className={kind === 'course' ? 'on' : ''} onClick={() => setKind('course')}>Online course</button></div>
        <label>{kind === 'video' ? 'YouTube link' : 'Course link'}<input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" /></label>
        {kind === 'course' ? (
          <>
            <label>Course title<input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} /></label>
            <div className="sl-two">
              <label>Provider<input value={provider} onChange={(e) => setProvider(e.target.value)} placeholder="e.g. Coursera, freeCodeCamp" maxLength={60} /></label>
              <label>Is it free?<select value={isFree} onChange={(e) => setIsFree(e.target.value)}><option value="yes">Yes, free</option><option value="no">Paid</option><option value="unsure">Not sure</option></select></label>
            </div>
          </>
        ) : <label>Video title (only if it does not fill in automatically)<input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} /></label>}
        <div className="sl-two">
          <label>Skill<input value={skill} onChange={(e) => setSkill(e.target.value)} placeholder="e.g. Python, Photoshop" maxLength={60} /></label>
          <label>Category<select value={category} onChange={(e) => setCategory(e.target.value)}>{config.categories.map((c) => <option key={c}>{c}</option>)}</select></label>
        </div>
        <label>Why is it helpful?<textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} /></label>
        <Msg msg={msg} />
        <button className="sl-primary" disabled={busy}>{busy ? 'Sending…' : 'Send for approval'}</button>
      </form>
    </Modal>
  )
}

function Learn({ user, onSignIn, config, onRecommend }: { user: User | null; onSignIn: () => void; config: SkillsConfig; onRecommend: (p?: { url: string; title: string }) => void }) {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [kind, setKind] = useState('')
  const [items, setItems] = useState<Rec[] | null>(null)
  const [msg, setMsg] = useState<Note>(null)
  const [yq, setYq] = useState('')
  const [yres, setYres] = useState<YtResponse | null>(null)
  const [ybusy, setYbusy] = useState(false)
  const load = useCallback(() => {
    if (!skillsReady) { setItems([]); return }
    skillsApi.recs({ q: q.trim(), category: cat, kind }).then(setItems).catch((e) => { setMsg({ type: 'err', text: errMsg(e) }); setItems([]) })
  }, [q, cat, kind])
  useEffect(() => { load() }, [load, user])
  async function ytSearch(e: FormEvent) {
    e.preventDefault()
    if (!user) return onSignIn()
    setYbusy(true); setMsg(null); setYres(null)
    try { setYres(await skillsApi.ytSearch(yq.trim())) } catch (err) { setMsg({ type: 'err', text: errMsg(err) }) } finally { setYbusy(false) }
  }
  const ytLink = `https://www.youtube.com/results?search_query=${encodeURIComponent(`${yq.trim()} tutorial`)}`
  return (
    <>
      <section className="sl-hero">
        <div><span className="sl-kicker">CHUKA SKILLS</span><h1>Learn a skill <em>from comrades, free courses &amp; videos</em></h1>
          <p>Browse videos and courses recommended by students, join a class run by the Chuka Skills team, or search free courses from 17 providers.</p></div>
        <div className="sl-hero-art"><GraduationCap size={46} /><span>Grow your skills</span></div>
      </section>
      <div className="hub-bar">
        <form className="sl-search" onSubmit={(e) => { e.preventDefault(); load() }}><Search size={18} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search recommended videos and courses, e.g. Excel, guitar, Python…" /></form>
        <button className="sl-primary small" onClick={user ? () => onRecommend() : onSignIn}><Plus size={15} /> Recommend</button>
      </div>
      <div className="hub-chips">
        {[['', 'All'], ['video', 'Videos'], ['course', 'Courses']].map(([k, l]) => <button key={k} className={kind === k ? 'on' : ''} onClick={() => setKind(k)}>{l}</button>)}
        <select value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Category" style={{ borderRadius: 999, border: '1px solid #d6e4db', padding: '7px 12px', font: 'inherit', fontSize: 13 }}>
          <option value="">All categories</option>{config.categories.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>
      <Msg msg={msg} />
      {!items ? <Loading /> : items.length === 0 ? <Empty icon={<Video size={26} />} title="Nothing recommended yet" text="Recommend a helpful video or course, or search below." /> : (
        <div className="sl-grid">{items.map((r) => <RecCard key={r.id} r={r} user={user} onSignIn={onSignIn} onError={(m) => setMsg({ type: 'err', text: m })} />)}</div>
      )}

      <div className="hub-sec"><h2>Search YouTube</h2></div>
      <form className="sl-search" onSubmit={ytSearch}><Search size={18} /><input value={yq} onChange={(e) => setYq(e.target.value)} placeholder="Search tutorials, e.g. “graphic design for beginners”" />
        <button className="sl-primary small" disabled={ybusy || yq.trim().length < 2}>{ybusy ? '…' : 'Search'}</button></form>
      {yq.trim().length >= 2 && <p className="sl-sub" style={{ marginTop: 8 }}>Or <a className="sl-link" href={ytLink} target="_blank" rel="noreferrer noopener">open this search on YouTube <ExternalLink size={12} /></a></p>}
      {yres?.error && <p className="sl-alert err" style={{ marginTop: 10 }}>{yres.error} <a className="sl-link" href={yres.fallbackUrl} target="_blank" rel="noreferrer noopener">Search on YouTube <ExternalLink size={12} /></a></p>}
      {yres && !yres.error && (yres.items.length === 0 ? <Empty title="No videos found" /> : (
        <div className="sl-grid" style={{ marginTop: 14 }}>{yres.items.map((v) => (
          <article className="sl-resource" key={v.videoId}>
            <a href={`https://www.youtube.com/watch?v=${v.videoId}`} target="_blank" rel="noreferrer noopener">{v.thumbnail && <img className="hub-thumb" src={v.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" />}</a>
            <h3>{v.title}</h3><small className="sl-unitline">{v.channel}</small>
            <div className="sl-resource-foot"><span /><span className="sl-foot-actions"><button className="sl-mini" onClick={() => (user ? onRecommend({ url: `https://www.youtube.com/watch?v=${v.videoId}`, title: v.title }) : onSignIn())}>Recommend this</button></span></div>
          </article>))}</div>
      ))}

      <CourseFinder />
    </>
  )
}

/* ---------- free course finder (any topic, 17 providers, official logos) ---------- */
const TOPICS = ['Python', 'Excel', 'Accounting', 'Public health', 'Graphic design', 'Data science', 'English']
function CourseFinder() {
  const [q, setQ] = useState('')
  const [type, setType] = useState<string>('All types')
  const list = COURSE_PROVIDERS.filter((p) => type === 'All types' || p.type === type)
  const phrase = q.trim()
  return (
    <>
      <div className="hub-sec"><h2>Find free online courses</h2></div>
      <p className="sl-sub" style={{ marginTop: 0 }}>Type any topic, then open it on the providers below. Each card opens that provider’s own search, so results are always current.</p>
      <div className="hub-bar">
        <div className="sl-search"><Search size={18} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Any topic, e.g. data science, nursing, welding safety…" maxLength={100} aria-label="Course topic" /></div>
        <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Provider type" style={{ borderRadius: 999, border: '1px solid #d6e4db', padding: '8px 12px', font: 'inherit', fontSize: 13 }}>
          {PROVIDER_TYPES.map((t) => <option key={t}>{t}</option>)}
        </select>
      </div>
      <div className="hub-chips">{TOPICS.map((t) => <button key={t} className={phrase.toLowerCase() === t.toLowerCase() ? 'on' : ''} onClick={() => setQ(t)}>{t}</button>)}</div>
      <div className="sl-grid">{list.map((p) => {
        const l = providerLink(p, phrase)
        return (
          <a key={p.id} className="cf-card" href={l.href} target="_blank" rel="noreferrer noopener">
            <div className="cf-head"><ProviderLogo p={p} /><div><strong>{p.name}</strong><span className="sl-chip">{p.type}</span></div></div>
            <p>{p.about}</p>
            <small className="cf-access">{p.access}</small>
            <span className="cf-go">{l.mode === 'browse' ? 'Browse catalogue' : l.mode === 'search' ? `Search “${phrase}”` : `Search “${phrase}” via Google`} <ExternalLink size={13} /></span>
          </a>
        )
      })}</div>
      <p className="sl-sub" style={{ marginTop: 12 }}>Chuka Skills links to these providers; it does not host their courses. Some courses are free only to study, with certificates, graded work or extended access paid. Check the price and terms before you enrol. Logos belong to their owners.</p>
    </>
  )
}

/* ---------- classes ---------- */
const fmtWhen = (s: string) => (s ? new Date(s).toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Nairobi' }) : '')
const isoGcal = (s: string) => new Date(s).toISOString().replace(/[-:]|\.\d{3}/g, '')
/** "Add to my Google Calendar" link. Works for anyone, no sign-in with Google Calendar needed. */
const gcalUrl = (title: string, startAt: string, endAt: string, details: string, location: string) =>
  `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${isoGcal(startAt)}/${isoGcal(endAt)}&details=${encodeURIComponent(details)}&location=${encodeURIComponent(location)}`
const nextSession = (c: ClassItem) => (c.sessions ?? []).find((s) => new Date(s.endAt).getTime() >= Date.now())

function WaRequest({ wa, className = 'sl-primary small' }: { wa: string; className?: string }) {
  const text = 'Hello Chuka Comrades admin, I would like to teach a class on Chuka Skills.\n\nSkill:\nLevel (beginner / intermediate / advanced):\nOnline or in person:\nPreferred days and time:'
  return <a className={className} href={`https://wa.me/${wa}?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer noopener"><MessageCircle size={15} /> Request a class on WhatsApp</a>
}

function ClassCard({ c, onOpen, children }: { c: ClassItem; onOpen?: (id: string) => void; children?: ReactNode }) {
  const next = nextSession(c)
  return (
    <article className="sl-resource">
      <div className="sl-resource-top"><span className="sl-chip">{c.skill}</span><span className="sl-chip">{c.level}</span><span className="sl-chip">{c.mode}</span>{c.status !== 'approved' && <StatusBadge s={c.status} />}</div>
      <h3>{c.title}</h3>
      <div className="hub-meta"><span>By {c.tutorName || 'a comrade'}{c.tutorEmail ? ` · ${c.tutorEmail}` : ''}</span>{c.schedule && <span>{c.schedule}</span>}{next && <span><CalendarDays size={13} /> Next: {fmtWhen(next.startAt)}</span>}<span><Users size={13} /> {c.memberCount}/{c.capacity}</span></div>
      <p>{c.description.length > 180 ? `${c.description.slice(0, 180)}…` : c.description}</p>
      {c.status === 'rejected' && c.rejectReason && <p className="sl-reject">Reason: {c.rejectReason}</p>}
      <div className="sl-resource-foot"><span /><span className="sl-foot-actions">{onOpen && <button className="sl-mini" onClick={() => onOpen(c.id)}>Open class</button>}{children}</span></div>
    </article>
  )
}

function ClassModal({ cls, config, admin, onClose, onDone }: { cls?: ClassItem; config: SkillsConfig; admin: boolean; onClose: () => void; onDone: () => void }) {
  const [title, setTitle] = useState(cls?.title ?? '')
  const [skill, setSkill] = useState(cls?.skill ?? '')
  const [category, setCategory] = useState(cls?.category ?? config.categories[0] ?? 'Other')
  const [level, setLevel] = useState(cls?.level ?? 'All levels')
  const [description, setDescription] = useState(cls?.description ?? '')
  const [mode, setMode] = useState<Mode>(cls?.mode ?? 'online')
  const [venue, setVenue] = useState(cls?.venue ?? '')
  const [schedule, setSchedule] = useState(cls?.schedule ?? '')
  const [startDate, setStartDate] = useState(cls?.startDate ?? '')
  const [capacity, setCapacity] = useState(String(cls?.capacity ?? 30))
  const [joinLink, setJoinLink] = useState(cls?.joinLink ?? '')
  const [tutorName, setTutorName] = useState(cls?.tutorName ?? '')
  const [meetSpace, setMeetSpace] = useState(cls?.meetSpace ?? '')
  const [sStart, setSStart] = useState('')
  const [sMins, setSMins] = useState('60')
  const [files, setFiles] = useState<File[]>([])
  const [removeIds, setRemoveIds] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [meetBusy, setMeetBusy] = useState(false)
  const [msg, setMsg] = useState<Note>(null)
  const [done, setDone] = useState<string | null>(null)
  async function makeMeet() {
    setMeetBusy(true); setMsg(null)
    try {
      const m = await skillsApi.admin.createMeet(); setJoinLink(m.meetingUri); setMeetSpace(m.space)
      setMsg({ type: 'ok', text: m.open ? 'Google Meet link created. Anyone with the link can join.' : 'Google Meet link created. Google did not allow open access, so you will need to admit students when they join.' })
    } catch (err) { setMsg({ type: 'err', text: errMsg(err) }) } finally { setMeetBusy(false) }
  }
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setMsg(null)
    try {
      const input = { id: cls?.id, title: title.trim(), skill: skill.trim(), category, level, description: description.trim(), mode, venue: venue.trim(), schedule: schedule.trim(),
        startDate, capacity: Number(capacity), joinLink: joinLink.trim(), files: await packFiles(files, config.files), removeFileIds: removeIds }
      if (!admin) { await skillsApi.saveClass(input); setDone('Your class is waiting for an admin to approve it.'); onDone(); return }
      const saved = await skillsApi.admin.saveClass({ ...input, tutorName: tutorName.trim(), meetSpace })
      let note = cls ? 'Your changes are live.' : 'The class is live. Students can find and join it now.'
      if (!cls && sStart) {
        try {
          const r = await skillsApi.admin.addSession({ classId: saved.id, start: sStart, minutes: Number(sMins) })
          note += r.warning ? ` ${r.warning}` : ' The first session was added to your Google Calendar.'
        } catch (err) { note += ` The class was saved, but the session was not added: ${errMsg(err)} Add it from the class page.` }
      }
      setDone(note); onDone()
    } catch (err) { setMsg({ type: 'err', text: errMsg(err) }) } finally { setBusy(false) }
  }
  if (done) return <Modal title={admin ? 'Saved' : 'Sent for approval'} onClose={onClose}><div className="sl-done"><CheckCircle2 size={34} /><p>{done}</p><button className="sl-primary" onClick={onClose}>Done</button></div></Modal>
  return (
    <Modal title={cls ? 'Edit class' : 'Create a class'} onClose={onClose}>
      <form className="sl-form" onSubmit={submit}>
        {cls && !admin && <p className="hub-warn">Saving changes sends this class back for admin approval.</p>}
        <label>Class title<input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} placeholder="e.g. Excel for beginners" /></label>
        <div className="sl-two">
          <label>Skill taught<input value={skill} onChange={(e) => setSkill(e.target.value)} maxLength={60} placeholder="e.g. Microsoft Excel" /></label>
          <label>Category<select value={category} onChange={(e) => setCategory(e.target.value)}>{config.categories.map((c) => <option key={c}>{c}</option>)}</select></label>
        </div>
        {admin && <label>Taught by (shown to students)<input value={tutorName} onChange={(e) => setTutorName(e.target.value)} maxLength={60} placeholder="Tutor’s name; leave empty to use your own" /></label>}
        <label>What will students learn?<textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1500} /></label>
        <div className="sl-two">
          <label>Level<select value={level} onChange={(e) => setLevel(e.target.value)}>{config.levels.map((l) => <option key={l}>{l}</option>)}</select></label>
          <label>Format<select value={mode} onChange={(e) => setMode(e.target.value as Mode)}><option value="online">Online</option><option value="physical">In person</option><option value="hybrid">Hybrid</option></select></label>
        </div>
        {mode !== 'online' && <label>Venue<input value={venue} onChange={(e) => setVenue(e.target.value)} maxLength={100} placeholder="e.g. Library, Room 3" /></label>}
        {mode !== 'physical' && (
          <label>Class link (Google Meet, Zoom or a WhatsApp group)
            <span className="cf-linkrow"><input type="url" value={joinLink} onChange={(e) => setJoinLink(e.target.value)} placeholder="https://" />
              {admin && <button type="button" className="sl-mini" disabled={meetBusy} onClick={makeMeet}><Video size={13} /> {meetBusy ? 'Creating…' : 'Create Meet link'}</button>}</span>
          </label>
        )}
        <div className="sl-two">
          <label>Schedule (text students see)<input value={schedule} onChange={(e) => setSchedule(e.target.value)} maxLength={150} placeholder="e.g. Saturdays 2-4pm" /></label>
          <label>Starts (optional)<input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></label>
        </div>
        {admin && !cls && (
          <div className="cf-box">
            <strong><CalendarPlus size={15} /> First session (optional)</strong>
            <small>Adds an event to your Google Calendar and shows it to students. You can add more sessions later from the class page.</small>
            <div className="sl-two">
              <label>Date and time (Nairobi)<input type="datetime-local" value={sStart} onChange={(e) => setSStart(e.target.value)} /></label>
              <label>Length<select value={sMins} onChange={(e) => setSMins(e.target.value)}>{[30, 45, 60, 90, 120, 180].map((m) => <option key={m} value={m}>{m} minutes</option>)}</select></label>
            </div>
          </div>
        )}
        <label>Maximum students<input type="number" min={2} max={200} value={capacity} onChange={(e) => setCapacity(e.target.value)} /></label>
        <FilePicker files={files} setFiles={setFiles} rules={config.files} onError={(m) => setMsg({ type: 'err', text: m })} existing={cls?.attachments} removeIds={removeIds} setRemoveIds={setRemoveIds} />
        <Msg msg={msg} />
        <button className="sl-primary" disabled={busy}>{busy ? 'Saving…' : admin ? (cls ? 'Save changes' : 'Publish class') : 'Submit for approval'}</button>
      </form>
    </Modal>
  )
}

function ClassPage({ id, user, onSignIn, config, isAdmin, tick, onEdit, onGone }: { id: string; user: User | null; onSignIn: () => void; config: SkillsConfig; isAdmin: boolean; tick: number; onEdit: (c: ClassItem) => void; onGone: () => void }) {
  const [d, setD] = useState<ClassDetail | null>(null)
  const [msg, setMsg] = useState<Note>(null)
  const [text, setText] = useState('')
  const [link, setLink] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  const [sStart, setSStart] = useState('')
  const [sMins, setSMins] = useState('60')
  const [sTitle, setSTitle] = useState('')
  const load = useCallback(() => skillsApi.classGet(id).then(setD).catch((e) => setMsg({ type: 'err', text: errMsg(e) })), [id])
  useEffect(() => { void load() }, [load, user, tick])
  const err = (e: unknown) => setMsg({ type: 'err', text: errMsg(e) })
  if (!d) return <><Msg msg={msg} />{!msg && <Loading />}</>
  const c = d.cls
  const run = async (fn: () => Promise<unknown>, ok?: string) => { setBusy(true); setMsg(null); try { await fn(); await load(); if (ok) setMsg({ type: 'ok', text: ok }) } catch (e) { err(e) } finally { setBusy(false) } }
  async function post(e: FormEvent) {
    e.preventDefault()
    await run(async () => { await skillsApi.post({ classId: c.id, text: text.trim(), link: link.trim(), files: await packFiles(files, config.files) }); setText(''); setLink(''); setFiles([]) }, 'Posted.')
  }
  async function addSession(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setMsg(null)
    try {
      const r = await skillsApi.admin.addSession({ classId: c.id, start: sStart, minutes: Number(sMins), title: sTitle.trim() || undefined })
      setSStart(''); setSTitle(''); await load()
      setMsg(r.warning ? { type: 'err', text: r.warning } : { type: 'ok', text: 'Session added to your Google Calendar.' })
    } catch (e2) { err(e2) } finally { setBusy(false) }
  }
  const now = Date.now()
  const upcoming = c.sessions.filter((s) => new Date(s.endAt).getTime() >= now)
  const past = c.sessions.filter((s) => new Date(s.endAt).getTime() < now)
  const where = c.mode === 'physical' ? c.venue : (c.joinLink ?? '')
  const details = `Chuka Skills class: ${c.title}.${c.joinLink ? ` Join: ${c.joinLink}` : ' Join the class on Chuka Comrades to see the link.'}`
  return (
    <>
      <div className="sl-page-head"><div><span className="sl-kicker">{c.skill.toUpperCase()}</span><h1>{c.title}</h1></div></div>
      <Msg msg={msg} />
      <article className="sl-resource">
        <div className="sl-resource-top"><span className="sl-chip">{c.level}</span><span className="sl-chip">{c.mode}</span><span className="sl-chip">{c.category}</span>{c.status !== 'approved' && <StatusBadge s={c.status} />}</div>
        <div className="hub-meta"><span>Tutor: {c.tutorName}</span>{c.schedule && <span>{c.schedule}</span>}{c.startDate && <span>Starts {fmtDate(c.startDate)}</span>}{c.venue && <span>{c.venue}</span>}<span><Users size={13} /> {c.memberCount}/{c.capacity} joined</span></div>
        <p style={{ whiteSpace: 'pre-wrap' }}>{c.description}</p>
        {c.joinLink && <div className="hub-contact"><Link2 size={15} /> <a href={c.joinLink} target="_blank" rel="noreferrer noopener">Open class link <ExternalLink size={13} /></a></div>}
        <AttachList items={c.attachments} call={call} onError={(m) => setMsg({ type: 'err', text: m })} />
        {c.status === 'approved' && !c.mine && !isAdmin && (c.joined
          ? <button className="sl-mini danger" disabled={busy} onClick={() => run(() => skillsApi.leave(c.id), 'You left the class.')}>Leave class</button>
          : <button className="sl-primary small" disabled={busy} onClick={() => (user ? run(() => skillsApi.join(c.id), 'You joined. The class link is now visible.') : onSignIn())}>{user ? 'Join this class' : 'Sign in to join'}</button>)}
        {isAdmin && <button className="sl-mini" onClick={() => onEdit(c)}><Pencil size={13} /> Edit class</button>}
      </article>

      {(c.sessions.length > 0 || isAdmin) && (
        <>
          <div className="hub-sec"><h2>Sessions</h2></div>
          {c.sessions.length === 0 && <Empty icon={<CalendarDays size={26} />} title="No sessions scheduled yet" text={isAdmin ? 'Add the first session below.' : 'The tutor has not scheduled a session yet.'} />}
          <div className="cf-sessions">
            {[...upcoming, ...past.reverse()].map((s) => {
              const isPast = new Date(s.endAt).getTime() < now
              return (
                <div className={`cf-sess ${isPast ? 'past' : ''}`} key={s.id}>
                  <b>{fmtWhen(s.startAt)}</b>
                  <span>{s.title}{s.note ? ` · ${s.note}` : ''}</span>
                  <span className="cf-sess-actions">
                    {!isPast && <a className="sl-mini ghost" href={gcalUrl(s.title, s.startAt, s.endAt, details, where)} target="_blank" rel="noreferrer noopener"><CalendarPlus size={13} /> Add to my calendar</a>}
                    {isAdmin && <button className="sl-mini danger" disabled={busy} onClick={() => run(() => skillsApi.admin.deleteSession(s.id), 'Session removed.')}><Trash2 size={13} /></button>}
                  </span>
                </div>
              )
            })}
          </div>
          {isAdmin && (
            <form className="sl-form cf-box" onSubmit={addSession}>
              <strong><CalendarPlus size={15} /> Add a session</strong>
              <small>Creates an event on your Google Calendar with the class link.</small>
              <div className="sl-two">
                <label>Date and time (Nairobi)<input type="datetime-local" value={sStart} onChange={(e) => setSStart(e.target.value)} required /></label>
                <label>Length<select value={sMins} onChange={(e) => setSMins(e.target.value)}>{[30, 45, 60, 90, 120, 180].map((m) => <option key={m} value={m}>{m} minutes</option>)}</select></label>
              </div>
              <label>Title (optional)<input value={sTitle} onChange={(e) => setSTitle(e.target.value)} maxLength={100} placeholder={c.title} /></label>
              <button className="sl-primary small" disabled={busy || !sStart}>{busy ? 'Adding…' : 'Add session'}</button>
            </form>
          )}
        </>
      )}

      {(c.joined || c.mine || isAdmin || d.posts.length > 0 || d.members.length > 0) && (
        <>
          <div className="hub-sec"><h2>Classroom</h2></div>
          {(c.mine || isAdmin) && (
            <form className="sl-form" onSubmit={post}>
              <label>Post to your class<textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} placeholder="Announcements, homework, notes…" /></label>
              <label>Link (optional)<input type="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://" /></label>
              <FilePicker files={files} setFiles={setFiles} rules={config.files} onError={(m) => setMsg({ type: 'err', text: m })} />
              <button className="sl-primary small" disabled={busy || (!text.trim() && !link.trim() && !files.length)}>{busy ? 'Posting…' : 'Post'}</button>
            </form>
          )}
          {d.posts.length === 0 ? <Empty title="No posts yet" text={c.mine || isAdmin ? 'Share your first lesson or announcement above.' : 'Your tutor has not posted yet.'} /> : d.posts.map((p) => (
            <div className="hub-post" key={p.id}>
              <small className="sl-sub">{p.authorName} · {fmtDate(p.createdAt)}</small>
              {p.text && <p>{p.text}</p>}
              {p.link && <a className="sl-link" href={p.link} target="_blank" rel="noreferrer noopener"><ExternalLink size={14} /> {p.link}</a>}
              <AttachList items={p.attachments} call={call} onError={(m) => setMsg({ type: 'err', text: m })} />
              {(c.mine || isAdmin || p.mine) && <button className="sl-mini danger" onClick={() => run(() => skillsApi.deletePost(p.id))}><Trash2 size={13} /> Delete</button>}
            </div>
          ))}
          {d.members.length > 0 && <details style={{ marginTop: 16 }}><summary className="sl-sub">Students ({d.members.length})</summary><ul className="sl-picked">{d.members.map((m, i) => <li key={i}>{m.name || 'Student'} · {m.email}</li>)}</ul></details>}
        </>
      )}
      {(c.mine || isAdmin) && <p style={{ marginTop: 18 }}><button className="sl-mini danger" onClick={async () => { if (window.confirm('Delete this class, its sessions and everything in it?')) { try { await skillsApi.deleteClass(c.id); onGone() } catch (e) { err(e) } } }}><Trash2 size={13} /> Delete class</button></p>}
    </>
  )
}

function Classes({ user, config, isAdmin, onOpen, onCreate }: { user: User | null; config: SkillsConfig; isAdmin: boolean; onOpen: (id: string) => void; onCreate: () => void }) {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [items, setItems] = useState<ClassItem[] | null>(null)
  const [up, setUp] = useState<UpcomingSession[]>([])
  const [msg, setMsg] = useState<Note>(null)
  const load = useCallback(() => {
    if (!skillsReady) { setItems([]); return }
    skillsApi.classes(q.trim(), cat).then(setItems).catch((e) => { setMsg({ type: 'err', text: errMsg(e) }); setItems([]) })
  }, [q, cat])
  useEffect(() => { load() }, [load, user])
  useEffect(() => { if (skillsReady) skillsApi.upcoming().then(setUp).catch(() => setUp([])) }, [])
  return (
    <>
      <div className="sl-page-head"><div><span className="sl-kicker">CLASSES</span><h1>Join a class</h1></div></div>
      <div className="hub-bar">
        <form className="sl-search" onSubmit={(e) => { e.preventDefault(); load() }}><Search size={18} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search classes…" /></form>
        {isAdmin || config.allowTutorCreate
          ? <button className="sl-primary small" onClick={onCreate}><Plus size={15} /> {isAdmin ? 'Create class' : 'Teach a skill'}</button>
          : <WaRequest wa={config.whatsapp} />}
      </div>
      <div className="hub-chips"><button className={cat === '' ? 'on' : ''} onClick={() => setCat('')}>All</button>{config.categories.map((c) => <button key={c} className={cat === c ? 'on' : ''} onClick={() => setCat(c)}>{c}</button>)}</div>
      <Msg msg={msg} />
      {up.length > 0 && (
        <>
          <div className="hub-sec"><h2>Upcoming sessions</h2></div>
          <div className="cf-sessions">{up.slice(0, 6).map((s) => (
            <div className="cf-sess" key={s.id}>
              <b>{fmtWhen(s.startAt)}</b>
              <span>{s.classTitle}{s.title !== s.classTitle ? ` · ${s.title}` : ''}<small className="sl-sub"> · {s.mode}{s.venue ? ` · ${s.venue}` : ''}</small></span>
              <span className="cf-sess-actions">
                <button className="sl-mini" onClick={() => onOpen(s.classId)}>Open class</button>
                <a className="sl-mini ghost" href={gcalUrl(s.title, s.startAt, s.endAt, `Chuka Skills class: ${s.classTitle}. Join the class on Chuka Comrades to see the link.`, s.venue)} target="_blank" rel="noreferrer noopener"><CalendarPlus size={13} /> Add to my calendar</a>
              </span>
            </div>))}</div>
        </>
      )}
      <div className="hub-sec"><h2>All classes</h2></div>
      {!items ? <Loading /> : items.length === 0 ? <Empty icon={<BookOpen size={26} />} title="No classes yet" text={isAdmin ? 'Create the first class.' : 'Want to teach something? Request a class on WhatsApp.'} /> : <div className="sl-grid">{items.map((c) => <ClassCard key={c.id} c={c} onOpen={onOpen} />)}</div>}
    </>
  )
}

function Teach({ user, onSignIn, config, isAdmin, tick, onOpen, onCreate, onEdit }: { user: User | null; onSignIn: () => void; config: SkillsConfig; isAdmin: boolean; tick: number; onOpen: (id: string) => void; onCreate: () => void; onEdit: (c: ClassItem) => void }) {
  const [data, setData] = useState<{ teaching: ClassItem[]; joined: ClassItem[]; recs: Rec[] } | null>(null)
  const [msg, setMsg] = useState<Note>(null)
  const load = useCallback(() => skillsApi.mine().then(setData).catch((e) => { setMsg({ type: 'err', text: errMsg(e) }); setData({ teaching: [], joined: [], recs: [] }) }), [])
  useEffect(() => { if (user) void load() }, [user, load, tick])
  if (!user) return <><Empty title="Sign in to see your skills" text="Classes you joined and your recommendations appear here." /><p style={{ textAlign: 'center' }}><button className="sl-primary" onClick={onSignIn}>Sign in</button></p></>
  const canCreate = isAdmin || config.allowTutorCreate
  return (
    <>
      <div className="sl-page-head"><div><span className="sl-kicker">YOUR ACCOUNT</span><h1>My skills</h1></div></div>
      <Msg msg={msg} />
      {!data ? <Loading /> : (
        <>
          {(canCreate || data.teaching.length > 0) && (
            <>
              <div className="hub-sec"><h2>Classes I teach</h2>{canCreate && <button className="sl-primary small" onClick={onCreate}><Plus size={15} /> Create a class</button>}</div>
              {data.teaching.length === 0 ? <Empty title="You are not teaching yet" /> : (
                <div className="sl-grid">{data.teaching.map((c) => <ClassCard key={c.id} c={c} onOpen={onOpen}>{canCreate && <button className="sl-mini" onClick={() => onEdit(c)}><Pencil size={13} /> Edit</button>}</ClassCard>)}</div>
              )}
            </>
          )}
          {!canCreate && <div className="cf-box"><strong>Want to teach a class?</strong><small>Chuka Skills classes are set up by the admin. Message the admin on WhatsApp with the skill, level and times you have in mind.</small><WaRequest wa={config.whatsapp} /></div>}
          <div className="hub-sec"><h2>Classes I joined</h2></div>
          {data.joined.length === 0 ? <Empty title="You have not joined a class" /> : <div className="sl-grid">{data.joined.map((c) => <ClassCard key={c.id} c={c} onOpen={onOpen} />)}</div>}
          <div className="hub-sec"><h2>My recommendations</h2></div>
          {data.recs.length === 0 ? <Empty title="No recommendations yet" /> : <div className="sl-grid">{data.recs.map((r) => <RecCard key={r.id} r={r} user={user} onSignIn={onSignIn} onError={(m) => setMsg({ type: 'err', text: m })} />)}</div>}
        </>
      )}
    </>
  )
}

/* ---------- admin ---------- */
function Admin({ tick, onNew, onEdit, onOpen }: { tick: number; onNew: () => void; onEdit: (c: ClassItem) => void; onOpen: (id: string) => void }) {
  const [tab, setTab] = useState<'classes' | 'recs' | 'all'>('all')
  const [q, setQ] = useState<{ classes: ClassItem[]; recs: Rec[] } | null>(null)
  const [all, setAll] = useState<ClassItem[] | null>(null)
  const [reasons, setReasons] = useState<Record<string, string>>({})
  const [msg, setMsg] = useState<Note>(null)
  const err = (e: unknown) => setMsg({ type: 'err', text: errMsg(e) })
  const loadQ = useCallback(() => skillsApi.admin.queue().then(setQ).catch(err), [])
  const loadAll = useCallback(() => skillsApi.admin.classes().then(setAll).catch((e) => { err(e); setAll([]) }), [])
  useEffect(() => { void loadQ() }, [loadQ, tick])
  useEffect(() => { if (tab === 'all') void loadAll() }, [tab, loadAll, tick])
  const noop = () => {}
  const decide = (kind: 'class' | 'rec', id: string, d: 'approve' | 'reject') =>
    (kind === 'class' ? skillsApi.admin.reviewClass(id, d, reasons[id]?.trim()) : skillsApi.admin.reviewRec(id, d, reasons[id]?.trim()))
      .then(() => { setMsg({ type: 'ok', text: d === 'approve' ? 'Approved.' : 'Rejected.' }); return loadQ() }).catch(err)
  const box = (id: string) => <input placeholder="Reason (if rejecting)" value={reasons[id] ?? ''} onChange={(e) => setReasons({ ...reasons, [id]: e.target.value })} />
  return (
    <>
      <div className="sl-page-head"><div><span className="sl-kicker">ADMIN</span><h1>Skills admin</h1></div></div>
      <div className="sl-tabs">
        <button className={tab === 'all' ? 'on' : ''} onClick={() => setTab('all')}>All classes</button>
        <button className={tab === 'recs' ? 'on' : ''} onClick={() => setTab('recs')}>Recommendations <b>{q?.recs.length ?? 0}</b></button>
        <button className={tab === 'classes' ? 'on' : ''} onClick={() => setTab('classes')}>Class requests <b>{q?.classes.length ?? 0}</b></button>
      </div>
      <Msg msg={msg} />
      {tab === 'classes' && (!q ? <Loading /> : q.classes.length === 0 ? <Empty icon={<CheckCircle2 size={26} />} title="No classes waiting" text="Classes made by tutors only appear here if tutor requests are switched on." /> : (
        <div className="sl-grid">{q.classes.map((c) => (
          <div key={c.id}><ClassCard c={c} />
            <AttachList items={c.attachments} call={call} onError={(m) => setMsg({ type: 'err', text: m })} />
            {c.joinLink && <p className="sl-sub">Join link: <a className="sl-link" href={c.joinLink} target="_blank" rel="noreferrer noopener">{c.joinLink}</a></p>}
            <span className="hub-decide">{box(c.id)}<button className="sl-mini" onClick={() => decide('class', c.id, 'approve')}>Approve</button><button className="sl-mini danger" onClick={() => decide('class', c.id, 'reject')}>Reject</button></span>
          </div>))}</div>
      ))}
      {tab === 'recs' && (!q ? <Loading /> : q.recs.length === 0 ? <Empty icon={<CheckCircle2 size={26} />} title="No recommendations waiting" /> : (
        <div className="sl-grid">{q.recs.map((r) => (
          <RecCard key={r.id} r={r} user={null} onSignIn={noop} onError={(m) => setMsg({ type: 'err', text: m })}>
            <span className="hub-decide">{box(r.id)}<button className="sl-mini" onClick={() => decide('rec', r.id, 'approve')}>Approve</button><button className="sl-mini danger" onClick={() => decide('rec', r.id, 'reject')}>Reject</button></span>
          </RecCard>))}</div>
      ))}
      {tab === 'all' && (
        <>
          <div className="hub-sec"><h2>Classes</h2><button className="sl-primary small" onClick={onNew}><Plus size={15} /> Create class</button></div>
          {!all ? <Loading /> : all.length === 0 ? <Empty title="No classes yet" text="Create the first class: add a Meet link and a session." /> : (
            <div className="sl-grid">{all.map((c) => (
              <ClassCard key={c.id} c={c} onOpen={onOpen}>
                <button className="sl-mini" onClick={() => onEdit(c)}><Pencil size={13} /> Edit</button>
                <button className="sl-mini danger" onClick={async () => { if (window.confirm(`Delete “${c.title}”, its sessions and all its posts?`)) { try { await skillsApi.admin.deleteClass(c.id); await loadAll() } catch (e) { err(e) } } }}><Trash2 size={13} /> Delete</button>
              </ClassCard>))}</div>
          )}
        </>
      )}
    </>
  )
}

/* ---------- shell ---------- */
export default function Skills({ user, onSignIn, onBack }: Props) {
  const [view, setView] = useState<View>({ name: 'learn' })
  const [config, setConfig] = useState<SkillsConfig>(FALLBACK_CONFIG)
  const [isAdmin, setIsAdmin] = useState(false)
  const [recOpen, setRecOpen] = useState<{ url: string; title: string } | 'new' | null>(null)
  const [classOpen, setClassOpen] = useState<ClassItem | 'new' | null>(null)
  const [tick, setTick] = useState(0)
  const [fatal, setFatal] = useState('')
  useEffect(() => { if (skillsReady) skillsApi.config().then((c) => setConfig({ ...FALLBACK_CONFIG, ...c, whatsapp: c.whatsapp || ADMIN_WA })).catch((e) => setFatal(errMsg(e))) }, [])
  useEffect(() => {
    setIsAdmin(false)
    if (skillsReady && user) skillsApi.adminCheck().then((r) => setIsAdmin(r.isAdmin)).catch(() => {})
  }, [user])
  useEffect(() => { window.scrollTo(0, 0) }, [view])
  const gated = (v: View) => (user ? setView(v) : onSignIn())
  const bump = () => setTick((n) => n + 1)
  const name = view.name
  const open = (id: string) => setView({ name: 'class', id })
  return (
    <HubShell name="Chuka Skills" sub="Chuka Comrades" logo="skills-logo.svg" backLabel={name === 'learn' ? 'Back to services' : 'Back'}
      onBack={() => (name === 'learn' ? onBack() : setView({ name: name === 'class' ? 'classes' : 'learn' }))}
      nav={<>
        <button className={name === 'learn' ? 'on' : ''} onClick={() => setView({ name: 'learn' })}>Learn</button>
        <button className={name === 'classes' || name === 'class' ? 'on' : ''} onClick={() => setView({ name: 'classes' })}>Classes</button>
        <button className={name === 'teach' ? 'on' : ''} onClick={() => gated({ name: 'teach' })}>My skills</button>
        {isAdmin && <button className={name === 'admin' ? 'on' : ''} onClick={() => setView({ name: 'admin' })}><ShieldCheck size={14} /> Admin</button>}
      </>}>
      {!skillsReady && <Msg msg={{ type: 'err', text: 'Skills server not connected yet. Add VITE_SKILLS_API_URL to .env and restart npm run dev.' }} />}
      {fatal && <Msg msg={{ type: 'err', text: fatal }} />}
      {view.name === 'learn' && <Learn user={user} onSignIn={onSignIn} config={config} onRecommend={(p) => setRecOpen(p ?? 'new')} />}
      {view.name === 'classes' && <Classes user={user} config={config} isAdmin={isAdmin} onOpen={open} onCreate={() => (user ? setClassOpen('new') : onSignIn())} />}
      {view.name === 'class' && <ClassPage id={view.id} user={user} onSignIn={onSignIn} config={config} isAdmin={isAdmin} tick={tick} onEdit={setClassOpen} onGone={() => setView({ name: 'classes' })} />}
      {view.name === 'teach' && <Teach user={user} onSignIn={onSignIn} config={config} isAdmin={isAdmin} tick={tick} onOpen={open} onCreate={() => setClassOpen('new')} onEdit={setClassOpen} />}
      {view.name === 'admin' && isAdmin && <Admin tick={tick} onNew={() => setClassOpen('new')} onEdit={setClassOpen} onOpen={open} />}
      {recOpen && <RecModal config={config} prefill={recOpen === 'new' ? undefined : recOpen} onClose={() => setRecOpen(null)} onDone={bump} />}
      {classOpen && <ClassModal cls={classOpen === 'new' ? undefined : classOpen} config={config} admin={isAdmin} onClose={() => setClassOpen(null)} onDone={bump} />}
    </HubShell>
  )
}

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import type { User } from 'firebase/auth'
import { BookOpen, CalendarDays, CalendarPlus, CheckCircle2, Download, ExternalLink, GraduationCap, Lightbulb, Link2, MessageCircle, Pencil, Play, Plus, Search, ShieldCheck, ShoppingBag, ThumbsUp, Trash2, Users, Video } from 'lucide-react'
import { skillsApi, skillsReady, ADMIN_WA, FALLBACK_CONFIG, type ClassDetail, type ClassItem, type Mode, type Rec, type SkillsConfig, type UpcomingSession, type YtResponse } from '../lib/skills'
import { pathById } from '../lib/learnPaths'
import { errMsg, fmtDate, packFiles, type Note } from '../lib/hub'
import { AttachList, Empty, FilePicker, HubShell, Loading, Modal, Msg, StatusBadge } from '../components/HubUi'
import { AdminOrders, AdminProducts, AdminSettings, Library, Shop } from './SkillsShop'
import { AccessPanel, AdminLive, ChannelShelf, LiveRoom } from './SkillsAccess'
import { AdminInbox, ChatRoom, StudentChat } from '../components/CitChat'
import CitMenu from '../components/CitMenu'
import CitAdminFab from '../components/CitAdminFab'
import { BlueskyStrip, BskyDm, bskyHandle } from '../components/Bluesky'
import { AdminBsky, CommunityTabs, Feed } from './SkillsFeed'
import VideoModal, { type PlayVideo } from '../components/VideoPlayer'
import { AdminHacks, HackPage, Hackathons } from './SkillsHack'
import { IdeasBoard } from './SkillsIdeas'
import { AdminSoftware, PathCards, PathPage, SoftwareList } from './SkillsLearn'
import '../components/Cit.css'

type Props = { user: User | null; onSignIn: () => void; onBack: () => void }
type View = { name: 'learn' | 'classes' | 'shop' | 'teach' | 'admin' | 'live' | 'chat' | 'software' | 'hackathons' | 'ideas' | 'feed' } | { name: 'class'; id: string } | { name: 'path'; id: string } | { name: 'hack'; id: string }
const call = skillsApi.call
const menuLabel: Record<string, string> = { learn: 'Learn', path: 'Learn', classes: 'Classes', class: 'Classes', live: 'Live', software: 'Software', feed: 'Community', hackathons: 'Community', hack: 'Community', ideas: 'Community', shop: 'Shop', chat: 'Messages', teach: 'My skills', admin: 'Admin' }

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
        {r.featured && <span className="hub-pay">Pick of the week</span>}
        {r.status !== 'approved' && <StatusBadge s={r.status} />}
      </div>
      {r.kind === 'video' && r.videoId && (play
        ? <iframe className="hub-video" src={`https://www.youtube-nocookie.com/embed/${r.videoId}?autoplay=1`} title={r.title} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
        : r.thumbnail ? <img className="hub-thumb" src={r.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" onClick={() => setPlay(true)} /> : null)}
      <h3>{r.title}</h3>
      <small className="sl-unitline">{r.kind === 'video' ? r.channel : r.provider}{r.category ? ` · ${r.category}` : ''}</small>
      <p>{r.reason}</p>
      {r.nextStep && <p className="cit-next"><b>Your next step:</b> {r.nextStep}</p>}
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
  const [nextStep, setNextStep] = useState('')
  const [provider, setProvider] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<Note>(null)
  const [done, setDone] = useState(false)
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setMsg(null)
    try {
      await skillsApi.submitRec({ kind, url: url.trim(), title: title.trim(), skill: skill.trim(), category, reason: reason.trim(), nextStep: nextStep.trim() || undefined, ...(kind === 'course' ? { provider: provider.trim() } : {}) })
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
            <label>Provider<input value={provider} onChange={(e) => setProvider(e.target.value)} placeholder="e.g. Coursera, Udemy" maxLength={60} /></label>
          </>
        ) : <label>Video title (only if it does not fill in automatically)<input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} /></label>}
        <div className="sl-two">
          <label>Skill<input value={skill} onChange={(e) => setSkill(e.target.value)} placeholder="e.g. Python, Photoshop" maxLength={60} /></label>
          <label>Category<select value={category} onChange={(e) => setCategory(e.target.value)}>{config.categories.map((c) => <option key={c}>{c}</option>)}</select></label>
        </div>
        <label>Why is it helpful?<textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} /></label>
        <label>Your next step (optional): what should people DO after watching?<input value={nextStep} onChange={(e) => setNextStep(e.target.value)} maxLength={200} placeholder="e.g. Try this formula on your own budget sheet this week" /></label>
        <Msg msg={msg} />
        <button className="sl-primary" disabled={busy}>{busy ? 'Sending…' : 'Send for approval'}</button>
      </form>
    </Modal>
  )
}

function Learn({ user, onSignIn, config, isAdmin, onRecommend, onOpenPath, onAllSoftware, initialCat = '' }: { user: User | null; onSignIn: () => void; config: SkillsConfig; isAdmin: boolean; onRecommend: (p?: { url: string; title: string }) => void; onOpenPath: (id: string) => void; onAllSoftware: () => void; initialCat?: string }) {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState(initialCat)
  const [kind, setKind] = useState('')
  const [all, setAll] = useState<Rec[] | null>(null)
  const [msg, setMsg] = useState<Note>(null)
  const [yq, setYq] = useState('')
  const [yres, setYres] = useState<YtResponse | null>(null)
  const [ybusy, setYbusy] = useState(false)
  const [play, setPlay] = useState<PlayVideo | null>(null)
  const load = useCallback(() => {
    if (!skillsReady) { setAll([]); return }
    skillsApi.recs({}).then(setAll).catch((e) => { setMsg({ type: 'err', text: errMsg(e) }); setAll([]) })
  }, [])
  useEffect(() => { load() }, [load, user])
  const needle = q.trim().toLowerCase()
  const items = all && all.filter((r) => (!kind || r.kind === kind) && (!cat || r.category === cat) && (!needle || `${r.title} ${r.skill} ${r.channel} ${r.provider}`.toLowerCase().includes(needle)))
  async function ytSearch(e: FormEvent) {
    e.preventDefault()
    if (!user) return onSignIn()
    setYbusy(true); setMsg(null); setYres(null)
    try { setYres(await skillsApi.ytSearch(yq.trim())) } catch (err) { setMsg({ type: 'err', text: errMsg(err) }) } finally { setYbusy(false) }
  }
  const ytLink = `https://www.youtube.com/results?search_query=${encodeURIComponent(`${yq.trim()} tutorial`)}`
  return (
    <>
      <section className="sl-hero cit-hero">
        <div><span className="sl-kicker">CIT GROUP · CHUKA AI COMMUNITY</span><h1>Learn Google Sheets, AI &amp; computer skills <em>step by step</em></h1>
          <p>Live classes in Google Sheets, AI coding, AI skills and data analysis. Start from zero with Learn Computer, set up VS Code, and install the software you need.</p>
          <div className="cit-hero-actions">
            <button className="sl-primary small" onClick={() => onOpenPath('computer')}>Start Learn Computer</button>
            <button className="sl-mini cit-light" onClick={() => onOpenPath('vscode')}>Learn VS Code</button>
          </div></div>
        <div className="sl-hero-art"><GraduationCap size={46} /><span>Grow your skills</span></div>
      </section>

      <div className="hub-sec"><h2>Start here</h2></div>
      <PathCards onOpen={onOpenPath} />

      <div className="hub-sec"><h2>Software you need</h2><button className="sl-mini" onClick={onAllSoftware}><Download size={13} /> See all</button></div>
      <p className="sl-sub" style={{ marginTop: 0 }}>Install these before your first class. Chosen by the CIT admin.</p>
      <SoftwareList limit={4} onAll={onAllSoftware} />

      <div className="hub-sec"><h2>Videos &amp; courses</h2></div>
      <div className="hub-bar">
        <form className="sl-search" onSubmit={(e) => e.preventDefault()}><Search size={18} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search videos and courses, e.g. Google Sheets, Python, VS Code…" /></form>
        <button className="sl-primary small" onClick={user ? () => onRecommend() : onSignIn}><Plus size={15} /> Recommend</button>
      </div>
      <div className="hub-chips">
        {[['', 'All'], ['video', 'Videos'], ['course', 'Courses']].map(([k, l]) => <button key={k} className={kind === k ? 'on' : ''} onClick={() => setKind(k)}>{l}</button>)}
        <select value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Category" style={{ borderRadius: 999, border: '1px solid #d6e4db', padding: '7px 12px', font: 'inherit', fontSize: 13 }}>
          <option value="">All categories</option>{config.categories.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>
      <Msg msg={msg} />
      {!items ? <Loading /> : items.length === 0 ? <Empty icon={<Video size={26} />} title="Nothing recommended yet" text="Recommend a helpful video or course, or search YouTube below." /> : (
        <div className="sl-grid">{items.map((r) => (
          <div key={r.id} className={r.featured ? 'cit-pick' : undefined}>
            <RecCard r={r} user={user} onSignIn={onSignIn} onError={(m) => setMsg({ type: 'err', text: m })}>
              {isAdmin && r.status === 'approved' && <button className="sl-mini" onClick={() => skillsApi.admin.featureRec(r.id, r.featured).then(load).catch((e) => setMsg({ type: 'err', text: errMsg(e) }))}>{r.featured ? 'Remove pick' : 'Pick of the week'}</button>}
            </RecCard>
          </div>))}</div>
      )}

      <ChannelShelf config={config} />
      <BlueskyStrip bsky={config.bsky} />

      <div className="hub-sec"><h2>Search YouTube</h2></div>
      <form className="sl-search" onSubmit={ytSearch}><Search size={18} /><input value={yq} onChange={(e) => setYq(e.target.value)} placeholder="Search tutorials, e.g. “VS Code for beginners”" />
        <button className="sl-primary small" disabled={ybusy || yq.trim().length < 2}>{ybusy ? '…' : 'Search'}</button></form>
      {yq.trim().length >= 2 && <p className="sl-sub" style={{ marginTop: 8 }}>Or <a className="sl-link" href={ytLink} target="_blank" rel="noreferrer noopener">open this search on YouTube <ExternalLink size={12} /></a></p>}
      {yres?.error && <p className="sl-alert err" style={{ marginTop: 10 }}>{yres.error} <a className="sl-link" href={yres.fallbackUrl} target="_blank" rel="noreferrer noopener">Search on YouTube <ExternalLink size={12} /></a></p>}
      {yres && !yres.error && (yres.items.length === 0 ? <Empty title="No videos found" /> : (
        <div className="sl-grid" style={{ marginTop: 14 }}>{yres.items.map((v) => (
          <article className="sl-resource" key={v.videoId}>
            {v.thumbnail && <img className="hub-thumb" src={v.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" onClick={() => setPlay({ videoId: v.videoId, title: v.title })} style={{ cursor: 'pointer' }} />}
            <h3>{v.title}</h3><small className="sl-unitline">{v.channel}</small>
            <div className="sl-resource-foot"><span /><span className="sl-foot-actions"><button className="sl-mini" onClick={() => setPlay({ videoId: v.videoId, title: v.title })}><Play size={13} /> Watch here</button><button className="sl-mini ghost" onClick={() => (user ? onRecommend({ url: `https://www.youtube.com/watch?v=${v.videoId}`, title: v.title }) : onSignIn())}>Recommend this</button></span></div>
          </article>))}</div>
      ))}

      {play && <VideoModal video={play} onClose={() => setPlay(null)} />}
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
  const [meetSpace] = useState(cls?.meetSpace ?? '')
  const [sStart, setSStart] = useState('')
  const [sMins, setSMins] = useState('60')
  const [sWeeks, setSWeeks] = useState('8')
  const [sMeet, setSMeet] = useState(true)
  const [files, setFiles] = useState<File[]>([])
  const [removeIds, setRemoveIds] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<Note>(null)
  const [done, setDone] = useState<string | null>(null)
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
          const r = await skillsApi.admin.addSession({ classId: saved.id, start: sStart, minutes: Number(sMins), weeks: Number(sWeeks), meet: sMeet && mode !== 'physical' && !joinLink.trim() })
          note += r.warning ? ` ${r.warning}` : ` ${r.count} weekly session${r.count > 1 ? 's were' : ' was'} added to your Google Calendar${r.joinLink ? ' with one Google Meet link for the whole class' : ''}.`
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
          <label>Class link (Google Meet, Zoom or a WhatsApp group){admin && !cls ? ' · leave empty to create a Meet link below' : ''}
            <input type="url" value={joinLink} onChange={(e) => setJoinLink(e.target.value)} placeholder="https://" />
          </label>
        )}
        <div className="sl-two">
          <label>Schedule (text students see)<input value={schedule} onChange={(e) => setSchedule(e.target.value)} maxLength={150} placeholder="e.g. Saturdays 2-4pm" /></label>
          <label>Starts (optional)<input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></label>
        </div>
        {admin && !cls && (
          <div className="cf-box">
            <strong><CalendarPlus size={15} /> Weekly schedule (optional)</strong>
            <small>Adds a repeating event to your Google Calendar and shows every session to students. You can add more later from the class page.</small>
            <div className="sl-two">
              <label>First session (Nairobi time)<input type="datetime-local" value={sStart} onChange={(e) => setSStart(e.target.value)} /></label>
              <label>Length<select value={sMins} onChange={(e) => setSMins(e.target.value)}>{[30, 45, 60, 90, 120, 180].map((m) => <option key={m} value={m}>{m} minutes</option>)}</select></label>
            </div>
            <label>Repeats weekly for<select value={sWeeks} onChange={(e) => setSWeeks(e.target.value)}>{[1, 2, 4, 6, 8, 10, 12, 16, 20, 26].map((w) => <option key={w} value={w}>{w === 1 ? 'One session only' : `${w} weeks`}</option>)}</select></label>
            {mode !== 'physical' && <label className="cf-check"><input type="checkbox" checked={sMeet && !joinLink.trim()} disabled={!!joinLink.trim()} onChange={(e) => setSMeet(e.target.checked)} /> Create one Google Meet link for every week (students are invited by email)</label>}
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
  const [sWeeks, setSWeeks] = useState('1')
  const [sMeet, setSMeet] = useState(false)
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
      const r = await skillsApi.admin.addSession({ classId: c.id, start: sStart, minutes: Number(sMins), weeks: Number(sWeeks), meet: sMeet && c.mode !== 'physical', title: sTitle.trim() || undefined })
      setSStart(''); setSTitle(''); await load()
      setMsg(r.warning ? { type: 'err', text: r.warning } : { type: 'ok', text: `${r.count} session${r.count > 1 ? 's' : ''} added to your Google Calendar${r.joinLink ? ' with a new Meet link' : ''}.` })
    } catch (e2) { err(e2) } finally { setBusy(false) }
  }
  const now = Date.now()
  const upcoming = c.sessions.filter((s) => new Date(s.endAt).getTime() >= now)
  const past = c.sessions.filter((s) => new Date(s.endAt).getTime() < now)
  const where = c.mode === 'physical' ? c.venue : (c.joinLink ?? '')
  const details = `CIT Group class: ${c.title}.${c.joinLink ? ` Join: ${c.joinLink}` : ' Get access on Chuka Comrades to see the link.'}`
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
          : c.access !== 'all' ? null : <button className="sl-primary small" disabled={busy} onClick={() => (user ? run(() => skillsApi.join(c.id), 'You joined. The class link is now visible.') : onSignIn())}>{user ? 'Join this class' : 'Sign in to join'}</button>)}
        {isAdmin && <button className="sl-mini" onClick={() => onEdit(c)}><Pencil size={13} /> Edit class</button>}
      </article>
      {c.status === 'approved' && !c.mine && !isAdmin && <AccessPanel cls={c} user={user} onSignIn={onSignIn} config={config} onChanged={() => { void load() }} />}

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
              <small>Creates an event on your Google Calendar. Students who joined are invited, and new joiners are added automatically.</small>
              <div className="sl-two">
                <label>Date and time (Nairobi)<input type="datetime-local" value={sStart} onChange={(e) => setSStart(e.target.value)} required /></label>
                <label>Length<select value={sMins} onChange={(e) => setSMins(e.target.value)}>{[30, 45, 60, 90, 120, 180].map((m) => <option key={m} value={m}>{m} minutes</option>)}</select></label>
              </div>
              <label>Repeats weekly for<select value={sWeeks} onChange={(e) => setSWeeks(e.target.value)}>{[1, 2, 4, 6, 8, 10, 12, 16, 20, 26].map((w) => <option key={w} value={w}>{w === 1 ? 'One session only' : `${w} weeks`}</option>)}</select></label>
              {c.mode !== 'physical' && <label className="cf-check"><input type="checkbox" checked={sMeet} onChange={(e) => setSMeet(e.target.checked)} /> {c.joinLink ? 'Replace the class link with a NEW Google Meet link' : 'Create a Google Meet link for this class'}</label>}
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
      {c.status === 'approved' && (
        <>
          <div className="hub-sec"><h2>Class discussion</h2></div>
          <ChatRoom room={`class:${c.id}`} user={user} onSignIn={onSignIn} isAdmin={isAdmin} title={c.title} sub="Open to the community" placeholder="Ask a question or share your progress…" />
        </>
      )}
      {(c.mine || isAdmin) && <p style={{ marginTop: 18 }}><button className="sl-mini danger" onClick={async () => { if (window.confirm('Delete this class, its sessions and everything in it?')) { try { await skillsApi.deleteClass(c.id); onGone() } catch (e) { err(e) } } }}><Trash2 size={13} /> Delete class</button></p>}
    </>
  )
}

function Classes({ user, config, isAdmin, onOpen, onCreate, initialQ = '' }: { user: User | null; config: SkillsConfig; isAdmin: boolean; onOpen: (id: string) => void; onCreate: () => void; initialQ?: string }) {
  const [q, setQ] = useState(initialQ)
  const [cat, setCat] = useState('')
  const [all, setAll] = useState<ClassItem[] | null>(null)
  const [up, setUp] = useState<UpcomingSession[]>([])
  const [msg, setMsg] = useState<Note>(null)
  const load = useCallback(() => {
    if (!skillsReady) { setAll([]); return }
    skillsApi.classes().then(setAll).catch((e) => { setMsg({ type: 'err', text: errMsg(e) }); setAll([]) })
  }, [])
  useEffect(() => { load() }, [load, user])
  const needle = q.trim().toLowerCase()
  const items = all && all.filter((c) => (!cat || c.category === cat) && (!needle || `${c.title} ${c.skill} ${c.tutorName}`.toLowerCase().includes(needle)))
  useEffect(() => { if (skillsReady) skillsApi.upcoming().then(setUp).catch(() => setUp([])) }, [])
  return (
    <>
      <div className="sl-page-head"><div><span className="sl-kicker">CLASSES</span><h1>Join a class</h1></div></div>
      <div className="hub-bar">
        <form className="sl-search" onSubmit={(e) => e.preventDefault()}><Search size={18} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search classes…" /></form>
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
          <Library config={config} user={user} />
          <div className="hub-sec"><h2>My recommendations</h2></div>
          {data.recs.length === 0 ? <Empty title="No recommendations yet" /> : <div className="sl-grid">{data.recs.map((r) => <RecCard key={r.id} r={r} user={user} onSignIn={onSignIn} onError={(m) => setMsg({ type: 'err', text: m })} />)}</div>}
        </>
      )}
    </>
  )
}

/* ---------- admin ---------- */
function Admin({ tick, config, onNew, onEdit, onOpen, onConfigChanged }: { tick: number; config: SkillsConfig; onNew: () => void; onEdit: (c: ClassItem) => void; onOpen: (id: string) => void; onConfigChanged: () => void }) {
  const [tab, setTab] = useState<'classes' | 'recs' | 'all' | 'products' | 'orders' | 'settings' | 'live' | 'software' | 'hacks' | 'bluesky'>('all')
  const [edits, setEdits] = useState<Record<string, { title?: string; category?: string }>>({})
  const [q, setQ] = useState<{ classes: ClassItem[]; recs: Rec[] } | null>(null)
  const [all, setAll] = useState<ClassItem[] | null>(null)
  const [reasons, setReasons] = useState<Record<string, string>>({})
  const [msg, setMsg] = useState<Note>(null)
  const err = (e: unknown) => setMsg({ type: 'err', text: errMsg(e) })
  const loadQ = useCallback(() => skillsApi.admin.queue().then(setQ).catch(err), [])
  const loadAll = useCallback(() => skillsApi.admin.classes().then(setAll).catch((e) => { err(e); setAll([]) }), [])
  useEffect(() => { void loadQ() }, [loadQ, tick])
  useEffect(() => { if (tab === 'all' || tab === 'live') void loadAll() }, [tab, loadAll, tick])
  const noop = () => {}
  const decide = (kind: 'class' | 'rec', id: string, d: 'approve' | 'reject') =>
    (kind === 'class' ? skillsApi.admin.reviewClass(id, d, reasons[id]?.trim()) : skillsApi.admin.reviewRec(id, d, reasons[id]?.trim(), edits[id]))
      .then(() => { setMsg({ type: 'ok', text: d === 'approve' ? 'Approved.' : 'Rejected.' }); return loadQ() }).catch(err)
  const box = (id: string) => <input placeholder="Reason (if rejecting)" value={reasons[id] ?? ''} onChange={(e) => setReasons({ ...reasons, [id]: e.target.value })} />
  return (
    <>
      <div className="sl-page-head"><div><span className="sl-kicker">ADMIN</span><h1>Skills admin</h1></div></div>
      <div className="sl-tabs">
        <button className={tab === 'all' ? 'on' : ''} onClick={() => setTab('all')}>All classes</button>
        <button className={tab === 'recs' ? 'on' : ''} onClick={() => setTab('recs')}>Recommendations <b>{q?.recs.length ?? 0}</b></button>
        {config.allowTutorCreate && <button className={tab === 'classes' ? 'on' : ''} onClick={() => setTab('classes')}>Class requests <b>{q?.classes.length ?? 0}</b></button>}
        <button className={tab === 'hacks' ? 'on' : ''} onClick={() => setTab('hacks')}>Hackathons</button>
        <button className={tab === 'software' ? 'on' : ''} onClick={() => setTab('software')}>Software</button>
        <button className={tab === 'bluesky' ? 'on' : ''} onClick={() => setTab('bluesky')}>Bluesky</button>
        <button className={tab === 'products' ? 'on' : ''} onClick={() => setTab('products')}>Products</button>
        <button className={tab === 'orders' ? 'on' : ''} onClick={() => setTab('orders')}>Orders</button>
        <button className={tab === 'live' ? 'on' : ''} onClick={() => setTab('live')}>Live</button>
        <button className={tab === 'settings' ? 'on' : ''} onClick={() => setTab('settings')}>Settings</button>
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
            <span className="hub-decide">
              <input placeholder="Fix title (optional)" value={edits[r.id]?.title ?? ''} onChange={(e) => setEdits({ ...edits, [r.id]: { ...edits[r.id], title: e.target.value } })} />
              <select aria-label="Category" value={edits[r.id]?.category ?? ''} onChange={(e) => setEdits({ ...edits, [r.id]: { ...edits[r.id], category: e.target.value } })}>
                <option value="">Keep: {r.category}</option>{config.categories.map((c) => <option key={c}>{c}</option>)}
              </select>
              {box(r.id)}<button className="sl-mini" onClick={() => decide('rec', r.id, 'approve')}>Approve</button><button className="sl-mini danger" onClick={() => decide('rec', r.id, 'reject')}>Reject</button></span>
          </RecCard>))}</div>
      ))}
      {tab === 'hacks' && <AdminHacks tick={tick} />}
      {tab === 'bluesky' && <AdminBsky config={config} onChanged={onConfigChanged} />}
      {tab === 'software' && <AdminSoftware tick={tick} />}
      {tab === 'products' && <AdminProducts config={config} tick={tick} />}
      {tab === 'orders' && <AdminOrders tick={tick} />}
      {tab === 'live' && <AdminLive config={config} classes={all ?? []} onSaved={onConfigChanged} />}
      {tab === 'settings' && <AdminSettings config={config} onSaved={onConfigChanged} />}
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
  const [classQ, setClassQ] = useState('')
  const [learnCat, setLearnCat] = useState('')
  const loadConfig = useCallback(() => { if (skillsReady) skillsApi.config().then((c) => setConfig({ ...FALLBACK_CONFIG, ...c, whatsapp: c.whatsapp || ADMIN_WA })).catch((e) => setFatal(errMsg(e))) }, [])
  useEffect(() => { loadConfig() }, [loadConfig])
  useEffect(() => {
    setIsAdmin(false)
    if (skillsReady && user) skillsApi.adminCheck().then((r) => setIsAdmin(r.isAdmin)).catch(() => {})
  }, [user])
  useEffect(() => { window.scrollTo(0, 0) }, [view])
  const gated = (v: View) => (user ? setView(v) : onSignIn())
  const bump = () => setTick((n) => n + 1)
  const name = view.name
  const open = (id: string) => setView({ name: 'class', id })
  const goCommunity = (t: 'feed' | 'ideas' | 'hackathons') => setView({ name: t })
  return (
    <HubShell name="CIT Group" sub="Chuka AI Community" logo="skills-logo.svg" backLabel={name === 'learn' ? 'Back to services' : 'Back'}
      onBack={() => (name === 'learn' ? onBack() : setView({ name: name === 'class' ? 'classes' : name === 'hack' ? 'hackathons' : 'learn' }))}
      nav={<CitMenu current={menuLabel[name]} items={[
        { key: 'learn', label: 'Learn', icon: <GraduationCap size={18} />, on: name === 'learn' || name === 'path', onClick: () => { setLearnCat(''); setView({ name: 'learn' }) } },
        { key: 'classes', label: 'Classes', icon: <BookOpen size={18} />, on: name === 'classes' || name === 'class', onClick: () => { setClassQ(''); setView({ name: 'classes' }) } },
        { key: 'live', label: 'Live', icon: <Video size={18} />, on: name === 'live', dot: config.live.on, onClick: () => setView({ name: 'live' }) },
        { key: 'community', label: 'Community', icon: <Lightbulb size={18} />, on: name === 'feed' || name === 'ideas' || name === 'hackathons' || name === 'hack', onClick: () => setView({ name: 'feed' }) },
        { key: 'software', label: 'Software', icon: <Download size={18} />, on: name === 'software', onClick: () => setView({ name: 'software' }) },
        { key: 'shop', label: 'Shop', icon: <ShoppingBag size={18} />, on: name === 'shop', onClick: () => setView({ name: 'shop' }) },
        { key: 'chat', label: isAdmin ? 'Inbox' : 'Ask admin', icon: <MessageCircle size={18} />, on: name === 'chat', onClick: () => gated({ name: 'chat' }) },
        { key: 'teach', label: 'My skills', icon: <Users size={18} />, on: name === 'teach', onClick: () => gated({ name: 'teach' }) },
        ...(isAdmin ? [{ key: 'admin', label: 'Admin', icon: <ShieldCheck size={18} />, on: name === 'admin', onClick: () => setView({ name: 'admin' }) }] : []),
      ]} />}>
      {!skillsReady && <Msg msg={{ type: 'err', text: 'Skills server not connected yet. Add VITE_SKILLS_API_URL to .env and restart npm run dev.' }} />}
      {fatal && <Msg msg={{ type: 'err', text: fatal }} />}
      {view.name === 'live' && <LiveRoom config={config} user={user} onSignIn={onSignIn} isAdmin={isAdmin} onOpenClass={open} />}
      {view.name === 'chat' && !isAdmin && !!bskyHandle(config.bsky) && <p className="sl-sub" style={{ margin: '0 0 10px' }}>Prefer Bluesky? <BskyDm bsky={config.bsky} /></p>}
      {view.name === 'chat' && (isAdmin ? <><div className="sl-page-head"><div><span className="sl-kicker">ADMIN</span><h1>Student messages</h1></div></div><AdminInbox user={user} onSignIn={onSignIn} /></> : <StudentChat user={user} onSignIn={onSignIn} whatsapp={config.whatsapp} />)}
      {view.name === 'learn' && <Learn key={learnCat} initialCat={learnCat} user={user} onSignIn={onSignIn} config={config} isAdmin={isAdmin} onRecommend={(p) => setRecOpen(p ?? 'new')} onOpenPath={(id) => setView({ name: 'path', id })} onAllSoftware={() => setView({ name: 'software' })} />}
      {view.name === 'software' && <><div className="sl-page-head"><div><span className="sl-kicker">SOFTWARE</span><h1>Software you need</h1></div></div><p className="sl-sub" style={{ marginTop: 0 }}>Install these on your computer before class. The CIT admin keeps this list up to date.</p><SoftwareList /></>}
      {view.name === 'feed' && <><CommunityTabs current="feed" go={goCommunity} bsky={config.bsky} /><Feed config={config} user={user} onSignIn={onSignIn} isAdmin={isAdmin} onChanged={loadConfig} /></>}
      {view.name === 'hackathons' && <><CommunityTabs current="hackathons" go={goCommunity} bsky={config.bsky} /><Hackathons user={user} onOpen={(id) => setView({ name: 'hack', id })} /></>}
      {view.name === 'hack' && <HackPage key={view.id} id={view.id} user={user} onSignIn={onSignIn} isAdmin={isAdmin} bsky={config.bsky} />}
      {view.name === 'ideas' && <><CommunityTabs current="ideas" go={goCommunity} bsky={config.bsky} /><IdeasBoard user={user} onSignIn={onSignIn} isAdmin={isAdmin} bsky={config.bsky} /></>}
      {view.name === 'path' && (() => { const path = pathById(view.id); return path ? <PathPage key={path.id} user={user} onSignIn={onSignIn} path={path} onSoftware={() => setView({ name: 'software' })} onSeeContent={(c) => { setLearnCat(c); setView({ name: 'learn' }) }} /> : null })()}
      {view.name === 'classes' && <Classes key={classQ} initialQ={classQ} user={user} config={config} isAdmin={isAdmin} onOpen={open} onCreate={() => (user ? setClassOpen('new') : onSignIn())} />}
      {view.name === 'class' && <ClassPage id={view.id} user={user} onSignIn={onSignIn} config={config} isAdmin={isAdmin} tick={tick} onEdit={setClassOpen} onGone={() => setView({ name: 'classes' })} />}
      {view.name === 'shop' && <Shop user={user} onSignIn={onSignIn} config={config} />}
      {view.name === 'teach' && <Teach user={user} onSignIn={onSignIn} config={config} isAdmin={isAdmin} tick={tick} onOpen={open} onCreate={() => setClassOpen('new')} onEdit={setClassOpen} />}
      {view.name === 'admin' && isAdmin && <Admin tick={tick} config={config} onNew={() => setClassOpen('new')} onEdit={setClassOpen} onOpen={open} onConfigChanged={loadConfig} />}
      {!(view.name === 'chat' && isAdmin) && <CitAdminFab phone={config.whatsapp || ADMIN_WA} />}
      {recOpen && <RecModal config={config} prefill={recOpen === 'new' ? undefined : recOpen} onClose={() => setRecOpen(null)} onDone={bump} />}
      {classOpen && <ClassModal cls={classOpen === 'new' ? undefined : classOpen} config={config} admin={isAdmin} onClose={() => setClassOpen(null)} onDone={bump} />}
    </HubShell>
  )
}

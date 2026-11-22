import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import type { User } from 'firebase/auth'
import { CalendarDays, CheckCircle2, Download, ImagePlus, MapPin, MessageCircle, Pencil, Plus, Radio, Trash2, Trophy, Users } from 'lucide-react'
import { skillsApi, skillsReady, type HackInput, type HackReg, type Hackathon, type Mode } from '../lib/skills'
import { shrinkImage } from '../lib/files'
import { errMsg, type Note } from '../lib/hub'
import { Empty, Loading, Modal, Msg, StatusBadge } from '../components/HubUi'
import { ChatRoom } from '../components/CitChat'
import '../components/Cit.css'

const when = (s: string) => (s ? new Date(s).toLocaleString('en-KE', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Nairobi' }) : '')
const toLocalInput = (s: string) => (s ? s.slice(0, 16) : '')   // stored as Nairobi time: 2026-12-05T09:00:00+03:00
const STATUS_LABEL: Record<string, string> = { draft: 'Draft', open: 'Registration open', ongoing: 'Happening now', ended: 'Ended' }

function countdown(h: Hackathon): string {
  const now = Date.now(), start = new Date(h.startAt).getTime(), end = new Date(h.endAt).getTime()
  const days = (t: number) => Math.max(0, Math.ceil((t - now) / 864e5))
  if (h.status === 'ended' || now > end) return 'Ended'
  if (now >= start) return 'In progress'
  const d = days(start)
  return d <= 1 ? 'Starts within a day' : `Starts in ${d} days`
}
function regOpen(h: Hackathon) { return h.status === 'open' && (!h.regDeadline || new Date(h.regDeadline).getTime() > Date.now()) && (!h.maxParticipants || h.registered < h.maxParticipants) }

function HackCover({ h }: { h: Pick<Hackathon, 'coverUrl' | 'title'> }) {
  return h.coverUrl
    ? <img className="cit-hk-cover" src={h.coverUrl} alt="" loading="lazy" referrerPolicy="no-referrer" />
    : <div className="cit-hk-cover ph"><Trophy size={40} /></div>
}

function HackCard({ h, onOpen, children }: { h: Hackathon; onOpen?: (id: string) => void; children?: ReactNode }) {
  return (
    <article className="cit-hk">
      <div className="cit-hk-img" onClick={() => onOpen?.(h.id)} style={{ cursor: onOpen ? 'pointer' : undefined }}>
        <HackCover h={h} />
        <span className={`cit-hk-status ${h.status}`}>{STATUS_LABEL[h.status]}</span>
        {h.live && <span className="cit-hk-live"><i className="cit-dot" />LIVE</span>}
      </div>
      <div className="cit-hk-body">
        <h3>{h.title}</h3>
        <p>{h.summary}</p>
        <div className="hub-meta"><span><CalendarDays size={13} /> {when(h.startAt)}</span><span><MapPin size={13} /> {h.mode === 'online' ? 'Online' : h.venue || h.mode}</span>
          <span><Users size={13} /> {h.registered}{h.maxParticipants ? `/${h.maxParticipants}` : ''} registered</span></div>
        <div className="cit-hk-foot"><small>{countdown(h)}</small><span className="sl-foot-actions">{onOpen && <button className="sl-primary small" onClick={() => onOpen(h.id)}>{regOpen(h) ? 'Register' : 'View'}</button>}{children}</span></div>
      </div>
    </article>
  )
}

/* ---------- public list ---------- */
export function Hackathons({ user, onOpen }: { user: User | null; onOpen: (id: string) => void }) {
  const [items, setItems] = useState<Hackathon[] | null>(null)
  const [msg, setMsg] = useState<Note>(null)
  useEffect(() => {
    if (!skillsReady) { setItems([]); return }
    skillsApi.hackathons().then(setItems).catch((e) => { setMsg({ type: 'err', text: errMsg(e) }); setItems([]) })
  }, [user])
  const current = items?.filter((h) => h.status !== 'ended') ?? []
  const past = items?.filter((h) => h.status === 'ended') ?? []
  return (
    <>
      <section className="sl-hero cit-hero hack">
        <div><span className="sl-kicker">HACKATHONS · CIT GROUP</span><h1>Build something real. <em>Win prizes.</em></h1>
          <p>Join a coding competition, team up with other students, and watch the big finish live right here.</p></div>
        <div className="sl-hero-art"><Trophy size={46} /><span>Compete</span></div>
      </section>
      <Msg msg={msg} />
      {!items ? <Loading /> : items.length === 0 ? <Empty icon={<Trophy size={26} />} title="No competitions yet" text="The admin will announce the next hackathon here." /> : (
        <>
          {current.length > 0 && <><div className="hub-sec"><h2>Open and upcoming</h2></div><div className="cit-hk-grid">{current.map((h) => <HackCard key={h.id} h={h} onOpen={onOpen} />)}</div></>}
          {past.length > 0 && <><div className="hub-sec"><h2>Past competitions</h2></div><div className="cit-hk-grid">{past.map((h) => <HackCard key={h.id} h={h} onOpen={onOpen} />)}</div></>}
        </>
      )}
    </>
  )
}

/* ---------- register form ---------- */
function RegisterModal({ h, user, onClose, onDone }: { h: Hackathon; user: User; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState(user.displayName ?? '')
  const [phone, setPhone] = useState('')
  const [school, setSchool] = useState('')
  const [level, setLevel] = useState('Beginner')
  const [teamName, setTeamName] = useState('')
  const [members, setMembers] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<Note>(null)
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setMsg(null)
    try { await skillsApi.hackRegister({ hackId: h.id, name: name.trim(), phone: phone.trim(), school: school.trim(), level, teamName: teamName.trim(), members: members.trim() }); onDone(); onClose() }
    catch (err) { setMsg({ type: 'err', text: errMsg(err) }) } finally { setBusy(false) }
  }
  return (
    <Modal title={`Register: ${h.title}`} onClose={onClose}>
      <form className="sl-form" onSubmit={submit}>
        <label>Your full name<input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} /></label>
        <div className="sl-two">
          <label>Phone / WhatsApp<input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} placeholder="07…" /></label>
          <label>Coding level<select value={level} onChange={(e) => setLevel(e.target.value)}><option>Beginner</option><option>Intermediate</option><option>Advanced</option></select></label>
        </div>
        <label>School, course or organisation<input value={school} onChange={(e) => setSchool(e.target.value)} maxLength={100} placeholder="e.g. Chuka University, BSc Computer Science" /></label>
        {h.teamMax > 1 && (
          <div className="cf-box">
            <strong>Team (optional, up to {h.teamMax} people including you)</strong>
            <label>Team name<input value={teamName} onChange={(e) => setTeamName(e.target.value)} maxLength={60} /></label>
            <label>Other members (names or emails, one per line)<textarea rows={3} value={members} onChange={(e) => setMembers(e.target.value)} maxLength={400} /></label>
          </div>
        )}
        <Msg msg={msg} />
        <button className="sl-primary" disabled={busy || name.trim().length < 2 || phone.trim().length < 7}>{busy ? 'Registering…' : 'Complete registration'}</button>
      </form>
    </Modal>
  )
}

/* ---------- one competition ---------- */
export function HackPage({ id, user, onSignIn, isAdmin }: { id: string; user: User | null; onSignIn: () => void; isAdmin: boolean }) {
  const [h, setH] = useState<Hackathon | null | undefined>(undefined)
  const [reg, setReg] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<Note>(null)
  const load = useCallback(() => skillsApi.hackathons().then((l) => setH(l.find((x) => x.id === id) ?? null)).catch((e) => { setMsg({ type: 'err', text: errMsg(e) }); setH(null) }), [id])
  useEffect(() => { void load() }, [load, user])
  if (h === undefined) return <Loading />
  if (!h) return <><Msg msg={msg} /><Empty icon={<Trophy size={26} />} title="Competition not found" /></>
  const mine = h.myReg && (h.myReg.status === 'registered' || h.myReg.status === 'approved') ? h.myReg : null
  async function cancel() {
    if (!window.confirm('Cancel your registration?')) return
    setBusy(true); setMsg(null)
    try { await skillsApi.hackCancel(id); await load() } catch (e) { setMsg({ type: 'err', text: errMsg(e) }) } finally { setBusy(false) }
  }
  return (
    <>
      <div className="cit-hk-hero"><HackCover h={h} /><span className={`cit-hk-status ${h.status}`}>{STATUS_LABEL[h.status]}</span></div>
      <div className="sl-page-head"><div><span className="sl-kicker">HACKATHON</span><h1>{h.title}</h1></div></div>
      <Msg msg={msg} />
      <div className="hub-meta" style={{ marginBottom: 10 }}>
        <span><CalendarDays size={13} /> {when(h.startAt)} to {when(h.endAt)}</span><span><MapPin size={13} /> {h.mode === 'online' ? 'Online' : h.venue || h.mode}</span>
        <span><Users size={13} /> {h.registered}{h.maxParticipants ? `/${h.maxParticipants}` : ''} registered</span>
        {h.regDeadline && h.status === 'open' && <span>Register by {when(h.regDeadline)}</span>}
      </div>

      {h.live && h.liveVideoId && (
        <>
          <div className="hub-sec"><h2><Radio size={18} style={{ verticalAlign: -3 }} /> Live now</h2></div>
          <div className="cit-live split">
            <div className="cit-live-wrap"><iframe src={`https://www.youtube-nocookie.com/embed/${h.liveVideoId}?autoplay=1&rel=0`} title={`${h.title} live`} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen /></div>
            <ChatRoom room={`hack:${h.id}`} user={user} onSignIn={onSignIn} isAdmin={isAdmin} title="Live chat" sub="Cheer the teams on" placeholder="Say something…" />
          </div>
        </>
      )}

      <article className="sl-resource" style={{ marginTop: 14 }}>
        {mine ? (
          <div className="cit-paid-row"><span className="cit-paid"><CheckCircle2 size={14} /> You are registered{mine.status === 'approved' ? ' and approved' : ''}{mine.teamName ? ` · Team ${mine.teamName}` : ''}</span>
            <button className="sl-mini danger" disabled={busy} onClick={cancel}>Cancel registration</button></div>
        ) : h.myReg?.status === 'rejected' ? <p className="sl-alert err">Your registration was not accepted. Contact the admin if you think this is a mistake.</p>
          : regOpen(h) ? <button className="sl-primary" onClick={() => (user ? setReg(true) : onSignIn())}>{user ? 'Register now' : 'Sign in to register'}</button>
          : <p className="sl-sub" style={{ margin: 0 }}>{h.status === 'open' ? 'Registration is closed or the competition is full.' : h.status === 'ended' ? 'This competition has ended.' : 'Registration is not open.'}</p>}
        {mine && h.joinLink && <p style={{ marginTop: 10 }}><a className="sl-primary small" href={h.joinLink} target="_blank" rel="noreferrer noopener">Open the competition link</a></p>}
        {isAdmin && <p className="sl-sub" style={{ margin: '10px 0 0' }}>Admin: edit this competition, see registrations or go live in Admin &gt; Hackathons.</p>}
      </article>

      {h.results && <><div className="hub-sec"><h2><Trophy size={18} style={{ verticalAlign: -3 }} /> Results</h2></div><p className="cit-pre">{h.results}</p></>}
      <div className="hub-sec"><h2>About</h2></div><p className="cit-pre">{h.description}</p>
      {h.prizes && <><div className="hub-sec"><h2>Prizes</h2></div><p className="cit-pre">{h.prizes}</p></>}
      {h.rules && <><div className="hub-sec"><h2>Rules</h2></div><p className="cit-pre">{h.rules}</p></>}
      {!(h.live && h.liveVideoId) && h.status !== 'draft' && (
        <><div className="hub-sec"><h2>Discussion</h2></div><ChatRoom room={`hack:${h.id}`} user={user} onSignIn={onSignIn} isAdmin={isAdmin} title={h.title} sub="Ask questions, find teammates" placeholder="Ask a question or look for a team…" /></>
      )}
      {reg && user && <RegisterModal h={h} user={user} onClose={() => setReg(false)} onDone={() => void load()} />}
    </>
  )
}

/* ---------- admin ---------- */
function HackModal({ h, onClose, onDone }: { h?: Hackathon; onClose: () => void; onDone: () => void }) {
  const [title, setTitle] = useState(h?.title ?? '')
  const [summary, setSummary] = useState(h?.summary ?? '')
  const [description, setDescription] = useState(h?.description ?? '')
  const [rules, setRules] = useState(h?.rules ?? '')
  const [prizes, setPrizes] = useState(h?.prizes ?? '')
  const [startAt, setStartAt] = useState(toLocalInput(h?.startAt ?? ''))
  const [endAt, setEndAt] = useState(toLocalInput(h?.endAt ?? ''))
  const [regDeadline, setRegDeadline] = useState(toLocalInput(h?.regDeadline ?? ''))
  const [mode, setMode] = useState<Mode>(h?.mode ?? 'online')
  const [venue, setVenue] = useState(h?.venue ?? '')
  const [joinLink, setJoinLink] = useState(h?.joinLink ?? '')
  const [max, setMax] = useState(String(h?.maxParticipants ?? 0))
  const [teamMax, setTeamMax] = useState(String(h?.teamMax ?? 4))
  const [status, setStatus] = useState<Hackathon['status']>(h?.status ?? 'draft')
  const [results, setResults] = useState(h?.results ?? '')
  const [cover, setCover] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<Note>(null)
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setMsg(null)
    try {
      const data = cover ? (await shrinkImage(cover, 1000, 0.8)).split(',')[1] ?? '' : ''
      const input: HackInput = { id: h?.id, title: title.trim(), summary: summary.trim(), description: description.trim(), rules: rules.trim(), prizes: prizes.trim(), startAt, endAt, regDeadline,
        mode, venue: venue.trim(), joinLink: joinLink.trim(), maxParticipants: Number(max) || 0, teamMax: Number(teamMax) || 1, status, results: results.trim(), cover: data ? { name: 'cover.jpg', data } : undefined }
      await skillsApi.admin.saveHack(input); onDone(); onClose()
    } catch (err) { setMsg({ type: 'err', text: errMsg(err) }) } finally { setBusy(false) }
  }
  return (
    <Modal title={h ? 'Edit competition' : 'Create a competition'} onClose={onClose}>
      <form className="sl-form" onSubmit={submit}>
        <label className="sl-drop pr-cover-pick"><ImagePlus size={18} /> Competition card image {h?.coverUrl && !cover ? '(a card is set; choose a new one to replace it)' : ''}
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setCover(e.target.files?.[0] ?? null)} />
          <small>{cover ? cover.name : 'A wide poster works best (16:9). It is shrunk automatically.'}</small></label>
        <label>Title<input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} placeholder="e.g. Chuka Build Day 2026" /></label>
        <label>Short summary (shown on the card)<input value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={200} /></label>
        <label>Full description<textarea rows={5} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={3000} /></label>
        <label>Prizes<textarea rows={3} value={prizes} onChange={(e) => setPrizes(e.target.value)} maxLength={1000} placeholder="1st: KES 10,000…" /></label>
        <label>Rules<textarea rows={4} value={rules} onChange={(e) => setRules(e.target.value)} maxLength={3000} /></label>
        <div className="sl-two">
          <label>Starts (Nairobi time)<input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} /></label>
          <label>Ends<input type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} /></label>
        </div>
        <label>Registration closes (optional)<input type="datetime-local" value={regDeadline} onChange={(e) => setRegDeadline(e.target.value)} /></label>
        <div className="sl-two">
          <label>Format<select value={mode} onChange={(e) => setMode(e.target.value as Mode)}><option value="online">Online</option><option value="physical">In person</option><option value="hybrid">Hybrid</option></select></label>
          <label>Venue{mode === 'online' ? ' (not needed)' : ''}<input value={venue} onChange={(e) => setVenue(e.target.value)} maxLength={100} /></label>
        </div>
        <label>Link for registered people only (Discord, WhatsApp, Meet…)<input type="url" value={joinLink} onChange={(e) => setJoinLink(e.target.value)} placeholder="https://" /></label>
        <div className="sl-two">
          <label>Max participants (0 = no limit)<input type="number" min={0} max={5000} value={max} onChange={(e) => setMax(e.target.value)} /></label>
          <label>Max team size (1 = solo only)<input type="number" min={1} max={10} value={teamMax} onChange={(e) => setTeamMax(e.target.value)} /></label>
        </div>
        <label>Status<select value={status} onChange={(e) => setStatus(e.target.value as Hackathon['status'])}><option value="draft">Draft (hidden)</option><option value="open">Open for registration</option><option value="ongoing">Ongoing</option><option value="ended">Ended</option></select></label>
        <label>Results / winners (fill in after the event)<textarea rows={3} value={results} onChange={(e) => setResults(e.target.value)} maxLength={2000} /></label>
        <Msg msg={msg} />
        <button className="sl-primary" disabled={busy}>{busy ? 'Saving…' : 'Save competition'}</button>
      </form>
    </Modal>
  )
}

function RegsModal({ h, onClose }: { h: Hackathon; onClose: () => void }) {
  const [rows, setRows] = useState<HackReg[] | null>(null)
  const [msg, setMsg] = useState<Note>(null)
  const load = useCallback(() => skillsApi.admin.hackRegs(h.id).then(setRows).catch((e) => { setMsg({ type: 'err', text: errMsg(e) }); setRows([]) }), [h.id])
  useEffect(() => { void load() }, [load])
  async function decide(r: HackReg, st: 'approved' | 'rejected' | 'registered') { try { await skillsApi.admin.decideReg(r.id, st); await load() } catch (e) { setMsg({ type: 'err', text: errMsg(e) }) } }
  function csv() {
    const q = (v: string) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const head = ['Name', 'Email', 'Phone', 'School', 'Level', 'Team', 'Members', 'Status', 'Registered']
    const body = (rows ?? []).map((r) => [r.name, r.email, r.phone, r.school, r.level, r.teamName, r.members.replace(/\n/g, '; '), r.status, r.createdAt].map(q).join(','))
    const blob = new Blob([[head.map(q).join(','), ...body].join('\n')], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${h.title.replace(/[^a-z0-9]+/gi, '-')}-registrations.csv`; a.click(); URL.revokeObjectURL(a.href)
  }
  const active = (rows ?? []).filter((r) => r.status !== 'cancelled')
  return (
    <Modal title={`Registrations: ${h.title}`} onClose={onClose}>
      <Msg msg={msg} />
      {!rows ? <Loading /> : rows.length === 0 ? <Empty title="No registrations yet" /> : (
        <>
          <p className="sl-sub" style={{ marginTop: 0 }}>{active.length} active · {rows.length - active.length} cancelled <button className="sl-mini" style={{ marginLeft: 8 }} onClick={csv}><Download size={13} /> Download CSV</button></p>
          <div className="cit-regs">
            {rows.map((r) => (
              <div key={r.id} className={`cit-reg ${r.status}`}>
                <div><b>{r.name}</b> <StatusBadge s={r.status === 'approved' ? 'approved' : r.status === 'rejected' ? 'rejected' : 'pending'} /> <small>{r.status}</small>
                  <small>{r.email} · {r.phone}{r.school ? ` · ${r.school}` : ''} · {r.level}</small>
                  {r.teamName && <small>Team {r.teamName}{r.members ? `: ${r.members.replace(/\n/g, ', ')}` : ''}</small>}</div>
                <span className="sl-foot-actions">
                  <a className="sl-mini ghost" href={`https://wa.me/${r.phone.replace(/\D/g, '').replace(/^0/, '254')}`} target="_blank" rel="noreferrer noopener"><MessageCircle size={13} /></a>
                  {r.status !== 'cancelled' && r.status !== 'approved' && <button className="sl-mini" onClick={() => decide(r, 'approved')}>Approve</button>}
                  {r.status !== 'cancelled' && r.status !== 'rejected' && <button className="sl-mini danger" onClick={() => decide(r, 'rejected')}>Reject</button>}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </Modal>
  )
}

function LiveModal({ h, onClose, onDone }: { h: Hackathon; onClose: () => void; onDone: () => void }) {
  const [link, setLink] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<Note>(null)
  async function go(on: boolean) {
    setBusy(true); setMsg(null)
    try { await skillsApi.admin.hackLive(h.id, on, link.trim() || undefined); onDone(); onClose() } catch (e) { setMsg({ type: 'err', text: errMsg(e) }) } finally { setBusy(false) }
  }
  return (
    <Modal title={`Live stream: ${h.title}`} onClose={onClose}>
      <div className="sl-form">
        <p className="sl-sub" style={{ margin: 0 }}>{h.liveOn ? 'This competition is LIVE now. Everyone who opens its page sees the stream and chat.' : 'Start your YouTube live stream first, then paste its link here and press Go live. The stream and a live chat appear on the competition page.'}</p>
        <label>YouTube live link<input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://www.youtube.com/watch?v=…" /></label>
        <Msg msg={msg} />
        <span className="sl-foot-actions"><button className="sl-primary small" disabled={busy || (!link.trim() && !h.liveVideoId)} onClick={() => go(true)}><Radio size={14} /> Go live</button>
          {h.liveOn && <button className="sl-mini danger" disabled={busy} onClick={() => go(false)}>Stop live</button>}</span>
      </div>
    </Modal>
  )
}

export function AdminHacks({ tick }: { tick: number }) {
  const [items, setItems] = useState<Hackathon[] | null>(null)
  const [edit, setEdit] = useState<Hackathon | 'new' | null>(null)
  const [regs, setRegs] = useState<Hackathon | null>(null)
  const [live, setLive] = useState<Hackathon | null>(null)
  const [msg, setMsg] = useState<Note>(null)
  const load = useCallback(() => skillsApi.admin.hacks().then(setItems).catch((e) => { setMsg({ type: 'err', text: errMsg(e) }); setItems([]) }), [])
  useEffect(() => { void load() }, [load, tick])
  async function remove(h: Hackathon) {
    if (!window.confirm(`Delete “${h.title}” and all its registrations?`)) return
    try { await skillsApi.admin.deleteHack(h.id); await load() } catch (e) { setMsg({ type: 'err', text: errMsg(e) }) }
  }
  return (
    <>
      <div className="hub-sec"><h2>Hackathons</h2><button className="sl-primary small" onClick={() => setEdit('new')}><Plus size={15} /> Create competition</button></div>
      <Msg msg={msg} />
      {!items ? <Loading /> : items.length === 0 ? <Empty icon={<Trophy size={26} />} title="No competitions yet" text="Create the first one: add a card image, dates and rules." /> : (
        <div className="cit-hk-grid">{items.map((h) => (
          <HackCard key={h.id} h={h}>
            <button className="sl-mini" onClick={() => setRegs(h)}><Users size={13} /> Registrations</button>
            <button className="sl-mini" onClick={() => setLive(h)}><Radio size={13} /> {h.liveOn ? 'Live ●' : 'Go live'}</button>
            <button className="sl-mini" onClick={() => setEdit(h)}><Pencil size={13} /> Edit</button>
            <button className="sl-mini danger" onClick={() => remove(h)}><Trash2 size={13} /></button>
          </HackCard>))}</div>
      )}
      {edit && <HackModal h={edit === 'new' ? undefined : edit} onClose={() => setEdit(null)} onDone={() => void load()} />}
      {regs && <RegsModal h={regs} onClose={() => setRegs(null)} />}
      {live && <LiveModal h={live} onClose={() => setLive(null)} onDone={() => void load()} />}
    </>
  )
}

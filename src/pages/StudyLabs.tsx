import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import type { User } from 'firebase/auth'
import {
  ArrowLeft, BookOpen, Camera, CheckCircle2, ChevronRight, Download, ExternalLink, Eye, FileText, Flag, FolderOpen, Inbox,
  LoaderCircle, Play, Plus, Search, Share2, ShieldCheck, Trash2, Upload, X,
} from 'lucide-react'
import {
  labsApi, labsReady, TYPE_LABELS, EXAM_TYPES, STUDY_IMAGE_MAX_PX, STUDY_IMAGE_QUALITY, yearLabel, semesterLabel, currentAcademicYear,
  shareUrl, resourceIdFromHash, youtubeId, youtubeThumb, PAYWALL_EVENT,
  type AccessInfo, type AccessUser, type AdminUnit, type Countdown, type PaymentInfo,
  type AdminQueue, type ExamType, type LabsConfig, type Programme, type ReportItem, type Resource, type ResourceType, type Suggestion, type Unit,
} from '../lib/labs'
import { fileToB64, shrinkImage } from '../lib/files'
import { CalendarCard, AdminCalendarTab } from './StudyLabsCalendar'
import YouTubePanel from './StudyLabsYoutube'
import WikiPanel from './StudyLabsWikipedia'
import ScanBody from './StudyLabsScan'
import './StudyLabs.css'

type Props = { user: User | null; onSignIn: () => void; onBack: () => void }
type View =
  | { name: 'home' }
  | { name: 'programme'; programme: Programme }
  | { name: 'unit'; unit: Unit; programme?: Programme }
  | { name: 'mine' }
  | { name: 'admin' }
  | { name: 'resource'; id: string }
type Note = { type: 'ok' | 'err'; text: string } | null

const TYPES = Object.keys(TYPE_LABELS) as ResourceType[]
const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong. Please try again.')

function Msg({ msg }: { msg: Note }) {
  if (!msg) return null
  return <p className={`sl-alert ${msg.type === 'ok' ? 'ok' : 'err'}`}>{msg.type === 'ok' && <CheckCircle2 size={16} />}{msg.text}</p>
}
function Loading({ text = 'Loading…' }: { text?: string }) {
  return <div className="sl-empty"><LoaderCircle className="sl-spin" size={22} /><span>{text}</span></div>
}
function Empty({ icon, title, text }: { icon?: ReactNode; title: string; text?: string }) {
  return <div className="sl-empty">{icon ?? <FolderOpen size={26} />}<h3>{title}</h3>{text && <p>{text}</p>}</div>
}
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="sl-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="sl-modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="sl-modal-head"><h2>{title}</h2><button className="sl-icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button></div>
        {children}
      </div>
    </div>
  )
}

/** Direct link to one note, past paper or video: copy, WhatsApp or the phone's share sheet. */
function ShareModal({ resource, onClose }: { resource: Resource; onClose: () => void }) {
  const url = shareUrl(resource.id)
  const [copied, setCopied] = useState(false)
  const text = `${resource.title} · ${resource.unitCode} ${TYPE_LABELS[resource.type]} on Chuka Study Labs`
  const canNative = typeof navigator !== 'undefined' && typeof navigator.share === 'function'
  async function copy() {
    try { await navigator.clipboard.writeText(url) } catch { window.prompt('Copy this link', url) }
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }
  return (
    <Modal title="Share this" onClose={onClose}>
      <div className="sl-form">
        <p className="sl-sub"><strong>{resource.title}</strong><br />{resource.unitCode} · {resource.unitName}</p>
        <div className="sl-share-box">
          <input readOnly value={url} aria-label="Share link" onFocus={(e) => e.currentTarget.select()} />
          <button className="sl-primary small" onClick={copy}>{copied ? 'Copied!' : 'Copy link'}</button>
        </div>
        <div className="sl-decide">
          <a className="sl-mini big" href={`https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`} target="_blank" rel="noreferrer noopener">Share on WhatsApp</a>
          {canNative && <button className="sl-mini ghost big" onClick={() => { void navigator.share({ title: resource.title, text, url }).catch(() => {}) }}>More options…</button>}
        </div>
        <small className="sl-sub">Anyone with this link can open it. It always points to the latest approved version, and stops working if the item is removed.</small>
      </div>
    </Modal>
  )
}

/** Opens a private (pending / own) file. The window is opened first so popup blockers allow it. */
async function openPreview(fileId: string) {
  const w = window.open('', '_blank')
  try {
    const r = await labsApi.preview(fileId)
    if (w) { w.location.href = r.url } else { const a = document.createElement('a'); a.href = r.url; a.download = r.name; a.click() }
    setTimeout(() => URL.revokeObjectURL(r.url), 120000)
  } catch (e) { w?.close(); throw e }
}

function StatusBadge({ s }: { s: Resource['status'] }) {
  return <span className={`sl-badge ${s}`}>{s === 'pending' ? 'Pending review' : s === 'approved' ? 'Approved' : 'Rejected'}</span>
}

/* ------------------------------------------------------------------ */
/* Resource card                                                       */
/* ------------------------------------------------------------------ */
function ResourceCard({ r, showUnit, canReport, onReport, onDelete, onError, admin, children }: {
  r: Resource; showUnit?: boolean; canReport?: boolean; onReport?: (r: Resource) => void; onDelete?: (r: Resource) => void
  onError: (m: string) => void; admin?: boolean; children?: ReactNode
}) {
  const [busyFile, setBusyFile] = useState('')
  const [sharing, setSharing] = useState(false)
  const yt = youtubeId(r.link)
  const preview = async (id: string) => {
    setBusyFile(id)
    try { await openPreview(id) } catch (e) { onError(errMsg(e)) } finally { setBusyFile('') }
  }
  return (
    <article className="sl-resource">
      <div className="sl-resource-top">
        <span className={`sl-type t-${r.type}`}>{TYPE_LABELS[r.type]}</span>
        {r.examType && <span className="sl-chip">{r.examType}</span>}
        {r.academicYear && <span className="sl-chip">{r.academicYear}</span>}
        {r.status !== 'approved' && <StatusBadge s={r.status} />}
      </div>
      <h3>{r.title}</h3>
      {showUnit && <small className="sl-unitline">{r.unitCode} · {r.unitName} · {r.programmeName}</small>}
      {r.description && <p>{r.description}</p>}
      {r.status === 'rejected' && r.rejectReason && <p className="sl-reject">Reason: {r.rejectReason}</p>}
      {yt && (
        <a className="sl-yt-link" href={r.link} target="_blank" rel="noreferrer noopener" aria-label="Watch on YouTube">
          <img src={youtubeThumb(yt)} alt="" loading="lazy" referrerPolicy="no-referrer" /><i><Play size={18} fill="currentColor" /></i>
        </a>
      )}
      {r.link && <a className="sl-link" href={r.link} target="_blank" rel="noreferrer noopener"><ExternalLink size={14} /> Open link</a>}
      {r.files.length > 0 && (
        <ul className="sl-files">
          {r.files.map((f) => (
            <li key={f.id}>
              {f.isImage && f.thumb ? <img src={f.thumb} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <span className="sl-file-ico"><FileText size={18} /></span>}
              <span className="sl-file-name"><strong>{f.name}</strong><small>{f.sizeKB >= 1024 ? `${(f.sizeKB / 1024).toFixed(1)} MB` : `${f.sizeKB} KB`}</small></span>
              {f.view || f.download ? (
                <span className="sl-file-actions">
                  {f.view && <a href={f.view} target="_blank" rel="noreferrer noopener" title="View"><Eye size={15} /></a>}
                  {f.download && <a href={f.download} target="_blank" rel="noreferrer noopener" title="Download"><Download size={15} /></a>}
                </span>
              ) : (
                <button className="sl-mini" disabled={busyFile === f.id} onClick={() => preview(f.id)}>{busyFile === f.id ? '…' : 'Preview'}</button>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="sl-resource-foot">
        <small>{r.uploaderName ? `By ${r.uploaderName}` : 'Anonymous'}{r.createdAt ? ` · ${new Date(r.createdAt).toLocaleDateString('en-KE')}` : ''}{admin && r.uploaderEmail ? ` · ${r.uploaderEmail}` : ''}</small>
        <span className="sl-foot-actions">
          {r.status === 'approved' && <button className="sl-mini" onClick={() => setSharing(true)}><Share2 size={13} /> Share</button>}
          {canReport && onReport && <button className="sl-mini ghost" onClick={() => onReport(r)}><Flag size={13} /> Report</button>}
          {onDelete && <button className="sl-mini danger" onClick={() => onDelete(r)}><Trash2 size={13} /> Delete</button>}
        </span>
      </div>
      {children}
      {sharing && <ShareModal resource={r} onClose={() => setSharing(false)} />}
    </article>
  )
}

/* ------------------------------------------------------------------ */
/* Modals: upload, suggest unit, report                                */
/* ------------------------------------------------------------------ */
function UploadModal({ unit, config, user, onSignIn, onClose, onDone }: { unit: Unit; config: LabsConfig | null; user: User | null; onSignIn: () => void; onClose: () => void; onDone: () => void }) {
  const [type, setType] = useState<ResourceType>('note')
  const [title, setTitle] = useState('')
  const [examType, setExamType] = useState<ExamType>('CAT')
  const [academicYear, setAcademicYear] = useState(currentAcademicYear())
  const [description, setDescription] = useState('')
  const [link, setLink] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<Note>(null)
  const [done, setDone] = useState(false)
  const [findYt, setFindYt] = useState(false)
  const needsExam = type === 'cat' || type === 'paper'
  const maxFiles = config?.maxFiles ?? 5
  const maxFileMB = config?.maxFileMB ?? 10
  const maxTotalMB = config?.maxTotalMB ?? 25
  const allowed = useMemo(() => (config?.extensions ?? []).map((x) => x.replace('.', '').toLowerCase()), [config])

  function pick(list: FileList | null) {
    if (!list) return
    const next = [...files, ...Array.from(list)]
    if (next.length > maxFiles) return setMsg({ type: 'err', text: `You can attach up to ${maxFiles} files.` })
    for (const f of Array.from(list)) {
      const ext = f.name.split('.').pop()?.toLowerCase() ?? ''
      if (allowed.length && !allowed.includes(ext)) return setMsg({ type: 'err', text: `.${ext || '?'} files are not allowed. Allowed: ${allowed.join(', ')}.` })
      if (f.size > maxFileMB * 1024 * 1024 && !f.type.startsWith('image/')) return setMsg({ type: 'err', text: `${f.name} is over ${maxFileMB} MB.` })
    }
    setMsg(null); setFiles(next)
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (title.trim().length < 3) return setMsg({ type: 'err', text: 'Give your upload a clear title.' })
    if (type === 'video' && !link.trim()) return setMsg({ type: 'err', text: 'Paste the video link, or find one on YouTube.' })
    if (type !== 'video' && !files.length && !link.trim()) return setMsg({ type: 'err', text: 'Attach at least one file or paste a link.' })
    setBusy(true); setMsg(null)
    try {
      const out: { name: string; data: string }[] = []
      let total = 0
      for (const f of files) {
        if (f.type.startsWith('image/')) {
          const url = await shrinkImage(f, STUDY_IMAGE_MAX_PX, STUDY_IMAGE_QUALITY)
          const data = url.split(',')[1] ?? ''
          total += data.length * 0.75
          out.push({ name: f.name.replace(/\.[^.]+$/, '') + '.jpg', data })
        } else {
          const data = await fileToB64(f)
          total += data.length * 0.75
          out.push({ name: f.name, data })
        }
      }
      if (total > maxTotalMB * 1024 * 1024) throw new Error(`Files are over ${maxTotalMB} MB in total. Remove some and try again.`)
      await labsApi.submit({
        unitId: unit.id, type, title: title.trim(), description: description.trim(), link: link.trim(),
        ...(needsExam ? { examType, academicYear: academicYear.trim() } : {}), files: type === 'video' ? [] : out,
      })
      setDone(true); onDone()
    } catch (err) { setMsg({ type: 'err', text: errMsg(err) }) } finally { setBusy(false) }
  }

  if (done) {
    return (
      <Modal title="Thank you!" onClose={onClose}>
        <div className="sl-done"><CheckCircle2 size={34} /><p>Your upload was sent for review. It will appear for everyone once an admin approves it. You can track it under <strong>My uploads</strong>.</p><button className="sl-primary" onClick={onClose}>Done</button></div>
      </Modal>
    )
  }
  return (
    <Modal title={`Upload to ${unit.code}`} onClose={onClose}>
      <form className="sl-form" onSubmit={submit}>
        <p className="sl-sub">{unit.name} · {yearLabel(unit.year)}, {semesterLabel(unit.semester)}</p>
        <label>What are you sharing?
          <select value={type} onChange={(e) => { const t = e.target.value as ResourceType; setType(t); if (t === 'video') setFiles([]) }}>{TYPES.map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}</select>
        </label>
        <label>Title<input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Lecture 3 notes, Main exam 2024" maxLength={120} /></label>
        {needsExam && (
          <div className="sl-two">
            <label>Exam type<select value={examType} onChange={(e) => setExamType(e.target.value as ExamType)}>{EXAM_TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
            <label>Academic year<input value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} placeholder="2025/2026" /></label>
          </div>
        )}
        <label>Description (optional)<textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} /></label>
        <label>{type === 'video' ? 'Video link' : 'Link (optional, e.g. a YouTube video)'}<input type="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://" /></label>
        {type === 'video' && (
          <>
            <button type="button" className="sl-ghost" onClick={() => setFindYt(!findYt)}><Play size={14} /> {findYt ? 'Hide YouTube search' : 'Find a video on YouTube'}</button>
            {findYt && (
              <YouTubePanel user={user} onSignIn={onSignIn} defaultQuery={unit.name} pickLabel="Use this video"
                chips={[`${unit.name} lecture`, `${unit.name} tutorial`]}
                onPick={(v) => { setLink(`https://www.youtube.com/watch?v=${v.videoId}`); if (!title.trim()) setTitle(v.title.slice(0, 120)); setFindYt(false) }} />
            )}
          </>
        )}
        {type !== 'video' && (
          <label className="sl-drop"><Upload size={18} /> Choose files
            <input type="file" multiple onChange={(e) => { pick(e.target.files); e.target.value = '' }} />
            <small>Up to {maxFiles} files, {maxFileMB} MB each. Photos are shrunk automatically.</small>
          </label>
        )}
        {files.length > 0 && (
          <ul className="sl-picked">{files.map((f, i) => (
            <li key={`${f.name}${i}`}><FileText size={14} /><span>{f.name}</span><button type="button" className="sl-icon-btn" onClick={() => setFiles(files.filter((_, j) => j !== i))} aria-label="Remove"><X size={14} /></button></li>
          ))}</ul>
        )}
        <Msg msg={msg} />
        <button className="sl-primary" disabled={busy}>{busy ? 'Uploading…' : 'Submit for review'}</button>
      </form>
    </Modal>
  )
}

function SuggestModal({ programme, onClose }: { programme: Programme; onClose: () => void }) {
  const [year, setYear] = useState(1)
  const [semester, setSemester] = useState(1)
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<Note>(null)
  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!code.trim() || !name.trim()) return setMsg({ type: 'err', text: 'Enter the unit code and name.' })
    setBusy(true); setMsg(null)
    try {
      await labsApi.suggestUnit({ programmeId: programme.id, year, semester, code: code.trim(), name: name.trim() })
      setMsg({ type: 'ok', text: 'Thanks! An admin will review your suggestion.' }); setCode(''); setName('')
    } catch (err) { setMsg({ type: 'err', text: errMsg(err) }) } finally { setBusy(false) }
  }
  return (
    <Modal title="Suggest a missing unit" onClose={onClose}>
      <form className="sl-form" onSubmit={submit}>
        <p className="sl-sub">{programme.name}</p>
        <div className="sl-two">
          <label>Year<select value={year} onChange={(e) => setYear(Number(e.target.value))}>{Array.from({ length: programme.years || 4 }, (_, i) => i + 1).map((y) => <option key={y} value={y}>{yearLabel(y)}</option>)}</select></label>
          <label>Semester<select value={semester} onChange={(e) => setSemester(Number(e.target.value))}>{[1, 2, 3].map((s) => <option key={s} value={s}>{semesterLabel(s)}</option>)}</select></label>
        </div>
        <label>Unit code<input value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. COSC 101" /></label>
        <label>Unit name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Introduction to Computer Science" /></label>
        <Msg msg={msg} />
        <button className="sl-primary" disabled={busy}>{busy ? 'Sending…' : 'Send suggestion'}</button>
      </form>
    </Modal>
  )
}

function ReportModal({ resource, onClose }: { resource: Resource; onClose: () => void }) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<Note>(null)
  async function submit(e: FormEvent) {
    e.preventDefault()
    if (reason.trim().length < 5) return setMsg({ type: 'err', text: 'Tell us briefly what is wrong.' })
    setBusy(true); setMsg(null)
    try { await labsApi.report(resource.id, reason.trim()); setMsg({ type: 'ok', text: 'Report sent. Thank you for keeping Study Labs clean.' }) }
    catch (err) { setMsg({ type: 'err', text: errMsg(err) }) } finally { setBusy(false) }
  }
  return (
    <Modal title="Report this upload" onClose={onClose}>
      <form className="sl-form" onSubmit={submit}>
        <p className="sl-sub">{resource.title}</p>
        <label>What is wrong?<textarea rows={4} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Wrong unit, unreadable, inappropriate, copied…" maxLength={400} /></label>
        <Msg msg={msg} />
        <button className="sl-primary" disabled={busy}>{busy ? 'Sending…' : 'Send report'}</button>
      </form>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/* Pages                                                               */
/* ------------------------------------------------------------------ */
function UnitRow({ u, onOpen }: { u: Unit; onOpen: (u: Unit) => void }) {
  const total = TYPES.reduce((n, t) => n + (u.counts?.[t] ?? 0), 0)
  return (
    <button className="sl-unit" onClick={() => onOpen(u)}>
      <span className="sl-unit-code">{u.code}</span>
      <span className="sl-unit-name"><strong>{u.name}</strong>{u.programmeName && <small>{u.programmeName}</small>}</span>
      <span className="sl-unit-counts">{total > 0 ? TYPES.filter((t) => u.counts?.[t]).map((t) => `${u.counts[t]} ${TYPE_LABELS[t].toLowerCase()}`).join(' · ') : 'No uploads yet'}</span>
      <ChevronRight size={16} />
    </button>
  )
}

function Home({ programmes, loading, onProgramme, onUnit, onResourceError, user, onReport, isAdmin, onScan }: {
  programmes: Programme[]; loading: boolean; onProgramme: (p: Programme) => void; onUnit: (u: Unit) => void
  onResourceError: (m: string) => void; user: User | null; onReport: (r: Resource) => void; isAdmin: boolean; onScan: () => void
}) {
  const [q, setQ] = useState('')
  const [level, setLevel] = useState('All')
  const [results, setResults] = useState<{ units: Unit[]; resources: Resource[] } | null>(null)
  const [searching, setSearching] = useState(false)
  const [err, setErr] = useState<Note>(null)
  const levels = useMemo(() => ['All', ...Array.from(new Set(programmes.map((p) => p.level).filter(Boolean)))], [programmes])
  const filtered = programmes.filter((p) => p.active && (level === 'All' || p.level === level))
  const term = q.trim().toLowerCase()

  // Courses are matched instantly in the browser: every word typed must appear somewhere in the name, level or department.
  const matchedProgrammes = useMemo(() => {
    if (!term) return []
    const words = term.split(/\s+/).filter(Boolean)
    return programmes.filter((p) => p.active && words.every((w) => `${p.name} ${p.level} ${p.department}`.toLowerCase().includes(w))).slice(0, 12)
  }, [programmes, term])

  // Units and uploads are searched on the server shortly after typing stops. Any single letter works.
  useEffect(() => {
    if (!term) { setResults(null); setSearching(false); setErr(null); return }
    let live = true
    setSearching(true)
    const t = setTimeout(() => {
      labsApi.search(term)
        .then((r) => { if (live) { setResults(r); setErr(null) } })
        .catch((ex) => { if (live) setErr({ type: 'err', text: errMsg(ex) }) })
        .finally(() => { if (live) setSearching(false) })
    }, 250)
    return () => { live = false; clearTimeout(t) }
  }, [term])

  async function removeResource(r: Resource) {
    if (!window.confirm(`Delete “${r.title}” for everyone? This cannot be undone.`)) return
    try {
      await labsApi.admin.deleteResource(r.id)
      setResults((cur) => (cur ? { ...cur, resources: cur.resources.filter((x) => x.id !== r.id) } : cur))
    } catch (ex) { onResourceError(errMsg(ex)) }
  }

  const searchingNow = Boolean(term)
  const nothing = results !== null && !searching && matchedProgrammes.length === 0 && results.units.length === 0 && results.resources.length === 0

  return (
    <>
      <section className="sl-hero">
        <div>
          <span className="sl-kicker">CHUKA STUDY LABS</span>
          <h1>Notes, CATs &amp; past papers <em>by comrades, for comrades</em></h1>
          <p>Find your programme, open your unit and download what other students have shared. Add your own to help the next class.</p>
          <button className="sl-primary inline" onClick={onScan}><Camera size={15} /> Scan a CAT or paper</button>
        </div>
        <div className="sl-hero-art"><BookOpen size={46} /><span>Study together</span></div>
      </section>

      <form className="sl-search" onSubmit={(e) => e.preventDefault()}>
        <Search size={18} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search any letters: a course, unit code, unit name or resource…" aria-label="Search" autoComplete="off" />
        {searching ? <LoaderCircle className="sl-spin" size={16} /> : q && <button type="button" className="sl-icon-btn" onClick={() => setQ('')} aria-label="Clear search"><X size={16} /></button>}
      </form>
      <Msg msg={err} />

      {searchingNow ? (
        <>
          <div className="sl-section-head"><h2>Results for “{q.trim()}”</h2><button className="sl-mini ghost" onClick={() => setQ('')}>Clear</button></div>
          {matchedProgrammes.length > 0 && (
            <section className="sl-group"><h2>Courses</h2>
              <div className="sl-prog-grid">
                {matchedProgrammes.map((p) => (
                  <button key={p.id} className="sl-prog" onClick={() => onProgramme(p)}>
                    <span className="sl-prog-ico"><BookOpen size={18} /></span>
                    <span><strong>{p.name}</strong><small>{[p.level, p.department].filter(Boolean).join(' · ')}</small></span>
                    <ChevronRight size={16} />
                  </button>
                ))}
              </div>
            </section>
          )}
          {results && results.units.length > 0 && <section className="sl-group"><h2>Units</h2><div className="sl-unit-list">{results.units.map((u) => <UnitRow key={u.id} u={u} onOpen={onUnit} />)}</div></section>}
          {results && results.resources.length > 0 && (
            <section className="sl-group"><h2>Notes, papers &amp; videos</h2>
              <div className="sl-grid">{results.resources.map((r) => <ResourceCard key={r.id} r={r} showUnit canReport={Boolean(user)} onReport={onReport} onDelete={isAdmin ? removeResource : undefined} onError={onResourceError} admin={isAdmin} />)}</div>
            </section>
          )}
          {nothing && <Empty title="Nothing found" text="Try fewer letters, or browse by programme below." />}
          {results === null && matchedProgrammes.length === 0 && <Loading text="Searching…" />}
        </>
      ) : (
        <>
          <CalendarCard isAdmin={isAdmin} />
          <div className="sl-section-head"><h2>Choose your programme</h2></div>
          {levels.length > 2 && <div className="sl-tabs">{levels.map((l) => <button key={l} className={level === l ? 'on' : ''} onClick={() => setLevel(l)}>{l}</button>)}</div>}
          {loading ? <Loading /> : filtered.length === 0 ? <Empty title="No programmes yet" text="An admin still needs to add programmes. Check back soon." /> : (
            <div className="sl-prog-grid">
              {filtered.map((p) => (
                <button key={p.id} className="sl-prog" onClick={() => onProgramme(p)}>
                  <span className="sl-prog-ico"><BookOpen size={18} /></span>
                  <span><strong>{p.name}</strong><small>{[p.level, p.department].filter(Boolean).join(' · ')}</small></span>
                  <ChevronRight size={16} />
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </>
  )
}

function ProgrammePage({ programme, user, onUnit, onSuggest, onSignIn }: { programme: Programme; user: User | null; onUnit: (u: Unit) => void; onSuggest: () => void; onSignIn: () => void }) {
  const [units, setUnits] = useState<Unit[] | null>(null)
  const [err, setErr] = useState<Note>(null)
  useEffect(() => {
    let live = true
    labsApi.units(programme.id).then((u) => { if (live) setUnits(u) }).catch((e) => { if (live) { setErr({ type: 'err', text: errMsg(e) }); setUnits([]) } })
    return () => { live = false }
  }, [programme.id])
  const groups = useMemo(() => {
    const m = new Map<string, Unit[]>()
    for (const u of [...(units ?? [])].sort((a, b) => a.year - b.year || a.semester - b.semester || a.code.localeCompare(b.code))) {
      const k = `${yearLabel(u.year)} · ${semesterLabel(u.semester)}`
      m.set(k, [...(m.get(k) ?? []), u])
    }
    return [...m.entries()]
  }, [units])
  return (
    <>
      <div className="sl-page-head"><div><span className="sl-kicker">PROGRAMME</span><h1>{programme.name}</h1><small>{[programme.level, programme.department].filter(Boolean).join(' · ')}</small></div>
        <button className="sl-ghost" onClick={user ? onSuggest : onSignIn}><Plus size={15} /> Suggest a missing unit</button></div>
      <Msg msg={err} />
      {units === null ? <Loading /> : groups.length === 0 ? <Empty title="No units yet" text="Know a unit that belongs here? Suggest it and an admin will add it." /> : groups.map(([label, list]) => (
        <section key={label} className="sl-group"><h2>{label}</h2><div className="sl-unit-list">{list.map((u) => <UnitRow key={u.id} u={u} onOpen={onUnit} />)}</div></section>
      ))}
    </>
  )
}

function UnitPage({ unit, user, config, isAdmin, onSignIn, onReport }: { unit: Unit; user: User | null; config: LabsConfig | null; isAdmin: boolean; onSignIn: () => void; onReport: (r: Resource) => void }) {
  const [type, setType] = useState<ResourceType | 'all' | 'youtube' | 'wiki'>('all')
  const [list, setList] = useState<Resource[] | null>(null)
  const [msg, setMsg] = useState<Note>(null)
  const [uploading, setUploading] = useState(false)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    let live = true
    setList(null)
    labsApi.resources(unit.id).then((r) => { if (live) setList(r) }).catch((e) => { if (live) { setMsg({ type: 'err', text: errMsg(e) }); setList([]) } })
    return () => { live = false }
  }, [unit.id, tick])
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: list?.length ?? 0 }
    for (const r of list ?? []) c[r.type] = (c[r.type] ?? 0) + 1
    return c
  }, [list])
  const shown = (list ?? []).filter((r) => type === 'all' || r.type === type)
  async function removeResource(r: Resource) {
    if (!window.confirm(`Delete “${r.title}” for everyone? This cannot be undone.`)) return
    try { await labsApi.admin.deleteResource(r.id); setMsg({ type: 'ok', text: 'Deleted.' }); setTick((n) => n + 1) } catch (e) { setMsg({ type: 'err', text: errMsg(e) }) }
  }
  /** A YouTube pick is sent for review as a video for this unit, like any other upload. */
  async function suggestVideo(v: { videoId: string; title: string }) {
    await labsApi.submit({ unitId: unit.id, type: 'video', title: v.title.slice(0, 120), link: `https://www.youtube.com/watch?v=${v.videoId}`, description: 'Found through YouTube search.' })
    return 'Sent for review. It will show here once an admin approves it. Track it under My uploads.'
  }
  return (
    <>
      <div className="sl-page-head"><div><span className="sl-kicker">{unit.code}</span><h1>{unit.name}</h1><small>{unit.programmeName ? `${unit.programmeName} · ` : ''}{yearLabel(unit.year)}, {semesterLabel(unit.semester)}</small></div>
        <button className="sl-primary inline" onClick={user ? () => setUploading(true) : onSignIn}><Upload size={15} /> {user ? 'Upload' : 'Sign in to upload'}</button></div>
      <div className="sl-tabs">
        {(['all', ...TYPES] as const).map((t) => <button key={t} className={type === t ? 'on' : ''} onClick={() => setType(t)}>{t === 'all' ? 'All' : TYPE_LABELS[t]} <b>{counts[t] ?? 0}</b></button>)}
        <button className={`yt${type === 'youtube' ? ' on' : ''}`} onClick={() => setType('youtube')}><Play size={13} /> Find on YouTube</button>
        <button className={`yt${type === 'wiki' ? ' on' : ''}`} onClick={() => setType('wiki')}><BookOpen size={13} /> Wikipedia</button>
      </div>
      <Msg msg={msg} />
      {type === 'wiki' ? (
        <WikiPanel user={user} onSignIn={onSignIn} defaultQuery={unit.name} chips={[unit.name, `${unit.name} introduction`]} />
      ) : type === 'youtube' ? (
        <YouTubePanel user={user} onSignIn={onSignIn} defaultQuery={unit.name}
          chips={[`${unit.name} lecture`, `${unit.name} tutorial`, `${unit.code} ${unit.name} revision`]}
          onPick={suggestVideo} pickLabel="Share with class" />
      ) : list === null ? <Loading /> : shown.length === 0 ? <Empty icon={<Inbox size={26} />} title="Nothing here yet" text="Be the first to share something for this unit." /> : (
        <div className="sl-grid">{shown.map((r) => <ResourceCard key={r.id} r={r} canReport={Boolean(user)} onReport={onReport} onDelete={isAdmin ? removeResource : undefined} admin={isAdmin} onError={(m) => setMsg({ type: 'err', text: m })} />)}</div>
      )}
      {uploading && <UploadModal unit={unit} config={config} user={user} onSignIn={onSignIn} onClose={() => setUploading(false)} onDone={() => setTick((n) => n + 1)} />}
    </>
  )
}

/** Opened from a share link: #/labs/r/<id>. */
function ResourcePage({ id, user, isAdmin, onOpenUnit, onSignIn, onReport }: {
  id: string; user: User | null; isAdmin: boolean; onOpenUnit: (u: Unit) => void; onSignIn: () => void; onReport: (r: Resource) => void
}) {
  const [r, setR] = useState<Resource | null>(null)
  const [msg, setMsg] = useState<Note>(null)
  const [gone, setGone] = useState(false)
  useEffect(() => {
    let live = true
    setR(null); setMsg(null); setGone(false)
    labsApi.resource(id).then((x) => { if (live) setR(x) }).catch((e) => { if (live) { setMsg({ type: 'err', text: errMsg(e) }); setGone(true) } })
    return () => { live = false }
  }, [id, user?.uid])
  async function remove(x: Resource) {
    if (!window.confirm(`Delete “${x.title}” for everyone? This cannot be undone.`)) return
    try { await labsApi.admin.deleteResource(x.id); setR(null); setGone(true); setMsg({ type: 'ok', text: 'Deleted.' }) } catch (e) { setMsg({ type: 'err', text: errMsg(e) }) }
  }
  const unit: Unit | null = r ? (r.unit ?? { id: r.unitId, programmeId: r.programmeId, year: r.year, semester: r.semester, code: r.unitCode, name: r.unitName, programmeName: r.programmeName, counts: { note: 0, cat: 0, paper: 0, video: 0 } }) : null
  return (
    <>
      <div className="sl-page-head"><div><span className="sl-kicker">SHARED WITH YOU</span><h1>{r ? r.title : 'Shared item'}</h1>{r && <small>{r.unitCode} · {r.unitName}</small>}</div>
        {unit && <button className="sl-primary inline" onClick={() => onOpenUnit(unit)}><BookOpen size={15} /> Open {unit.code}</button>}</div>
      <Msg msg={msg} />
      {!r && !gone && <Loading />}
      {gone && !user && <p className="sl-sub">If this was your own upload or it is still pending, sign in to see it. <button className="sl-mini" onClick={onSignIn}>Sign in</button></p>}
      {r && <div className="sl-single"><ResourceCard r={r} showUnit admin={isAdmin} canReport={Boolean(user) && r.status === 'approved'} onReport={onReport} onDelete={isAdmin ? remove : undefined} onError={(m) => setMsg({ type: 'err', text: m })} /></div>}
    </>
  )
}

function MinePage() {
  const [data, setData] = useState<{ resources: Resource[]; suggestions: Suggestion[] } | null>(null)
  const [msg, setMsg] = useState<Note>(null)
  const load = useCallback(() => labsApi.myUploads().then(setData).catch((e) => { setMsg({ type: 'err', text: errMsg(e) }); setData({ resources: [], suggestions: [] }) }), [])
  useEffect(() => { void load() }, [load])
  async function del(r: Resource) {
    if (!window.confirm(`Delete “${r.title}”?`)) return
    try { await labsApi.deleteMine(r.id); await load() } catch (e) { setMsg({ type: 'err', text: errMsg(e) }) }
  }
  return (
    <>
      <div className="sl-page-head"><div><span className="sl-kicker">YOUR ACCOUNT</span><h1>My uploads</h1></div></div>
      <Msg msg={msg} />
      {!data ? <Loading /> : (
        <>
          {data.resources.length === 0 ? <Empty icon={<Inbox size={26} />} title="No uploads yet" text="Open a unit and tap Upload to share notes or past papers." /> : (
            <div className="sl-grid">{data.resources.map((r) => <ResourceCard key={r.id} r={r} showUnit onDelete={del} onError={(m) => setMsg({ type: 'err', text: m })} />)}</div>
          )}
          {data.suggestions.length > 0 && (
            <section className="sl-group"><h2>My unit suggestions</h2>
              <div className="sl-unit-list">{data.suggestions.map((s) => (
                <div key={s.id} className="sl-unit static"><span className="sl-unit-code">{s.code}</span><span className="sl-unit-name"><strong>{s.name}</strong><small>{s.programmeName} · {yearLabel(s.year)}, {semesterLabel(s.semester)}</small></span><span className={`sl-badge ${s.status}`}>{s.status}</span></div>
              ))}</div>
            </section>
          )}
        </>
      )}
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Admin                                                               */
/* ------------------------------------------------------------------ */
function AdminPage({ onCatalogueChanged }: { onCatalogueChanged: () => void }) {
  const [tab, setTab] = useState<'queue' | 'library' | 'calendar' | 'reports' | 'suggestions' | 'catalogue' | 'access' | 'countdown'>('queue')
  const [queue, setQueue] = useState<AdminQueue | null>(null)
  const [msg, setMsg] = useState<Note>(null)
  const loadQueue = useCallback(() => labsApi.admin.queue().then(setQueue).catch((e) => setMsg({ type: 'err', text: errMsg(e) })), [])
  useEffect(() => { void loadQueue() }, [loadQueue])
  return (
    <>
      <div className="sl-page-head"><div><span className="sl-kicker">ADMIN</span><h1>Study Labs admin</h1></div></div>
      <div className="sl-tabs">
        <button className={tab === 'queue' ? 'on' : ''} onClick={() => setTab('queue')}>Review queue <b>{queue?.pending.length ?? 0}</b></button>
        <button className={tab === 'library' ? 'on' : ''} onClick={() => setTab('library')}>Library</button>
        <button className={tab === 'calendar' ? 'on' : ''} onClick={() => setTab('calendar')}>Calendar</button>
        <button className={tab === 'reports' ? 'on' : ''} onClick={() => setTab('reports')}>Reports <b>{queue?.openReports ?? 0}</b></button>
        <button className={tab === 'suggestions' ? 'on' : ''} onClick={() => setTab('suggestions')}>Suggestions <b>{queue?.pendingSuggestions ?? 0}</b></button>
        <button className={tab === 'catalogue' ? 'on' : ''} onClick={() => setTab('catalogue')}>Programmes &amp; units</button>
        <button className={tab === 'access' ? 'on' : ''} onClick={() => setTab('access')}>Access &amp; payments</button>
        <button className={tab === 'countdown' ? 'on' : ''} onClick={() => setTab('countdown')}>Exam countdown</button>
      </div>
      <Msg msg={msg} />
      {tab === 'queue' && <QueueTab queue={queue} reload={loadQueue} setMsg={setMsg} />}
      {tab === 'library' && <LibraryTab setMsg={setMsg} reload={loadQueue} />}
      {tab === 'calendar' && <AdminCalendarTab setMsg={setMsg} />}
      {tab === 'reports' && <ReportsTab reload={loadQueue} setMsg={setMsg} />}
      {tab === 'suggestions' && <SuggestionsTab expected={queue?.pendingSuggestions ?? 0} reload={loadQueue} setMsg={setMsg} onChanged={onCatalogueChanged} />}
      {tab === 'catalogue' && <CatalogueTab setMsg={setMsg} onChanged={onCatalogueChanged} />}
      {tab === 'access' && <AccessTab setMsg={setMsg} />}
      {tab === 'countdown' && <CountdownTab setMsg={setMsg} />}
    </>
  )
}


/* ---------- free trial + support payment ---------- */

const FALLBACK_PAY: PaymentInfo = {
  priceKes: 50, trialDays: 14, whatsapp: '254184198432',
  whatsappLink: 'https://wa.me/254184198432?text=' + encodeURIComponent('Hello, I would like to activate my Chuka Study Labs access. I have sent KSh 50.'),
  note: 'Send KSh 50 to the admin, then WhatsApp the admin with your M-Pesa confirmation message and the email you sign in with. You will be activated shortly. Thank you for supporting Study Labs!',
}

function PaywallModal({ payment, email, onClose }: { payment: PaymentInfo | null; email?: string | null; onClose: () => void }) {
  const p = payment ?? FALLBACK_PAY
  const link = email ? `${p.whatsappLink}${encodeURIComponent(' (' + email + ')')}` : p.whatsappLink
  return (
    <Modal title="Your free trial has ended" onClose={onClose}>
      <p>You enjoyed {p.trialDays} days of Study Labs free. To keep going, support the database with <b>KSh {p.priceKes}</b>.</p>
      <ol>
        <li>Send <b>KSh {p.priceKes}</b> as the admin directs.</li>
        <li>Chat the admin on WhatsApp <b>+{p.whatsapp}</b> with your payment message{email ? <> and your email <b>{email}</b></> : null}.</li>
        <li>You will be activated, and you can keep studying.</li>
      </ol>
      <p>{p.note}</p>
      <a className="sl-primary inline" href={link} target="_blank" rel="noopener noreferrer">Chat admin on WhatsApp</a>
      <p><b>Thank you for the support!</b></p>
    </Modal>
  )
}

function TrialBanner({ access, onPay }: { access: AccessInfo | null; onPay: () => void }) {
  if (!access || access.status === 'admin') return null
  if (access.status === 'paid') {
    return access.daysLeft <= 7 ? <p className="sl-alert ok">Your access runs for {access.daysLeft} more day{access.daysLeft === 1 ? '' : 's'}. Thank you for the support!</p> : null
  }
  if (access.status === 'trial') {
    return <p className="sl-alert ok">Free trial: {access.daysLeft} day{access.daysLeft === 1 ? '' : 's'} left. After that, support Study Labs with KSh {access.payment.priceKes}. <button className="sl-mini" onClick={onPay}>How to pay</button></p>
  }
  return <p className="sl-alert err">Your free trial has ended. <button className="sl-mini" onClick={onPay}>Activate with KSh {access.payment.priceKes}</button></p>
}

/** Admin: set the exam countdown shown at the top of the landing page. */
function CountdownTab({ setMsg }: { setMsg: (n: Note) => void }) {
  const [cur, setCur] = useState<Countdown | null>(null)
  const [title, setTitle] = useState('Main exams start in')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('08:00')
  const [endDate, setEndDate] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    labsApi.countdown().then((r) => {
      setCur(r)
      if (r.set) { setTitle(r.title ?? ''); setDate(r.date ?? ''); setTime(r.time ?? '08:00'); setEndDate(r.endDate && r.endDate !== r.date ? r.endDate : '') }
    }).catch((e) => setMsg({ type: 'err', text: errMsg(e) }))
  }, [setMsg])
  async function save(e: FormEvent) {
    e.preventDefault()
    if (!title.trim() || !date) return setMsg({ type: 'err', text: 'Enter a title and the exam date.' })
    setBusy(true)
    try { setCur(await labsApi.admin.setCountdown({ title: title.trim(), date, time, endDate: endDate || undefined })); setMsg({ type: 'ok', text: 'Countdown saved. It is now at the top of the landing page.' }) }
    catch (err) { setMsg({ type: 'err', text: errMsg(err) }) } finally { setBusy(false) }
  }
  async function clear() {
    if (!window.confirm('Remove the countdown from the landing page?')) return
    setBusy(true)
    try { setCur(await labsApi.admin.clearCountdown()); setDate(''); setEndDate(''); setMsg({ type: 'ok', text: 'Countdown removed.' }) }
    catch (err) { setMsg({ type: 'err', text: errMsg(err) }) } finally { setBusy(false) }
  }
  return (
    <div className="sl-card">
      <h2>Exam countdown</h2>
      <p>{cur?.set ? `Showing now: ${cur.title} on ${cur.date}.` : 'No countdown is showing on the landing page.'}</p>
      <form className="sl-form" onSubmit={save}>
        <label>Title<input value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} placeholder="Main exams start in" /></label>
        <label>First exam date<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <label>Start time (Nairobi)<input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></label>
        <label>Last exam date (optional)<input type="date" value={endDate} min={date || undefined} onChange={(e) => setEndDate(e.target.value)} /></label>
        <div className="sl-row-actions">
          <button className="sl-primary small" disabled={busy}>Save countdown</button>
          {cur?.set && <button type="button" className="sl-mini ghost" disabled={busy} onClick={() => void clear()}>Remove</button>}
        </div>
      </form>
    </div>
  )
}

/** Admin: activate a student after they pay, see who is on trial, paid or expired. */
function AccessTab({ setMsg }: { setMsg: (n: Note) => void }) {
  const [q, setQ] = useState('')
  const [email, setEmail] = useState('')
  const [days, setDays] = useState('')
  const [busy, setBusy] = useState(false)
  const [items, setItems] = useState<AccessUser[] | null>(null)
  const load = useCallback(() => labsApi.admin.users(q.trim() || undefined).then(setItems).catch((e) => { setMsg({ type: 'err', text: errMsg(e) }); setItems([]) }), [q, setMsg])
  useEffect(() => { const t = setTimeout(() => { void load() }, 300); return () => clearTimeout(t) }, [load])
  async function activate(addr: string, d?: number) {
    setBusy(true)
    try { const u = await labsApi.admin.activate(addr.trim(), d); setMsg({ type: 'ok', text: `${u.email} is active until ${u.paidUntil.slice(0, 10)}.` }); setEmail(''); setDays(''); await load() }
    catch (e) { setMsg({ type: 'err', text: errMsg(e) }) } finally { setBusy(false) }
  }
  async function revoke(addr: string) {
    if (!window.confirm(`End paid access for ${addr}?`)) return
    try { await labsApi.admin.deactivate(addr); await load() } catch (e) { setMsg({ type: 'err', text: errMsg(e) }) }
  }
  return (
    <div className="sl-card">
      <h2>Activate a student</h2>
      <form className="sl-form inline" onSubmit={(e) => { e.preventDefault(); if (email.trim()) void activate(email, days ? Number(days) : undefined) }}>
        <input type="email" placeholder="Student email (the one they sign in with)" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input type="number" min={1} max={400} placeholder="Days (default 120)" value={days} onChange={(e) => setDays(e.target.value)} />
        <button className="sl-primary small" disabled={busy || !email.trim()}>Activate</button>
      </form>
      <h2>Students</h2>
      <input placeholder="Search by email or name" value={q} onChange={(e) => setQ(e.target.value)} />
      {!items ? <Loading /> : items.length === 0 ? <Empty title="No students yet" /> : items.map((u) => (
        <div key={u.email} className="sl-row-actions">
          <span><b>{u.name || u.email}</b> · {u.email} · {u.status}{u.paidUntil ? ` · until ${u.paidUntil.slice(0, 10)}` : ''}</span>
          <button className="sl-mini" disabled={busy} onClick={() => void activate(u.email)}>+ Activate</button>
          {u.status === 'paid' && <button className="sl-mini ghost" onClick={() => void revoke(u.email)}>End access</button>}
        </div>
      ))}
    </div>
  )
}

/** Every upload (approved, pending, rejected). Search by any letters and delete what should not be there. */
function LibraryTab({ setMsg, reload }: { setMsg: (n: Note) => void; reload: () => Promise<unknown> }) {
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<'' | 'approved' | 'pending' | 'rejected'>('approved')
  const [items, setItems] = useState<Resource[] | null>(null)
  useEffect(() => {
    let live = true
    setItems(null)
    const t = setTimeout(() => {
      labsApi.admin.resources({ q: q.trim() || undefined, status: status || undefined })
        .then((r) => { if (live) setItems(r) })
        .catch((e) => { if (live) { setMsg({ type: 'err', text: errMsg(e) }); setItems([]) } })
    }, 250)
    return () => { live = false; clearTimeout(t) }
  }, [q, status, setMsg])
  async function remove(r: Resource) {
    if (!window.confirm(`Delete “${r.title}” for good? Its files are removed from Drive too.`)) return
    setMsg(null)
    try { await labsApi.admin.deleteResource(r.id); setItems((cur) => (cur ? cur.filter((x) => x.id !== r.id) : cur)); setMsg({ type: 'ok', text: 'Deleted.' }); void reload() }
    catch (e) { setMsg({ type: 'err', text: errMsg(e) }) }
  }
  return (
    <>
      <div className="sl-search"><Search size={18} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title, unit code or unit name…" aria-label="Search library" />
        <select className="sl-select" value={status} onChange={(e) => setStatus(e.target.value as typeof status)} aria-label="Status"><option value="approved">Approved</option><option value="pending">Pending</option><option value="rejected">Rejected</option><option value="">All</option></select></div>
      {items === null ? <Loading /> : items.length === 0 ? <Empty icon={<Inbox size={26} />} title="Nothing found" /> : (
        <>
          {items.length >= 200 && <p className="sl-sub">Showing the newest 200. Search to narrow it down.</p>}
          <div className="sl-grid">{items.map((r) => <ResourceCard key={r.id} r={r} showUnit admin onDelete={remove} onError={(m) => setMsg({ type: 'err', text: m })} />)}</div>
        </>
      )}
    </>
  )
}

function QueueTab({ queue, reload, setMsg }: { queue: AdminQueue | null; reload: () => Promise<unknown>; setMsg: (n: Note) => void }) {
  const [busy, setBusy] = useState('')
  const [reasons, setReasons] = useState<Record<string, string>>({})
  if (!queue) return <Loading />
  async function decide(r: Resource, decision: 'approve' | 'reject') {
    if (decision === 'reject' && !(reasons[r.id] ?? '').trim()) return setMsg({ type: 'err', text: 'Add a short rejection reason first.' })
    setBusy(r.id); setMsg(null)
    try { await labsApi.admin.review(r.id, decision, { reason: reasons[r.id]?.trim() }); setMsg({ type: 'ok', text: decision === 'approve' ? 'Approved and published.' : 'Rejected.' }); await reload() }
    catch (e) { setMsg({ type: 'err', text: errMsg(e) }) } finally { setBusy('') }
  }
  if (queue.pending.length === 0) return <Empty icon={<CheckCircle2 size={26} />} title="All caught up" text="No uploads are waiting for review." />
  return (
    <div className="sl-grid">
      {queue.pending.map((r) => (
        <ResourceCard key={r.id} r={r} showUnit admin onError={(m) => setMsg({ type: 'err', text: m })}>
          {r.duplicates && r.duplicates.length > 0 && <p className="sl-reject">Possible duplicate of: {r.duplicates.map((d) => d.title).join(', ')}</p>}
          <input className="sl-reason" placeholder="Rejection reason (only needed to reject)" value={reasons[r.id] ?? ''} onChange={(e) => setReasons({ ...reasons, [r.id]: e.target.value })} />
          <div className="sl-decide">
            <button className="sl-primary small" disabled={busy === r.id} onClick={() => decide(r, 'approve')}>Approve</button>
            <button className="sl-mini danger big" disabled={busy === r.id} onClick={() => decide(r, 'reject')}>Reject</button>
          </div>
        </ResourceCard>
      ))}
    </div>
  )
}

function ReportsTab({ reload, setMsg }: { reload: () => Promise<unknown>; setMsg: (n: Note) => void }) {
  const [items, setItems] = useState<ReportItem[] | null>(null)
  const load = useCallback(() => labsApi.admin.reports().then(setItems).catch((e) => { setMsg({ type: 'err', text: errMsg(e) }); setItems([]) }), [setMsg])
  useEffect(() => { void load() }, [load])
  async function resolve(id: string, resolution: 'dismiss' | 'unpublish' | 'delete') {
    if (resolution === 'delete' && !window.confirm('Delete this upload for good?')) return
    try { await labsApi.admin.resolveReport(id, resolution); await load(); await reload() } catch (e) { setMsg({ type: 'err', text: errMsg(e) }) }
  }
  if (!items) return <Loading />
  if (items.length === 0) return <Empty icon={<CheckCircle2 size={26} />} title="No open reports" />
  return (
    <div className="sl-grid">
      {items.map((it) => (
        <div key={it.id} className="sl-resource">
          <p className="sl-reject"><Flag size={13} /> {it.reason}</p>
          {it.resource ? <ResourceCard r={it.resource} showUnit admin onError={(m) => setMsg({ type: 'err', text: m })} /> : <p className="sl-sub">The upload no longer exists.</p>}
          <div className="sl-decide">
            <button className="sl-mini ghost big" onClick={() => resolve(it.id, 'dismiss')}>Dismiss</button>
            <button className="sl-mini big" onClick={() => resolve(it.id, 'unpublish')}>Unpublish</button>
            <button className="sl-mini danger big" onClick={() => resolve(it.id, 'delete')}>Delete</button>
          </div>
        </div>
      ))}
    </div>
  )
}

function SuggestionsTab({ expected, reload, setMsg, onChanged }: { expected: number; reload: () => Promise<unknown>; setMsg: (n: Note) => void; onChanged: () => void }) {
  const [items, setItems] = useState<Suggestion[] | null>(null)
  const load = useCallback(() => labsApi.admin.suggestions().then(setItems).catch((e) => { setMsg({ type: 'err', text: errMsg(e) }); setItems([]) }), [setMsg])
  useEffect(() => { void load() }, [load])
  async function decide(s: Suggestion, decision: 'approve' | 'reject') {
    try {
      await labsApi.admin.decideSuggestion(s.id, decision, decision === 'reject' ? { reason: 'Not needed' } : {})
      await load(); await reload(); if (decision === 'approve') onChanged()
    } catch (e) { setMsg({ type: 'err', text: errMsg(e) }) }
  }
  if (!items) return <Loading />
  // Be forgiving about how the sheet spells the status ("Pending", " pending ", or blank = still waiting).
  const pending = items.filter((s) => { const st = String(s.status ?? '').trim().toLowerCase(); return st === '' || st === 'pending' })
  if (pending.length === 0) {
    return (
      <>
        <Empty icon={<CheckCircle2 size={26} />} title="No pending suggestions" />
        {items.length > 0 && <p className="sl-sub" style={{ textAlign: 'center' }}>The server returned {items.length} suggestion(s), none of them pending.</p>}
      </>
    )
  }
  return (
    <div className="sl-unit-list">
      {expected > pending.length && <p className="sl-sub">The server counts {expected} pending but sent only {pending.length}. In Apps Script use Deploy &gt; Manage deployments &gt; Edit &gt; New version, then reload.</p>}
      {pending.map((s) => (
        <div key={s.id} className="sl-unit static">
          <span className="sl-unit-code">{s.code}</span>
          <span className="sl-unit-name"><strong>{s.name}</strong><small>{s.programmeName} · {yearLabel(s.year)}, {semesterLabel(s.semester)}{s.userEmail ? ` · ${s.userEmail}` : ''}</small></span>
          <span className="sl-foot-actions"><button className="sl-mini" onClick={() => decide(s, 'approve')}>Approve</button><button className="sl-mini danger" onClick={() => decide(s, 'reject')}>Reject</button></span>
        </div>
      ))}
    </div>
  )
}


/** Admin: all units of one programme grouped by year and semester. Edit, move, hide, delete. */
function UnitManager({ programme, refreshToken, setMsg, onChanged }: { programme: Programme; refreshToken: number; setMsg: (n: Note) => void; onChanged: () => void }) {
  const [units, setUnits] = useState<AdminUnit[] | null>(null)
  const [editId, setEditId] = useState('')
  const [draft, setDraft] = useState({ code: '', name: '', year: 1, semester: 1 })
  const [picked, setPicked] = useState<string[]>([])
  const [mv, setMv] = useState({ year: 1, semester: 1 })
  const [busy, setBusy] = useState(false)
  const load = useCallback(() => labsApi.admin.units(programme.id).then(setUnits).catch((e) => { setMsg({ type: 'err', text: errMsg(e) }); setUnits([]) }), [programme.id, setMsg])
  useEffect(() => { void load() }, [load, refreshToken])

  async function act(fn: () => Promise<string>) {
    setBusy(true)
    try { setMsg({ type: 'ok', text: await fn() }); await load(); onChanged() } catch (e) { setMsg({ type: 'err', text: errMsg(e) }) } finally { setBusy(false) }
  }
  function startEdit(u: AdminUnit) { setEditId(u.id); setDraft({ code: u.code, name: u.name, year: u.year, semester: u.semester }) }
  function toggle(id: string) { setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id])) }

  if (!units) return <Loading />
  const years = Array.from({ length: Math.max(programme.years || 4, ...units.map((u) => u.year), 1) }, (_, i) => i + 1)
  return (
    <section className="sl-card">
      <h2>Edit units in {programme.name}</h2>
      {units.length === 0 && <p className="sl-sub">No units yet. Add some above.</p>}
      {picked.length > 0 && (
        <div className="sl-row-actions">
          <strong>{picked.length} selected</strong>
          <label>Move to year<select value={mv.year} onChange={(e) => setMv({ ...mv, year: Number(e.target.value) })}>{years.map((y) => <option key={y} value={y}>{yearLabel(y)}</option>)}</select></label>
          <label>Semester<select value={mv.semester} onChange={(e) => setMv({ ...mv, semester: Number(e.target.value) })}>{[1, 2, 3].map((s) => <option key={s} value={s}>{semesterLabel(s)}</option>)}</select></label>
          <button className="sl-primary small" disabled={busy} onClick={() => void act(async () => {
            for (const id of picked) await labsApi.admin.updateUnit(id, { year: mv.year, semester: mv.semester })
            const n = picked.length; setPicked([]); return `Moved ${n} unit${n === 1 ? '' : 's'} to ${yearLabel(mv.year)}, ${semesterLabel(mv.semester)}.`
          })}>Move</button>
          <button className="sl-mini ghost" onClick={() => setPicked([])}>Clear</button>
        </div>
      )}
      {years.map((y) => [1, 2, 3].map((sem) => {
        const group = units.filter((u) => u.year === y && u.semester === sem)
        if (group.length === 0) return null
        return (
          <div key={`${y}-${sem}`}>
            <h3>{yearLabel(y)} · {semesterLabel(sem)} <small>({group.length})</small></h3>
            <div className="sl-unit-list">
              {group.map((u) => editId === u.id ? (
                <form key={u.id} className="sl-form inline" onSubmit={(e) => { e.preventDefault(); void act(async () => { await labsApi.admin.updateUnit(u.id, { code: draft.code.trim(), name: draft.name.trim(), year: draft.year, semester: draft.semester }); setEditId(''); return 'Unit saved.' }) }}>
                  <label>Code<input value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} /></label>
                  <label>Name<input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></label>
                  <label>Year<select value={draft.year} onChange={(e) => setDraft({ ...draft, year: Number(e.target.value) })}>{years.map((yy) => <option key={yy} value={yy}>{yearLabel(yy)}</option>)}</select></label>
                  <label>Semester<select value={draft.semester} onChange={(e) => setDraft({ ...draft, semester: Number(e.target.value) })}>{[1, 2, 3].map((s) => <option key={s} value={s}>{semesterLabel(s)}</option>)}</select></label>
                  <button className="sl-primary small" disabled={busy}>Save</button>
                  <button type="button" className="sl-mini ghost" onClick={() => setEditId('')}>Cancel</button>
                </form>
              ) : (
                <div key={u.id} className="sl-unit static">
                  <label className="sl-unit-name"><input type="checkbox" checked={picked.includes(u.id)} onChange={() => toggle(u.id)} />{' '}
                    <strong>{u.code}</strong> · {u.name}{u.status === 'hidden' ? <small> · hidden</small> : null}</label>
                  <span className="sl-foot-actions">
                    <button className="sl-mini" disabled={busy} onClick={() => startEdit(u)}>Edit</button>
                    <button className="sl-mini ghost" disabled={busy} onClick={() => void act(async () => { await labsApi.admin.updateUnit(u.id, { status: u.status === 'active' ? 'hidden' : 'active' }); return u.status === 'active' ? 'Unit hidden from students.' : 'Unit is live.' })}>{u.status === 'active' ? 'Hide' : 'Show'}</button>
                    <button className="sl-mini ghost" disabled={busy} onClick={() => { if (window.confirm(`Delete ${u.code}? This cannot be undone.`)) void act(async () => { await labsApi.admin.deleteUnit(u.id); return 'Unit deleted.' }) }}>Delete</button>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )
      }))}
    </section>
  )
}

function CatalogueTab({ setMsg, onChanged }: { setMsg: (n: Note) => void; onChanged: () => void }) {
  const [progs, setProgs] = useState<Programme[] | null>(null)
  const [sel, setSel] = useState('')
  const [busy, setBusy] = useState(false)
  const [np, setNp] = useState({ name: '', level: 'Undergraduate', department: '', years: 4 })
  const [uf, setUf] = useState({ year: 1, semester: 1, code: '', name: '' })
  const [bulk, setBulk] = useState('')
  const [tick, setTick] = useState(0)
  const load = useCallback(() => labsApi.admin.programmes().then(setProgs).catch((e) => { setMsg({ type: 'err', text: errMsg(e) }); setProgs([]) }), [setMsg])
  useEffect(() => { void load() }, [load])

  async function run(fn: () => Promise<string>) {
    setBusy(true); setMsg(null)
    try { setMsg({ type: 'ok', text: await fn() }); await load(); setTick((n) => n + 1); onChanged() } catch (e) { setMsg({ type: 'err', text: errMsg(e) }) } finally { setBusy(false) }
  }
  if (!progs) return <Loading />
  return (
    <>
      <section className="sl-card">
        <h2>Programmes</h2>
        <div className="sl-row-actions">
          <button className="sl-ghost" disabled={busy} onClick={() => run(async () => { const s = await labsApi.admin.importProgrammes(); return `Read ${s.pagesRead} pages. Added ${s.added}, already had ${s.alreadyHad}, skipped ${s.otherCampusSkipped} from other campuses.` })}>Import from Chuka website</button>
        </div>
        <div className="sl-unit-list">
          {progs.map((p) => (
            <div key={p.id} className={`sl-unit static${sel === p.id ? ' sel' : ''}`}>
              <span className="sl-unit-name"><strong>{p.name}</strong><small>{[p.level, p.department, `${p.years} yrs`].filter(Boolean).join(' · ')}</small></span>
              <span className="sl-foot-actions">
                <button className="sl-mini" onClick={() => setSel(sel === p.id ? '' : p.id)}>{sel === p.id ? 'Close' : 'Units'}</button>
                <button className={`sl-mini ${p.active ? '' : 'ghost'}`} disabled={busy} onClick={() => run(async () => { await labsApi.admin.updateProgramme(p.id, { active: !p.active }); return p.active ? 'Programme hidden.' : 'Programme is live.' })}>{p.active ? 'Hide' : 'Show'}</button>
              </span>
            </div>
          ))}
        </div>
        <form className="sl-form inline" onSubmit={(e) => { e.preventDefault(); if (!np.name.trim()) return setMsg({ type: 'err', text: 'Enter a programme name.' }); void run(async () => { await labsApi.admin.addProgramme({ ...np, name: np.name.trim() }); setNp({ ...np, name: '' }); return 'Programme added.' }) }}>
          <label>New programme<input value={np.name} onChange={(e) => setNp({ ...np, name: e.target.value })} placeholder="e.g. BSc Computer Science" /></label>
          <label>Level<input value={np.level} onChange={(e) => setNp({ ...np, level: e.target.value })} /></label>
          <label>Department<input value={np.department} onChange={(e) => setNp({ ...np, department: e.target.value })} /></label>
          <label>Years<input type="number" min={1} max={8} value={np.years} onChange={(e) => setNp({ ...np, years: Number(e.target.value) || 4 })} /></label>
          <button className="sl-primary small" disabled={busy}>Add</button>
        </form>
      </section>

      {sel && (
        <section className="sl-card">
          <h2>Add units to {progs.find((p) => p.id === sel)?.name}</h2>
          <form className="sl-form inline" onSubmit={(e) => { e.preventDefault(); if (!uf.code.trim() || !uf.name.trim()) return setMsg({ type: 'err', text: 'Enter the unit code and name.' }); void run(async () => { const r = await labsApi.admin.addUnit({ programmeId: sel, ...uf, code: uf.code.trim(), name: uf.name.trim() }); setUf({ ...uf, code: '', name: '' }); return r.created ? 'Unit added.' : 'That unit already exists.' }) }}>
            <label>Year<input type="number" min={1} max={8} value={uf.year} onChange={(e) => setUf({ ...uf, year: Number(e.target.value) || 1 })} /></label>
            <label>Semester<input type="number" min={1} max={3} value={uf.semester} onChange={(e) => setUf({ ...uf, semester: Number(e.target.value) || 1 })} /></label>
            <label>Code<input value={uf.code} onChange={(e) => setUf({ ...uf, code: e.target.value })} /></label>
            <label>Name<input value={uf.name} onChange={(e) => setUf({ ...uf, name: e.target.value })} /></label>
            <button className="sl-primary small" disabled={busy}>Add unit</button>
          </form>
          <div className="sl-form">
            <label>Bulk add: one unit per line as “year, semester, code, name”
              <textarea rows={6} value={bulk} onChange={(e) => setBulk(e.target.value)} placeholder={'1, 1, COSC 101, Introduction to Computer Science\n1, 2, MATH 102, Calculus I'} />
            </label>
            <button className="sl-primary small" disabled={busy || !bulk.trim()} onClick={() => run(async () => { const r = await labsApi.admin.bulkUnits(sel, bulk); setBulk(r.errors.length ? r.errors.join('\n') : ''); return `Added ${r.added}, skipped ${r.skipped}.${r.errors.length ? ' Lines with problems were left in the box.' : ''}` })}>Add all</button>
          </div>
        </section>
      )}
      {sel && progs.find((p) => p.id === sel) && <UnitManager programme={progs.find((p) => p.id === sel) as Programme} refreshToken={tick} setMsg={setMsg} onChanged={onChanged} />}
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Shell                                                               */
/* ------------------------------------------------------------------ */
export default function StudyLabs({ user, onSignIn, onBack }: Props) {
  const [view, setView] = useState<View>({ name: 'home' })
  const [config, setConfig] = useState<LabsConfig | null>(null)
  const [programmes, setProgrammes] = useState<Programme[]>([])
  const [loading, setLoading] = useState(labsReady)
  const [fatal, setFatal] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [reporting, setReporting] = useState<Resource | null>(null)
  const [suggesting, setSuggesting] = useState<Programme | null>(null)
  const [toast, setToast] = useState<Note>(null)
  const [access, setAccess] = useState<AccessInfo | null>(null)
  const [scanning, setScanning] = useState(false)
  const [paywall, setPaywall] = useState<{ payment: PaymentInfo | null } | null>(null)

  useEffect(() => {
    const on = (e: Event) => setPaywall({ payment: (e as CustomEvent<PaymentInfo | null>).detail ?? null })
    window.addEventListener(PAYWALL_EVENT, on)
    return () => window.removeEventListener(PAYWALL_EVENT, on)
  }, [])
  useEffect(() => {
    setAccess(null)
    if (!labsReady || !user) return
    labsApi.access().then(setAccess).catch(() => {})
  }, [user])

  const loadProgrammes = useCallback(() => labsApi.programmes().then(setProgrammes), [])
  const refreshProgrammes = useCallback(() => { loadProgrammes().catch(() => {}) }, [loadProgrammes])
  useEffect(() => {
    if (!labsReady) return
    Promise.all([labsApi.config().then(setConfig), loadProgrammes()])
      .catch((e) => setFatal(errMsg(e))).finally(() => setLoading(false))
  }, [loadProgrammes])

  useEffect(() => {
    setIsAdmin(false)
    if (!labsReady || !user) return
    labsApi.adminCheck().then((r) => setIsAdmin(r.isAdmin)).catch(() => {})
  }, [user])

  useEffect(() => { window.scrollTo(0, 0) }, [view])

  // Share links: #/labs/r/<id> opens that item directly (also when the hash changes while the page is open).
  useEffect(() => {
    const open = () => { const id = resourceIdFromHash(window.location.hash); if (id) setView({ name: 'resource', id }) }
    open()
    window.addEventListener('hashchange', open)
    return () => window.removeEventListener('hashchange', open)
  }, [])
  // Leaving a shared item puts the address back to plain #/labs so a refresh does not reopen it.
  const prevView = useRef<View['name']>('home')
  useEffect(() => {
    if (prevView.current === 'resource' && view.name !== 'resource' && resourceIdFromHash(window.location.hash)) window.history.replaceState(null, '', '#/labs')
    prevView.current = view.name
  }, [view])

  const back = () => {
    if (view.name === 'unit') setView(view.programme ? { name: 'programme', programme: view.programme } : { name: 'home' })
    else if (view.name === 'programme' || view.name === 'mine' || view.name === 'admin' || view.name === 'resource') setView({ name: 'home' })
    else onBack()
  }
  const openUnit = (unit: Unit, programme?: Programme) => setView({ name: 'unit', unit, programme: programme ?? programmes.find((p) => p.id === unit.programmeId) })
  const gated = (v: View) => (user ? setView(v) : onSignIn())

  return (
    <div className="sl-shell">
      <div className="sl-topbar">
        <button className="sl-back" onClick={back}><ArrowLeft size={18} /> {view.name === 'home' ? 'Back to services' : 'Back'}</button>
        <div className="sl-brand"><span className="has-logo"><img src={`${import.meta.env.BASE_URL}study-labs-logo.svg`} alt="Study Labs logo" /></span><div><strong>Study Labs</strong><small>Chuka Comrades</small></div></div>
        <nav className="sl-nav">
          <button className={view.name === 'home' ? 'on' : ''} onClick={() => setView({ name: 'home' })}>Browse</button>
          <button className={view.name === 'mine' ? 'on' : ''} onClick={() => gated({ name: 'mine' })}>My uploads</button>
          {isAdmin && <button className={view.name === 'admin' ? 'on' : ''} onClick={() => setView({ name: 'admin' })}><ShieldCheck size={14} /> Admin</button>}
        </nav>
      </div>

      {!labsReady && <Msg msg={{ type: 'err', text: 'Study Labs server not connected yet. Add VITE_LABS_API_URL to .env and restart npm run dev.' }} />}
      {fatal && <Msg msg={{ type: 'err', text: fatal }} />}
      <Msg msg={toast} />
      <TrialBanner access={access} onPay={() => setPaywall({ payment: access?.payment ?? null })} />

      {view.name === 'home' && (
        <Home programmes={programmes} loading={loading} user={user} isAdmin={isAdmin} onScan={() => (user ? setScanning(true) : onSignIn())} onProgramme={(p) => setView({ name: 'programme', programme: p })}
          onUnit={(u) => openUnit(u)} onReport={setReporting} onResourceError={(m) => setToast({ type: 'err', text: m })} />
      )}
      {view.name === 'programme' && <ProgrammePage programme={view.programme} user={user} onSignIn={onSignIn} onUnit={(u) => openUnit(u, view.programme)} onSuggest={() => setSuggesting(view.programme)} />}
      {view.name === 'unit' && <UnitPage unit={view.unit} user={user} config={config} isAdmin={isAdmin} onSignIn={onSignIn} onReport={setReporting} />}
      {view.name === 'resource' && <ResourcePage id={view.id} user={user} isAdmin={isAdmin} onSignIn={onSignIn} onReport={setReporting} onOpenUnit={(u) => openUnit(u)} />}
      {view.name === 'mine' && user && <MinePage />}
      {view.name === 'admin' && isAdmin && <AdminPage onCatalogueChanged={refreshProgrammes} />}

      {scanning && <Modal title="Scan a CAT or paper" onClose={() => setScanning(false)}><ScanBody onClose={() => setScanning(false)} onDone={() => {}} /></Modal>}
      {paywall && <PaywallModal payment={paywall.payment} email={user?.email} onClose={() => setPaywall(null)} />}
      {reporting && <ReportModal resource={reporting} onClose={() => setReporting(null)} />}
      {suggesting && <SuggestModal programme={suggesting} onClose={() => setSuggesting(null)} />}
    </div>
  )
}

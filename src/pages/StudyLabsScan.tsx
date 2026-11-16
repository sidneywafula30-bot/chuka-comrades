import { useState } from 'react'
import { Camera, CheckCircle2, LoaderCircle, X } from 'lucide-react'
import {
  labsApi, TYPE_LABELS, EXAM_TYPES, STUDY_IMAGE_MAX_PX, STUDY_IMAGE_QUALITY, yearLabel, semesterLabel, currentAcademicYear,
  type ScanResult, type ResourceType,
} from '../lib/labs'
import { shrinkImage } from '../lib/files'

const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong. Please try again.')
const MAX_PAGES = 6

/** Body of the "Scan a CAT or paper" modal. The parent page wraps it in its Modal. */
export default function ScanBody({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [files, setFiles] = useState<File[]>([])
  const [phase, setPhase] = useState<'pick' | 'scanning' | 'confirm' | 'sending' | 'done'>('pick')
  const [res, setRes] = useState<ScanResult | null>(null)
  const [unitId, setUnitId] = useState('')
  const [type, setType] = useState<ResourceType>('cat')
  const [examType, setExamType] = useState('CAT')
  const [ay, setAy] = useState(currentAcademicYear())
  const [title, setTitle] = useState('')
  const [err, setErr] = useState('')

  function pick(list: FileList | null) {
    if (!list) return
    const imgs = Array.from(list).filter((f) => f.type.startsWith('image/'))
    if (imgs.length < list.length) setErr('Only photos can be scanned. Use the unit page to upload other file types.')
    else setErr('')
    setFiles((cur) => [...cur, ...imgs].slice(0, MAX_PAGES))
  }

  async function scan() {
    if (!files.length) return setErr('Take or choose a photo first.')
    setPhase('scanning'); setErr('')
    try {
      // Only the first page is read; a smaller copy is enough for the AI and is quicker to send.
      const small = await shrinkImage(files[0], 1024, 0.65)
      const r = await labsApi.scanPaper(small.split(',')[1] ?? '')
      setRes(r)
      const first = r.candidates[0]
      setUnitId(first ? first.unitId : '')
      const et = r.examType || 'CAT'
      setExamType(et)
      setType(!r.isExamPaper ? 'note' : et === 'CAT' ? 'cat' : 'paper')
      if (r.academicYear) setAy(r.academicYear)
      setTitle(`${first?.code || r.unitCode || ''} ${r.isExamPaper ? et : 'Notes'}${r.academicYear ? ' ' + r.academicYear : ''}`.trim())
      setPhase('confirm')
    } catch (e) { setErr(errMsg(e)); setPhase('pick') }
  }

  async function send() {
    if (!unitId) return setErr('Choose the unit this belongs to.')
    if (title.trim().length < 3) return setErr('Give it a clear title.')
    setPhase('sending'); setErr('')
    try {
      const out: { name: string; data: string }[] = []
      for (const f of files) {
        const url = await shrinkImage(f, STUDY_IMAGE_MAX_PX, STUDY_IMAGE_QUALITY)
        out.push({ name: f.name.replace(/\.[^.]+$/, '') + '.jpg', data: url.split(',')[1] ?? '' })
      }
      const exam = type === 'cat' || type === 'paper'
      await labsApi.submit({
        unitId, type, title: title.trim(), description: 'Scanned and read with AI. The reviewer will check the details.', link: '',
        ...(exam ? { examType: examType as (typeof EXAM_TYPES)[number], academicYear: ay.trim() } : {}), files: out,
      })
      setPhase('done'); onDone()
    } catch (e) { setErr(errMsg(e)); setPhase('confirm') }
  }

  if (phase === 'done') {
    return (
      <div className="sl-done"><CheckCircle2 size={34} /><p>Sent for review. It will show under the right unit once an admin approves it. Track it under <strong>My uploads</strong>.</p><button className="sl-primary" onClick={onClose}>Done</button></div>
    )
  }

  if (phase === 'scanning') {
    return <div className="sl-empty"><LoaderCircle className="sl-spin" size={24} /><span>Reading your paper… this can take up to 20 seconds.</span></div>
  }

  if (phase === 'confirm' && res) {
    const exam = type === 'cat' || type === 'paper'
    return (
      <div className="sl-form">
        <p className="sl-sub">Check what we found, fix anything that is wrong, then send it.</p>
        {res.candidates.length === 0 ? (
          <p className="sl-alert err">We could not match a unit{res.unitCode || res.unitName ? ` for “${[res.unitCode, res.unitName].filter(Boolean).join(' ')}”` : ''}. Open the unit from the home page and use Upload, or try a clearer photo.</p>
        ) : (
          <label>Unit
            <select value={unitId} onChange={(e) => setUnitId(e.target.value)}>
              {res.candidates.map((c) => <option key={c.unitId} value={c.unitId}>{c.code} · {c.name} — {c.programmeName}, {yearLabel(c.year)} {semesterLabel(c.semester)}</option>)}
            </select>
          </label>
        )}
        <label>What is it?
          <select value={type} onChange={(e) => setType(e.target.value as ResourceType)}>{(['cat', 'paper', 'note'] as const).map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}</select>
        </label>
        {exam && (
          <div className="sl-two">
            <label>Exam type<select value={examType} onChange={(e) => setExamType(e.target.value)}>{EXAM_TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
            <label>Academic year<input value={ay} onChange={(e) => setAy(e.target.value)} placeholder="2025/2026" /></label>
          </div>
        )}
        <label>Title<input value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} /></label>
        <p className="sl-sub">{files.length} photo{files.length === 1 ? '' : 's'} will be uploaded.</p>
        {err && <p className="sl-alert err">{err}</p>}
        <button className="sl-primary" disabled={!res.candidates.length} onClick={() => void send()}>Submit for review</button>
        <button type="button" className="sl-ghost" onClick={() => { setPhase('pick'); setRes(null) }}>Scan again</button>
      </div>
    )
  }

  return (
    <div className="sl-form">
      <p className="sl-sub">Take a clear photo of the paper (or choose it from your gallery). If it has several pages, add them all: the first page is read to find the unit.</p>
      <label className="sl-drop"><Camera size={18} /> Take or choose photos
        <input type="file" accept="image/*" multiple onChange={(e) => { pick(e.target.files); e.target.value = '' }} />
        <small>Up to {MAX_PAGES} pages. Good light, whole page in the picture, unit code and title visible.</small>
      </label>
      {files.length > 0 && (
        <ul className="sl-picked">{files.map((f, i) => (
          <li key={`${f.name}${i}`}><Camera size={14} /><span>{i === 0 ? 'Page 1 (read by AI): ' : `Page ${i + 1}: `}{f.name}</span>
            <button type="button" className="sl-icon-btn" onClick={() => setFiles(files.filter((_, j) => j !== i))} aria-label="Remove"><X size={14} /></button></li>
        ))}</ul>
      )}
      {err && <p className="sl-alert err">{err}</p>}
      <button className="sl-primary" disabled={!files.length || phase === 'sending'} onClick={() => void scan()}>Scan and fill details</button>
    </div>
  )
}

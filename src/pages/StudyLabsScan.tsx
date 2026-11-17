import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, CheckCircle2, FileText, ImagePlus, LoaderCircle, Sparkles, X } from 'lucide-react'
import {
  labsApi, EXAM_TYPES, yearLabel, semesterLabel, currentAcademicYear,
  type Programme, type QaQuestion, type ScanCandidate, type Unit,
} from '../lib/labs'
import { shrinkImage } from '../lib/files'
import { scanJob, type ScanJob } from '../lib/scanJob'
import LiveCamera from './StudyLabsCamera'
import { QaList, type AnswerState } from './StudyLabsQa'

const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong. Please try again.')
const MAX_PAGES = 8
const BATCH = 4

type Phase = 'capture' | 'camera' | 'working' | 'jobfail' | 'review' | 'saving' | 'done'
type Meta = { isExamPaper: boolean; unitCode: string; unitName: string; duration: string; totalMarks: string; instructions: string; duplicate: boolean }

/**
 * "Scan a CAT or paper" window.
 * 1) take pages with the live camera (or pick photos)  2) AI types the paper out page by page
 * 3) AI writes an answer for every question  4) a clean PDF is saved, not the photos.
 * Steps 2-4 run as a background job (see lib/scanJob.ts): they carry on after this window or the browser is closed.
 */
export default function ScanBody({ uid, onClose, onDone }: { uid: string; onClose: () => void; onDone: () => void }) {
  const [phase, setPhase] = useState<Phase>('capture')
  const [files, setFiles] = useState<File[]>([])
  const [thumbs, setThumbs] = useState<string[]>([])
  const [err, setErr] = useState('')
  const [jobId, setJobId] = useState('')
  const [job, setJob] = useState<ScanJob | null>(null)
  const [pageCount, setPageCount] = useState(0)

  const [meta, setMeta] = useState<Meta | null>(null)
  const [cands, setCands] = useState<ScanCandidate[]>([])
  const [unitId, setUnitId] = useState('')
  const [examType, setExamType] = useState('CAT')
  const [ay, setAy] = useState(currentAcademicYear())
  const [title, setTitle] = useState('')
  const [includeAnswers, setIncludeAnswers] = useState(true)
  const [questions, setQuestionsState] = useState<QaQuestion[]>([])
  const [state, setState] = useState<Record<string, AnswerState>>({})
  const [answerErr, setAnswerErr] = useState('')

  const [manual, setManual] = useState(false)
  const [progs, setProgs] = useState<Programme[] | null>(null)
  const [progId, setProgId] = useState('')
  const [pUnits, setPUnits] = useState<Unit[] | null>(null)

  // Refs hold the latest values for the async loops (reading pages, writing answers).
  const qRef = useRef<QaQuestion[]>([])
  const metaRef = useRef<Meta | null>(null)
  const idSeq = useRef(0)
  const run = useRef(0)

  useEffect(() => () => { run.current += 1 }, []) // closing the window stops any answers still being written

  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f))
    setThumbs(urls)
    return () => urls.forEach((u) => URL.revokeObjectURL(u))
  }, [files])

  const setQs = useCallback((next: QaQuestion[]) => { qRef.current = next; setQuestionsState(next) }, [])
  const patchQ = useCallback((id: string, patch: Partial<QaQuestion>) => setQs(qRef.current.map((q) => (q.id === id ? { ...q, ...patch } : q))), [setQs])
  const setSt = useCallback((ids: string[], v: AnswerState) => setState((s) => { const n = { ...s }; ids.forEach((id) => { n[id] = v }); return n }), [])

  /* ---------- 1. capture ---------- */

  function pick(list: FileList | null) {
    if (!list) return
    const imgs = Array.from(list).filter((f) => f.type.startsWith('image/'))
    setErr(imgs.length < list.length ? 'Only photos can be scanned. Use the unit page to upload other file types.' : '')
    setFiles((cur) => [...cur, ...imgs].slice(0, MAX_PAGES))
  }

  /* ---------- 2. hand the pages to the background job ---------- */

  async function startScan() {
    setErr('')
    try { if ('Notification' in window && Notification.permission === 'default') void Notification.requestPermission() } catch { /* ignore */ }
    setPhase('working'); setJob(null)
    try {
      const images: string[] = []
      for (const f of files) images.push((await shrinkImage(f, 1600, 0.72)).split(',')[1] ?? '')
      const j = await scanJob.create(images)
      setJobId(j.id); setJob(j)
      void scanJob.start(j.id)
    } catch (e) {
      setErr(e instanceof Error && e.message === 'bad image' ? 'That photo format is not supported. Use the live camera, or a JPG or PNG photo.' : errMsg(e))
      setPhase('capture')
    }
  }

  /** Shows what the background job produced: done, needs a quick look, or failed. */
  function showFinal(j: ScanJob) {
    setJobId(j.id); setJob(j)
    if (j.status === 'done') { setPhase('done'); onDone(); void scanJob.ack(j.id); return }
    if (j.status === 'failed') { setErr(j.error || 'The paper could not be read.'); setPhase('jobfail'); return }
    loadReview(j)
  }

  /** The job finished reading and answering but needs a person to confirm something (unit, missing answers). */
  function loadReview(j: ScanJob) {
    run.current += 1
    const qs = j.questions
    idSeq.current = qs.length + 100
    metaRef.current = j.meta; setMeta(j.meta)
    setCands(j.cands); setUnitId(j.cands[0]?.unitId ?? ''); setManual(j.cands.length === 0)
    setExamType(j.examType); setAy(j.ay); setTitle(j.title); setPageCount(j.pagesRead)
    setQs(qs); setState(Object.fromEntries(qs.map((q) => [q.id, (q.answer ? 'done' : 'wait') as AnswerState])))
    setAnswerErr(''); setErr(j.reason ?? ''); setPhase('review')
    const missing = qs.filter((q) => !q.answer).map((q) => q.id)
    if (missing.length) void answerIds(missing, run.current)
  }

  // Coming back (window reopened, browser reopened, notification tapped): pick the job up where it is.
  useEffect(() => {
    if (!uid) return
    let live = true
    void scanJob.pending(uid).then((j) => {
      if (!live || !j) return
      if (j.status === 'done' || j.status === 'failed' || j.status === 'needs_review') { showFinal(j); return }
      setJobId(j.id); setJob(j); setPhase('working'); void scanJob.resume(j.id)
    }).catch(() => {})
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid])

  // While the job runs, show its progress.
  useEffect(() => {
    if (phase !== 'working' || !jobId) return
    const t = setInterval(() => {
      void scanJob.get(jobId).then((j) => {
        if (!j) return
        if (j.status === 'done' || j.status === 'failed' || j.status === 'needs_review') showFinal(j)
        else setJob(j)
      }).catch(() => {})
    }, 1500)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, jobId])

  /* ---------- 3. AI answers (a few questions per request, one request at a time) ---------- */

  async function answerIds(ids: string[], token: number) {
    const m = metaRef.current
    const ctx = { unitCode: m?.unitCode ?? '', unitName: m?.unitName ?? '' }
    for (let k = 0; k < ids.length; k += BATCH) {
      if (token !== run.current) return
      const batch = ids.slice(k, k + BATCH)
      const items = qRef.current.filter((q) => batch.includes(q.id)).map((q) => ({ id: q.id, number: q.number, text: q.text, marks: q.marks }))
      if (!items.length) continue
      setSt(batch, 'busy')
      try {
        const r = await labsApi.scanAnswer(ctx, items)
        if (token !== run.current) return
        const got = new Set<string>()
        for (const a of r.answers) { patchQ(a.id, { answer: a.answer }); got.add(a.id) }
        setSt(batch.filter((id) => got.has(id)), 'done'); setSt(batch.filter((id) => !got.has(id)), 'fail')
      } catch (e) {
        if (token !== run.current) return
        // Stop here so one problem (quota, no internet) is not repeated for every batch.
        setAnswerErr(errMsg(e))
        setSt(ids.slice(k), 'fail')
        return
      }
    }
  }

  const pendingIds = questions.filter((q) => !q.answer).map((q) => q.id)
  const answering = Object.values(state).some((v) => v === 'wait' || v === 'busy')
  const answered = questions.filter((q) => q.answer).length

  function regenerate(id: string) { setAnswerErr(''); void answerIds([id], run.current) }
  function retryMissing() { setAnswerErr(''); void answerIds(pendingIds, run.current) }
  function removeQ(id: string) { setQs(qRef.current.filter((q) => q.id !== id)); setState((s) => { const n = { ...s }; delete n[id]; return n }) }

  /* ---------- unit choice (the AI's matches, or pick it yourself) ---------- */

  useEffect(() => {
    if (!manual || progs) return
    labsApi.programmes().then((p) => setProgs(p.filter((x) => x.active))).catch((e) => setErr(errMsg(e)))
  }, [manual, progs])

  useEffect(() => {
    if (!progId) { setPUnits(null); return }
    let live = true
    setPUnits(null)
    labsApi.units(progId).then((u) => { if (live) setPUnits(u) }).catch((e) => { if (live) { setErr(errMsg(e)); setPUnits([]) } })
    return () => { live = false }
  }, [progId])

  function chooseUnit(u: Unit) {
    const c: ScanCandidate = { unitId: u.id, code: u.code, name: u.name, programmeName: progs?.find((p) => p.id === progId)?.name ?? '', year: u.year, semester: u.semester }
    setCands((cur) => [c, ...cur.filter((x) => x.unitId !== c.unitId)])
    setUnitId(u.id); setManual(false)
    setTitle((t) => (t.trim() ? t : `${u.code} ${examType} ${ay}`.trim()))
  }

  /* ---------- 4. save ---------- */

  async function save() {
    if (!unitId) return setErr('Choose the unit this belongs to.')
    if (title.trim().length < 3) return setErr('Give it a clear title.')
    if (!questions.length) return setErr('There are no questions left to save.')
    setPhase('saving'); setErr('')
    try {
      await labsApi.scanSave({
        unitId, type: examType === 'CAT' ? 'cat' : 'paper', title: title.trim(), examType, academicYear: ay.trim(), includeAnswers,
        duration: meta?.duration, totalMarks: meta?.totalMarks, instructions: meta?.instructions,
        questions: questions.map((q) => ({ number: q.number, text: q.text, marks: q.marks, answer: q.answer })),
      })
      if (jobId) void scanJob.ack(jobId)
      setPhase('done'); onDone()
    } catch (e) { setErr(errMsg(e)); setPhase('review') }
  }

  function startOver() {
    run.current += 1
    if (jobId) void scanJob.discard(jobId)
    setJobId(''); setJob(null); setPageCount(0)
    qRef.current = []; metaRef.current = null
    setMeta(null); setQuestionsState([]); setState({}); setCands([]); setUnitId(''); setErr(''); setAnswerErr(''); setFiles([]); setPhase('capture')
  }

  /* ---------- screens ---------- */

  if (phase === 'done') {
    return (
      <div className="sl-done"><CheckCircle2 size={34} />
        <p>Your typed paper{includeAnswers ? ' with AI answers' : ''} was sent for review. Once an admin approves it, everyone can open it and tap each question. Track it under <strong>My uploads</strong>.</p>
        <button className="sl-primary" onClick={onClose}>Done</button>
      </div>
    )
  }

  if (phase === 'camera') {
    return <LiveCamera count={files.length} max={MAX_PAGES} onCapture={(f) => setFiles((cur) => [...cur, f].slice(0, MAX_PAGES))} onClose={() => setPhase('capture')} />
  }

  if (phase === 'working') {
    const paused = job?.status === 'paused'
    return (
      <div className="sl-empty">
        {!paused && <LoaderCircle className="sl-spin" size={26} />}
        <h3>{job?.message || 'Preparing your pages…'}</h3>
        <p>You can close this window or leave the app. The paper keeps being read, answered and sent for review in the background where your browser allows it, and carries on from the same spot next time you open the app.</p>
        {paused && <button className="sl-primary" onClick={() => jobId && void scanJob.resume(jobId, true)}>Continue now</button>}
        <button className="sl-ghost" onClick={startOver}>Cancel this scan</button>
      </div>
    )
  }

  if (phase === 'jobfail') {
    return (
      <div className="sl-form">
        <p className="sl-alert err">{err}</p>
        <button className="sl-primary" onClick={startOver}>Scan again</button>
      </div>
    )
  }

  if ((phase === 'review' || phase === 'saving') && meta) {
    const saving = phase === 'saving'
    return (
      <div className="sl-form">
        <p className="sl-alert ok"><CheckCircle2 size={16} /> Found {questions.length} question{questions.length === 1 ? '' : 's'} on {pageCount} page{pageCount === 1 ? '' : 's'}.</p>
        {!meta.isExamPaper && <p className="sl-alert err">This does not look like an exam paper. Check the questions before you send it.</p>}
        {meta.duplicate && <p className="sl-alert err">The library may already have this paper for that unit and year. You can still send it; the reviewer will check.</p>}

        {cands.length > 0 && !manual && (
          <label>Unit
            <select value={unitId} onChange={(e) => setUnitId(e.target.value)}>
              {cands.map((c) => <option key={c.unitId} value={c.unitId}>{c.code} · {c.name} — {c.programmeName}, {yearLabel(c.year)} {semesterLabel(c.semester)}</option>)}
            </select>
          </label>
        )}
        {manual ? (
          <div className="sl-form">
            <p className="sl-sub">{cands.length === 0 ? `We could not match a unit${meta.unitCode || meta.unitName ? ` for “${[meta.unitCode, meta.unitName].filter(Boolean).join(' ')}”` : ''}. Choose it here.` : 'Choose the unit yourself.'}</p>
            <label>Programme
              <select value={progId} onChange={(e) => setProgId(e.target.value)}>
                <option value="">{progs ? 'Select a programme…' : 'Loading…'}</option>
                {(progs ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            {progId && (
              <label>Unit
                <select value="" disabled={!pUnits} onChange={(e) => { const u = pUnits?.find((x) => x.id === e.target.value); if (u) chooseUnit(u) }}>
                  <option value="">{pUnits ? 'Select the unit…' : 'Loading…'}</option>
                  {[...(pUnits ?? [])].sort((a, b) => a.year - b.year || a.semester - b.semester || a.code.localeCompare(b.code)).map((u) => <option key={u.id} value={u.id}>{yearLabel(u.year)} · {u.code} · {u.name}</option>)}
                </select>
              </label>
            )}
            {cands.length > 0 && <button type="button" className="sl-mini ghost" onClick={() => setManual(false)}>Use the suggested units</button>}
          </div>
        ) : (
          <button type="button" className="sl-mini ghost" onClick={() => setManual(true)}>Not the right unit? Choose it yourself</button>
        )}

        <div className="sl-two">
          <label>Exam type<select value={examType} onChange={(e) => setExamType(e.target.value)}>{EXAM_TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
          <label>Academic year<input value={ay} onChange={(e) => setAy(e.target.value)} placeholder="2025/2026" /></label>
        </div>
        <label>Title<input value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} /></label>

        <div className="sl-qa-section">
          <div className="sl-qa-progress">
            {answering
              ? <><LoaderCircle className="sl-spin" size={14} /> Writing answers… {answered} of {questions.length} ready. You can read and fix questions meanwhile.</>
              : <><Sparkles size={14} /> {answered} of {questions.length} answers ready.</>}
          </div>
          {answerErr && <p className="sl-alert err">{answerErr}</p>}
          {!answering && pendingIds.length > 0 && <button type="button" className="sl-mini" onClick={retryMissing}>Write the {pendingIds.length} missing answer{pendingIds.length === 1 ? '' : 's'}</button>}
          <QaList questions={questions} editable state={state} onEdit={(id, text) => patchQ(id, { text })} onRegenerate={regenerate} onRemove={removeQ} />
        </div>

        <label className="sl-check"><input type="checkbox" checked={includeAnswers} onChange={(e) => setIncludeAnswers(e.target.checked)} /> Include the AI answers in the saved document</label>
        <p className="sl-sub"><FileText size={13} /> A clean PDF is made from the typed questions. Your photos are not saved.</p>
        {err && <p className="sl-alert err">{err}</p>}
        <button className="sl-primary" disabled={saving || answering || !unitId} onClick={() => void save()}>{saving ? 'Creating the document…' : answering ? 'Waiting for the answers…' : 'Save as document and submit for review'}</button>
        <button type="button" className="sl-ghost" disabled={saving} onClick={startOver}>Scan again</button>
      </div>
    )
  }

  // capture
  return (
    <div className="sl-form">
      <p className="sl-sub">Scan every page of the paper in order. The AI types it out, writes an answer for each question, and saves a proper document. Your photos are only used to read it and are not kept.</p>
      <button className="sl-primary" onClick={() => { setErr(''); setPhase('camera') }}><Camera size={16} style={{ verticalAlign: '-3px' }} /> Open live camera</button>
      <label className="sl-drop"><ImagePlus size={18} /> Or choose photos from your gallery
        <input type="file" accept="image/*" multiple onChange={(e) => { pick(e.target.files); e.target.value = '' }} />
        <small>Up to {MAX_PAGES} pages. Good light, whole page in the picture, text sharp.</small>
      </label>
      {files.length > 0 && (
        <div className="sl-thumbs">
          {files.map((f, i) => (
            <div key={`${f.name}${i}`} className="sl-thumb">
              {thumbs[i] && <img src={thumbs[i]} alt={`Page ${i + 1}`} />}
              <span>Page {i + 1}</span>
              <button type="button" className="sl-icon-btn" onClick={() => setFiles(files.filter((_, j) => j !== i))} aria-label={`Remove page ${i + 1}`}><X size={14} /></button>
            </div>
          ))}
        </div>
      )}
      {err && <p className="sl-alert err">{err}</p>}
      <button className="sl-primary" disabled={!files.length} onClick={() => void startScan()}>Read the paper and write answers</button>
    </div>
  )
}

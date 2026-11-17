import { Fragment, useEffect, useState, type ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, ChevronDown, LoaderCircle, RefreshCw, Sparkles, Trash2 } from 'lucide-react'
import { labsApi, type QaQuestion } from '../lib/labs'

const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong. Please try again.')

export type AnswerState = 'wait' | 'busy' | 'done' | 'fail'

/** Plain text with **bold** and line breaks kept. Never injects HTML. */
function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split('\n').map((line, i) => (
        <Fragment key={i}>
          {i > 0 && <br />}
          {line.split('**').map((part, j) => (j % 2 ? <strong key={j}>{part}</strong> : <Fragment key={j}>{part}</Fragment>))}
        </Fragment>
      ))}
    </>
  )
}

function label(q: QaQuestion, i: number) {
  if (!q.number) return `Q${i + 1}`
  return /^q/i.test(q.number) ? q.number : `Q${q.number}`
}

type ListProps = {
  questions: QaQuestion[]
  /** Review mode: question text can be edited, answers regenerated, questions removed. */
  editable?: boolean
  state?: Record<string, AnswerState>
  onEdit?: (id: string, text: string) => void
  onRegenerate?: (id: string) => void
  onRemove?: (id: string) => void
}

/** Every question is one row. Tap a row to see the question in full and its AI answer. */
export function QaList({ questions, editable, state = {}, onEdit, onRegenerate, onRemove }: ListProps) {
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const allOpen = questions.length > 0 && questions.every((q) => open[q.id])
  const toggle = (id: string) => setOpen((o) => ({ ...o, [id]: !o[id] }))

  return (
    <div className="sl-qa">
      <div className="sl-qa-top">
        <small>{questions.length} question{questions.length === 1 ? '' : 's'}. Tap one to see its answer.</small>
        <button type="button" className="sl-mini ghost" onClick={() => setOpen(allOpen ? {} : Object.fromEntries(questions.map((q) => [q.id, true])))}>{allOpen ? 'Close all' : 'Open all'}</button>
      </div>
      {questions.map((q, i) => {
        const st = state[q.id] ?? (q.answer ? 'done' : 'wait')
        const isOpen = Boolean(open[q.id])
        return (
          <div key={q.id} className={`sl-qa-item${isOpen ? ' open' : ''}`}>
            <button type="button" className="sl-qa-head" aria-expanded={isOpen} onClick={() => toggle(q.id)}>
              <span className="sl-qa-num">{label(q, i)}</span>
              <span className="sl-qa-preview">{q.text}</span>
              {q.marks && <span className="sl-qa-marks">{q.marks} {/mark/i.test(q.marks) ? '' : 'mks'}</span>}
              <span className={`sl-qa-state s-${st}`} title={st === 'done' ? 'Answer ready' : st === 'busy' ? 'Writing answer…' : st === 'fail' ? 'No answer yet' : 'Waiting'}>
                {st === 'busy' || st === 'wait' ? (editable ? <LoaderCircle className="sl-spin" size={14} /> : null) : st === 'fail' ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}
              </span>
              <ChevronDown size={16} className="sl-qa-chev" />
            </button>
            {isOpen && (
              <div className="sl-qa-body">
                {editable ? (
                  <label className="sl-qa-edit">Question (fix any typing mistakes)
                    <textarea rows={Math.min(8, Math.max(3, q.text.split('\n').length + 1))} value={q.text} onChange={(e) => onEdit?.(q.id, e.target.value)} />
                  </label>
                ) : (
                  <div className="sl-qa-q"><Rich text={q.text} /></div>
                )}
                <div className="sl-qa-ans">
                  <div className="sl-qa-ans-head"><Sparkles size={13} /> Answer written by AI</div>
                  {q.answer ? <div className="sl-qa-ans-text"><Rich text={q.answer} /></div>
                    : st === 'busy' || st === 'wait' ? <p className="sl-sub">{editable ? 'Writing the answer…' : 'No answer was saved for this question.'}</p>
                      : <p className="sl-sub">{editable ? 'The answer could not be written. Try again.' : 'No answer was saved for this question.'}</p>}
                  {q.answer && <small className="sl-qa-warn">AI can make mistakes. Check it against your notes or ask your lecturer.</small>}
                </div>
                {editable && (
                  <div className="sl-foot-actions">
                    <button type="button" className="sl-mini" disabled={st === 'busy'} onClick={() => onRegenerate?.(q.id)}><RefreshCw size={12} /> {q.answer ? 'Write answer again' : 'Write answer'}</button>
                    <button type="button" className="sl-mini danger" onClick={() => onRemove?.(q.id)}><Trash2 size={12} /> Remove question</button>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/** Body of the "Questions & answers" window opened from an upload. Loads the questions when it opens. */
export function QaViewer({ resourceId, header }: { resourceId: string; header?: ReactNode }) {
  const [list, setList] = useState<QaQuestion[] | null>(null)
  const [err, setErr] = useState('')
  useEffect(() => {
    let live = true
    setList(null); setErr('')
    labsApi.resourceQuestions(resourceId)
      .then((r) => { if (live) setList(r.questions) })
      .catch((e) => { if (live) { setErr(errMsg(e)); setList([]) } })
    return () => { live = false }
  }, [resourceId])
  return (
    <div>
      {header}
      {err && <p className="sl-alert err">{err}</p>}
      {list === null ? <div className="sl-empty"><LoaderCircle className="sl-spin" size={22} /><span>Loading…</span></div>
        : list.length === 0 && !err ? <p className="sl-sub">No questions were saved for this upload.</p>
          : <QaList questions={list} />}
    </div>
  )
}

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Hand, MessageCircle, PenLine } from 'lucide-react'
import {
  ago, day, ISSUE_STATUS, oz, pad, snip, type Aspirant, type AspirantGroup, type Faculty, type FacultyFull, type Issue, type IssueFull, type Page,
  type AspirantFull, type MyAspirant, type Poll, type Promise_, type Question, type Score, type Support, type Upload,
} from '../lib/ozone'
import { Err, Gate, MediaPicker, MediaView, Pill, ReportButton, ShareButton, SupportBox, useLoad, type OzCtx } from './OzCommon'

const TABS = [
  ['sauti', 'Issues'], ['faculties', 'Faculties'], ['polls', 'Polls'], ['promises', 'Promises'], ['aspirants', 'Elections'],
] as const

export function SautiNav({ page }: { page: string }) {
  const active = page === 'issue' || page === 'report' ? 'sauti' : page === 'faculty' ? 'faculties' : page
  return (
    <nav className="ef-tabs" aria-label="Sauti ya Comrades">
      {TABS.map(([id, label]) => <a key={id} className={`oz-tab${active === id ? ' on' : ''}`} href={`#/ozone/${id}`}>{label}</a>)}
    </nav>
  )
}

const tone = (s: string) => (s === 'resolved' ? 'green' : s === 'no_response' ? 'red' : s === 'responded' ? 'blue' : s === 'sent' ? 'gold' : 'grey')

function EvidencePill({ e }: { e: string }) {
  return e === 'confirmed' ? <Pill tone="green">Confirmed</Pill> : e === 'reported' ? <Pill tone="gold">Reported</Pill> : null
}

/* ---------------- issues ---------------- */

export function Issues({ ctx }: { ctx: OzCtx }) {
  const [fac, setFac] = useState('')
  const [cat, setCat] = useState('')
  const [st, setSt] = useState('')
  const [items, setItems] = useState<Issue[]>([])
  const [next, setNext] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const facs = useLoad(() => oz<{ faculties: Faculty[] }>('faculties'), [])

  const load = useCallback(async (before?: number) => {
    setLoading(true); setErr('')
    try {
      const r = await oz<Page<Issue>>('issues_list', { facultyCode: fac || undefined, category: cat || undefined, status: st || undefined, before })
      setItems((c) => (before ? [...c, ...r.items] : r.items)); setNext(r.nextBefore)
    } catch (e) { setErr((e as Error).message) }
    finally { setLoading(false) }
  }, [fac, cat, st])
  useEffect(() => { void load() }, [load])

  return (
    <div className="oz-wrap">
      <div className="oz-title">
        <div><h2>Sauti ya Comrades</h2><p className="cpl-sub">Student issues, checked by the admin, sent to the right office, tracked until they are fixed.</p></div>
        <a className="lp-btn" href="#/ozone/report"><PenLine size={15} /> Report an issue</a>
      </div>
      <SautiNav page="sauti" />
      <div className="oz-filters">
        <select className="ef-sel" value={fac} onChange={(e) => setFac(e.target.value)} aria-label="Faculty">
          <option value="">All faculties</option><option value="ALL">Whole university</option>
          {facs.data?.faculties.map((f) => <option key={f.code} value={f.code}>{f.code}</option>)}
        </select>
        <select className="ef-sel" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Category">
          <option value="">All categories</option>
          {Object.entries(ctx.cfg?.issueCategories ?? {}).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="ef-sel" value={st} onChange={(e) => setSt(e.target.value)} aria-label="Status">
          <option value="">Any status</option>
          {Object.entries(ISSUE_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <Err msg={err} />
      <div className="oz-list">
        {items.map((i) => (
          <a key={i.id} className="cpl-card oz-issue" href={`#/ozone/issue/${i.id}`}>
            <header><strong>#{pad(i.id, 3)}</strong><Pill tone={tone(i.status)}>{ISSUE_STATUS[i.status]}</Pill><EvidencePill e={i.evidence} /></header>
            <h3>{i.title}</h3>
            <small>{i.facultyName} · {i.categoryLabel} · {ago(i.publishedAt)}</small>
            <span className="oz-metoo"><Hand size={14} /> {i.meToo} me too</span>
          </a>
        ))}
        {!loading && !items.length && !err && <p className="cpl-empty">No issues match yet.</p>}
      </div>
      {loading && <p className="cpl-empty">Loading…</p>}
      {!loading && next !== null && <button type="button" className="lp-btn lp-btn-soft oz-more" onClick={() => void load(next)}>Load more</button>}
    </div>
  )
}

const UPDATE_LABEL: Record<string, string> = { sent: 'Sent to the office', response: 'Office responded', resolved: 'Resolved', no_response: 'No response', correction: 'Correction', note: 'Update' }

export function IssueDetail({ ctx, id }: { ctx: OzCtx; id: string }) {
  const { data, err, loading, reload } = useLoad(() => oz<IssueFull>('issue_get', { id: Number(id) }), [id, ctx.user?.uid])
  const [msg, setMsg] = useState('')
  async function metoo() {
    if (!ctx.user) { await ctx.signIn(); return }
    try { await oz('issue_metoo', { id: Number(id) }); reload() } catch (x) { setMsg((x as Error).message) }
  }
  return (
    <div className="oz-wrap">
      <a className="cpl-back" href="#/ozone/sauti">← All issues</a>
      <Err msg={err} />
      {loading && !data && <p className="cpl-empty">Loading…</p>}
      {data && (
        <article className="cpl-card oz-issue-full">
          <header><strong>#{pad(data.id, 3)}</strong><Pill tone={tone(data.status)}>{ISSUE_STATUS[data.status]}</Pill><EvidencePill e={data.evidence} /></header>
          <h2>{data.title}</h2>
          <small>{data.facultyName} · {data.categoryLabel} · published {day(data.publishedAt)}</small>
          <p className="oz-text">{data.details}</p>
          {data.aspirantId ? <p className="cpl-sub"><a className="cpl-link" href={`#/ozone/aspirant/${data.aspirantId}`}>Also sent to an aspirant's page</a></p> : null}
          <MediaView media={data.media} />
          <div className="oz-actions">
            <button type="button" className={`lp-btn${data.iMeToo ? ' lp-btn-soft' : ''}`} onClick={metoo} disabled={data.iMeToo}><Hand size={15} /> {data.iMeToo ? 'You said me too' : 'Me too'} · {data.meToo}</button>
            <ShareButton text={`Student issue #${pad(data.id, 3)} (${data.facultyName}): ${data.title}. Status: ${ISSUE_STATUS[data.status]}.`} path={`issue/${data.id}`} />
            <ReportButton ctx={ctx} kind="issue" refId={data.id} />
          </div>
          <Err msg={msg} />
          <h3 className="cpl-h3">Progress</h3>
          <ol className="oz-timeline">
            <li><b>Published</b><small>{day(data.publishedAt)}</small></li>
            {data.updates.map((u, i) => <li key={i}><b>{UPDATE_LABEL[u.kind] ?? 'Update'}</b><span>{u.note}</span><small>{day(u.at)}</small></li>)}
          </ol>
        </article>
      )}
    </div>
  )
}

export function ReportIssue({ ctx, aspirantId }: { ctx: OzCtx; aspirantId?: string }) {
  const cfg = ctx.cfg!
  const target = useLoad(() => (aspirantId ? oz<AspirantFull>('aspirant_get', { id: Number(aspirantId) }) : Promise.resolve(null)), [aspirantId])
  const facs = useLoad(() => oz<{ faculties: Faculty[] }>('faculties'), [])
  const [f, setF] = useState({ facultyCode: 'ALL', category: 'other', title: '', details: '' })
  const [media, setMedia] = useState<Upload[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [done, setDone] = useState<{ id: number; message: string; support: Support | null } | null>(null)
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }))

  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setErr('')
    try { setDone(await oz('issue_submit', { ...f, aspirantId: aspirantId ? Number(aspirantId) : undefined, media: media.length ? media : undefined })) }
    catch (x) { setErr((x as Error).message) }
    finally { setBusy(false) }
  }
  if (done) {
    return (
      <div className="oz-wrap"><div className="cpl-card oz-done">
        <h3>Received, #{pad(done.id, 3)}</h3><p>{done.message}</p>
        <p className="cpl-sub">The office gets a short window to reply before the issue goes public.</p>
        <SupportBox support={done.support} />
        <div className="ef-actions"><a className="lp-btn" href="#/ozone/sauti">Back to issues</a></div>
      </div></div>
    )
  }
  return (
    <div className="oz-wrap">
      <a className="cpl-back" href="#/ozone/sauti">← All issues</a>
      <h2>Report an issue</h2>
      <p className="cpl-sub">Be factual. Name the office or service, never a person. Your identity is never shown.</p>
      {target.data && (
        <p className="oz-banner">This issue will also show on the page of <b>{target.data.aspirant.name}</b> ({target.data.aspirant.position}, {target.data.aspirant.facultyCode}) once the admin approves it.</p>
      )}
      <Err msg={target.err} />
      <Gate ctx={ctx} what="report an issue">
        <form className="cpl-card cpl-form oz-form" onSubmit={submit}>
          <div className="cpl-grid2">
            <label>Faculty
              <select value={f.facultyCode} onChange={(e) => set('facultyCode', e.target.value)}>
                <option value="ALL">Whole university</option>
                {facs.data?.faculties.map((x) => <option key={x.code} value={x.code}>{x.code} · {x.name}</option>)}
              </select>
            </label>
            <label>Category
              <select value={f.category} onChange={(e) => set('category', e.target.value)}>
                {Object.entries(cfg.issueCategories).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
          </div>
          <label>Title<input type="text" value={f.title} maxLength={cfg.limits.issueTitleMax} required minLength={6} onChange={(e) => set('title', e.target.value)} placeholder="e.g. No water in the hostels for 3 days" /></label>
          <label>Details<textarea rows={6} value={f.details} maxLength={cfg.limits.issueMax} required minLength={20} onChange={(e) => set('details', e.target.value)} />
            <small>{f.details.length}/{cfg.limits.issueMax}. What happened, since when, who is affected.</small></label>
          <div><span className="oz-lbl">Photos as proof (optional)</span><MediaPicker cfg={cfg} allowVideo={false} label="Add photo" onChange={setMedia} /></div>
          <Err msg={err} />
          <button className="lp-btn" disabled={busy}>{busy ? 'Sending…' : 'Send for review'}</button>
        </form>
      </Gate>
    </div>
  )
}

/* ---------------- faculties ---------------- */

function ScoreBar({ s }: { s: Score }) {
  if (!s.total) return <small>No public issues yet.</small>
  return (
    <div className="oz-score">
      <span><b>{s.total}</b> issues</span><span><b>{s.responded}</b> replied</span><span><b>{s.resolved}</b> resolved</span><span><b>{s.noResponse}</b> silent</span>
      {s.avgReplyDays !== null && <span><b>{s.avgReplyDays}</b> days avg reply</span>}
    </div>
  )
}

export function Faculties() {
  const { data, err, loading } = useLoad(() => oz<{ faculties: Faculty[]; university: Score }>('faculties'), [])
  return (
    <div className="oz-wrap">
      <h2>Faculties</h2>
      <p className="cpl-sub">The scoreboard rates the office (how often and how fast it replies), never a person.</p>
      <ShareButton text="Chuka faculty scoreboard: how often and how fast each office replies to student issues." path="faculties" />
      <SautiNav page="faculties" />
      <Err msg={err} />{loading && <p className="cpl-empty">Loading…</p>}
      {data && (
        <div className="oz-list">
          <div className="cpl-card"><h3>Whole university</h3><ScoreBar s={data.university} /></div>
          {data.faculties.map((f) => (
            <a key={f.code} className="cpl-card oz-fac" href={`#/ozone/faculty/${f.code}`}>
              <strong>{f.code}</strong><span>{f.name}</span><ScoreBar s={f.score} />
            </a>
          ))}
        </div>
      )}
    </div>
  )
}

export function FacultyPage({ code, ctx }: { code: string; ctx: OzCtx }) {
  const { data, err, loading, reload } = useLoad(() => oz<FacultyFull>('faculty_get', { code }), [code])
  const [applying, setApplying] = useState(false)
  const [applied, setApplied] = useState('')
  const issues = useLoad(() => oz<Page<Issue>>('issues_list', { facultyCode: code }), [code])
  return (
    <div className="oz-wrap">
      <a className="cpl-back" href="#/ozone/faculties">← All faculties</a>
      <Err msg={err} />{loading && <p className="cpl-empty">Loading…</p>}
      {data && (
        <>
          <h2>{data.name}</h2>
          {data.url && <p className="cpl-sub"><a href={data.url} target="_blank" rel="noopener noreferrer">Faculty website</a></p>}
          <ShareButton text={`${data.name} on Chuka O-Zone: response scoreboard, leaders and student issues.`} path={`faculty/${data.code}`} />
          <div className="cpl-card"><h3>Response scoreboard</h3><ScoreBar s={data.score} /></div>
          <div className="cpl-card">
            <h3>Leaders</h3>
            {!data.leaders.length && <p className="cpl-empty">Not listed yet.</p>}
            {data.leaders.map((l) => (
              <div className="cpl-row" key={l.id}>
                <div><strong>{l.name}</strong><small>{l.role}{l.term ? ` · ${l.term}` : ''}</small></div>
                <Pill tone={l.status === 'current' ? 'green' : 'grey'}>{l.status}</Pill>
                {/^https?:/.test(l.sourceUrl) && <a href={l.sourceUrl} target="_blank" rel="noopener noreferrer">Source</a>}
              </div>
            ))}
          </div>
          <div className="oz-filters">
            <button type="button" className="lp-btn lp-btn-soft" onClick={() => setApplying(!applying)}>I am an aspirant</button>
          </div>
          {applying && ctx.cfg && (
            <ApplyForm ctx={ctx} cfg={ctx.cfg} faculties={[{ code: data.code, name: data.name, url: data.url, score: data.score } as Faculty]}
              onDone={() => { setApplying(false); setApplied('Application sent. You are listed once the admin matches you to the official notice.'); reload() }} />
          )}
          {applied && <p className="cpl-msg" role="status">{applied}</p>}
          {data.aspirants && data.aspirants.length > 0 && <AspirantGroups groups={data.aspirants} />}
          <h3 className="cpl-h3">Issues for {data.code}</h3>
          <div className="oz-list">
            {issues.data?.items.map((i) => (
              <a key={i.id} className="cpl-card oz-issue" href={`#/ozone/issue/${i.id}`}>
                <header><strong>#{pad(i.id, 3)}</strong><Pill tone={tone(i.status)}>{ISSUE_STATUS[i.status]}</Pill></header>
                <h3>{i.title}</h3>
              </a>
            ))}
            {issues.data && !issues.data.items.length && <p className="cpl-empty">No public issues yet.</p>}
          </div>
        </>
      )}
    </div>
  )
}

/* ---------------- polls and promises ---------------- */

export function Polls({ ctx, only }: { ctx: OzCtx; only?: string }) {
  const { data, err, loading, reload } = useLoad(() => oz<Poll[]>('polls_list'), [ctx.user?.uid])
  const [msg, setMsg] = useState('')
  async function vote(id: number, option: number) {
    if (!ctx.user) { await ctx.signIn(); return }
    try { await oz('poll_vote', { id, option }); setMsg(''); reload() } catch (x) { setMsg((x as Error).message) }
  }
  return (
    <div className="oz-wrap">
      <h2>Polls</h2>
      <p className="cpl-sub">What should the university fix first? One vote per student.</p>
      <SautiNav page="polls" />
      {only && <p className="cpl-note"><a className="cpl-link" href="#/ozone/polls">See all polls</a></p>}
      <Err msg={err || msg} />{loading && !data && <p className="cpl-empty">Loading…</p>}
      <div className="oz-list">
        {(only ? data?.filter((p) => String(p.id) === only) : data)?.map((p) => {
          const voted = p.myVote !== null
          return (
            <div key={p.id} className="cpl-card">
              <h3>{p.question}</h3>
              <small>{p.open ? (p.closesAt ? `Closes ${day(p.closesAt)}` : 'Open') : 'Closed'}</small>
              <div className="oz-opts">
                {p.options.map((o, i) => {
                  const n = p.counts?.[i] ?? 0, pct = p.total ? Math.round((n / p.total) * 100) : 0
                  return (
                    <button key={i} type="button" className={`oz-opt${p.myVote === i ? ' mine' : ''}`} disabled={!p.open || voted} onClick={() => void vote(p.id, i)}>
                      {p.counts && <i style={{ width: `${pct}%` }} />}
                      <span>{o}</span>{p.counts && <b>{pct}%</b>}
                    </button>
                  )
                })}
              </div>
              {p.counts ? <small>{p.total} vote{p.total === 1 ? '' : 's'}</small> : <small>{voted ? 'Thanks. Results show when the poll closes.' : 'Results show when the poll closes.'}</small>}
              <div className="oz-actions"><ShareButton text={`Chuka O-Zone poll: ${p.question} Cast your vote.`} path={`poll/${p.id}`} /></div>
            </div>
          )
        })}
        {data && !data.length && <p className="cpl-empty">No polls right now.</p>}
        {only && data && data.length > 0 && !data.some((p) => String(p.id) === only) && <p className="cpl-empty">That poll is not available.</p>}
      </div>
    </div>
  )
}

export function Promises() {
  const { data, err, loading } = useLoad(() => oz<Promise_[]>('promises_list'), [])
  const lbl = { pending: 'In progress', delivered: 'Delivered', missed: 'Missed' } as const
  const t = { pending: 'gold', delivered: 'green', missed: 'red' } as const
  return (
    <div className="oz-wrap">
      <h2>Promise tracker</h2>
      <p className="cpl-sub">Public promises by student offices, each with its source.</p>
      <SautiNav page="promises" />
      <Err msg={err} />{loading && <p className="cpl-empty">Loading…</p>}
      <div className="oz-list">
        {data?.map((p) => (
          <div key={p.id} className="cpl-card">
            <header className="oz-hd"><strong>{p.office}</strong><Pill tone={t[p.status]}>{lbl[p.status]}</Pill></header>
            <p className="oz-text">{p.promise}</p>
            <small>{p.due ? `Due ${p.due} · ` : ''}{/^https?:/.test(p.sourceUrl) ? <a href={p.sourceUrl} target="_blank" rel="noopener noreferrer">Source</a> : p.sourceUrl}</small>
            <div className="oz-actions"><ShareButton text={`Promise by ${p.office} (${lbl[p.status]}): ${snip(p.promise, 180)}`} path="promises" /></div>
          </div>
        ))}
        {data && !data.length && <p className="cpl-empty">No promises recorded yet.</p>}
      </div>
    </div>
  )
}

/* ---------------- elections: aspirants + questions ---------------- */

function AspirantGroups({ groups }: { groups: AspirantGroup[] }) {
  return (
    <>
      {groups.map((g) => (
        <div className="cpl-card" key={g.position}>
          <h3>{g.position}</h3>
          <p className="cpl-sub oz-small">Everyone gets the same space. Order changes daily.</p>
          <div className="oz-asp">
            {g.aspirants.map((a: Aspirant) => (
              <div key={a.id} className="oz-aspirant">
                {a.photo ? <img src={a.photo} alt="" loading="lazy" /> : <span className="oz-noimg" />}
                <div>
                  <strong>{a.name}</strong>
                  <small>{a.yearCourse} · {a.facultyCode}{a.status !== 'cleared' ? ` · ${a.status}` : ''}{a.acceptIssues ? ' · takes issues' : ''}</small>
                  <p>{a.manifesto}</p>
                  {a.gallery?.length > 0 && <MediaView media={a.gallery} />}
                  {a.contact && <small>Contact: {a.contact}</small>}
                  {(a.whatsappUrl || a.links?.length > 0) && (
                    <div className="oz-links">
                      {a.whatsappUrl && <a className="lp-btn lp-btn-soft" href={a.whatsappUrl} target="_blank" rel="noopener noreferrer"><MessageCircle size={14} /> Join WhatsApp group</a>}
                      {a.links?.map((l) => <a key={l.url} className="oz-chip" href={l.url} target="_blank" rel="noopener noreferrer nofollow">{l.label}</a>)}
                    </div>
                  )}
                  <div className="oz-actions">
                    <a className="lp-btn lp-btn-soft" href={`#/ozone/aspirant/${a.id}`}>Open page</a>
                    <ShareButton text={`${a.name}, aspirant for ${g.position} (${a.facultyCode}). Read the manifesto and ask questions on Chuka O-Zone.`} path={`aspirant/${a.id}`} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  )
}

/** One aspirant on their own page: profile, plus the verified issues students sent to this page. */
export function AspirantPage({ id, ctx }: { id: string; ctx: OzCtx }) {
  const { data, err, loading } = useLoad(() => oz<AspirantFull>('aspirant_get', { id: Number(id) }), [id])
  const mine = useLoad(() => (ctx.user ? oz<{ items: MyAspirant[] }>('aspirant_mine').catch(() => ({ items: [] as MyAspirant[] })) : Promise.resolve({ items: [] as MyAspirant[] })), [ctx.user?.uid])
  const [accept, setAccept] = useState<boolean | null>(null)
  const [msg, setMsg] = useState('')
  const isOwner = Boolean(mine.data?.items.some((x) => String(x.id) === id))
  const open = accept ?? Boolean(data?.aspirant.acceptIssues)
  async function toggle(v: boolean) {
    try { const r = await oz<{ acceptIssues: boolean }>('aspirant_inbox_set', { id: Number(id), accept: v }); setAccept(r.acceptIssues); setMsg('') }
    catch (x) { setMsg((x as Error).message) }
  }
  return (
    <div className="oz-wrap">
      <a className="cpl-back" href="#/ozone/aspirants">← All aspirants</a>
      <Err msg={err} />{loading && !data && <p className="cpl-empty">Loading…</p>}
      {data && (
        <>
          <AspirantGroups groups={[{ position: data.aspirant.position, aspirants: [data.aspirant] }]} />
          {isOwner && (
            <div className="cpl-card oz-inbox">
              <label className="cpl-file"><input type="checkbox" checked={open} onChange={(e) => void toggle(e.target.checked)} /> Students can send issues to my page</label>
              <small>Switching this off stops new issues. Issues already approved stay public.</small>
              <Err msg={msg} />
            </div>
          )}
          <div className="oz-title">
            <h3 className="cpl-h3">Issues sent to {data.aspirant.name}</h3>
            {open && <a className="lp-btn" href={`#/ozone/report/${data.aspirant.id}`}><PenLine size={15} /> Send an issue</a>}
          </div>
          <p className="cpl-sub oz-small">Issues are checked by the admin before they appear. They describe a problem, not a person.</p>
          <div className="oz-list">
            {data.issues.map((i) => (
              <a key={i.id} className="cpl-card oz-issue" href={`#/ozone/issue/${i.id}`}>
                <header><strong>#{pad(i.id, 3)}</strong><Pill tone={tone(i.status)}>{ISSUE_STATUS[i.status]}</Pill></header>
                <h3>{i.title}</h3>
                <small>{i.categoryLabel} · {ago(i.publishedAt)}</small>
                <span className="oz-metoo"><Hand size={14} /> {i.meToo} me too</span>
              </a>
            ))}
            {!data.issues.length && <p className="cpl-empty">{open ? 'No issues yet. Be the first to send one.' : 'This aspirant is not taking issues on their page.'}</p>}
          </div>
        </>
      )}
    </div>
  )
}

export function Elections({ ctx }: { ctx: OzCtx }) {
  const cfg = ctx.cfg!
  const facs = useLoad(() => oz<{ faculties: Faculty[] }>('faculties'), [])
  const [fac, setFac] = useState('')
  const asp = useLoad(() => oz<AspirantGroup[]>('aspirants_list', { facultyCode: fac || undefined }), [fac])
  const qs = useLoad(() => oz<Question[]>('questions_list', { facultyCode: fac || undefined }), [fac, ctx.user?.uid])
  const [mode, setMode] = useState<'' | 'ask' | 'apply'>('')
  const [msg, setMsg] = useState('')

  async function vote(id: number) {
    if (!ctx.user) { await ctx.signIn(); return }
    try { await oz('question_vote', { id }); qs.reload() } catch (x) { setMsg((x as Error).message) }
  }
  return (
    <div className="oz-wrap">
      <h2>Elections</h2>
      <p className="cpl-sub">Cleared aspirants only (checked against the official notice). Ask them questions, read their answers.</p>
      <SautiNav page="aspirants" />
      <div className="oz-filters">
        <select className="ef-sel" value={fac} onChange={(e) => setFac(e.target.value)} aria-label="Faculty">
          <option value="">All faculties</option>
          {facs.data?.faculties.map((f) => <option key={f.code} value={f.code}>{f.code}</option>)}
        </select>
        <button type="button" className="lp-btn lp-btn-soft" onClick={() => setMode(mode === 'ask' ? '' : 'ask')}>Ask a question</button>
        <button type="button" className="lp-btn lp-btn-soft" onClick={() => setMode(mode === 'apply' ? '' : 'apply')}>I am an aspirant</button>
      </div>
      {mode === 'ask' && <AskForm ctx={ctx} cfg={cfg} faculties={facs.data?.faculties ?? []} onDone={() => { setMode(''); setMsg('Question sent. It shows once the admin approves it.') }} />}
      {mode === 'apply' && <ApplyForm ctx={ctx} cfg={cfg} faculties={facs.data?.faculties ?? []} onDone={() => { setMode(''); setMsg('Application sent. You are listed once the admin matches you to the official notice.') }} />}
      {msg && <p className="cpl-msg" role="status">{msg}</p>}
      <Err msg={asp.err} />
      {asp.data && !asp.data.length && <p className="cpl-empty">No cleared aspirants listed yet.</p>}
      {asp.data && <AspirantGroups groups={asp.data} />}
      <h3 className="cpl-h3">Questions to aspirants</h3>
      <Err msg={qs.err} />
      <div className="oz-list">
        {qs.data?.map((q) => (
          <div key={q.id} className="cpl-card">
            <header className="oz-hd"><Pill>{q.facultyCode}</Pill><small>{q.position}</small></header>
            <p className="oz-text"><b>{q.question}</b></p>
            {q.answers.map((a) => <p key={a.aspirantId} className="oz-answer"><b>{a.name}:</b> {a.text}</p>)}
            {!q.answers.length && <small>No answers yet{q.deadline ? ` · answer by ${q.deadline}` : ''}.</small>}
            <div className="oz-actions">
              <button type="button" className="lp-btn lp-btn-soft" onClick={() => void vote(q.id)}><Hand size={14} /> Same question · {q.votes}</button>
              <ShareButton text={`Question to Chuka aspirants (${q.facultyCode}, ${q.position}): “${q.question}”`} path="aspirants" />
            </div>
          </div>
        ))}
        {qs.data && !qs.data.length && <p className="cpl-empty">No questions yet.</p>}
      </div>
    </div>
  )
}

function AskForm({ ctx, cfg, faculties, onDone }: { ctx: OzCtx; cfg: NonNullable<OzCtx['cfg']>; faculties: Faculty[]; onDone: () => void }) {
  const [f, setF] = useState({ facultyCode: faculties[0]?.code ?? '', position: cfg.positions[0] ?? '', question: '' })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  async function go(e: FormEvent) {
    e.preventDefault(); setBusy(true); setErr('')
    try { await oz('question_submit', { ...f, facultyCode: f.facultyCode || faculties[0]?.code }); onDone() } catch (x) { setErr((x as Error).message) } finally { setBusy(false) }
  }
  return (
    <Gate ctx={ctx} what="ask a question">
      <form className="cpl-card cpl-form oz-form" onSubmit={go}>
        <div className="cpl-grid2">
          <label>Faculty<select value={f.facultyCode} onChange={(e) => setF({ ...f, facultyCode: e.target.value })} required>
            {faculties.map((x) => <option key={x.code} value={x.code}>{x.code}</option>)}</select></label>
          <label>Position<select value={f.position} onChange={(e) => setF({ ...f, position: e.target.value })}>
            {cfg.positions.map((p) => <option key={p}>{p}</option>)}</select></label>
        </div>
        <label>Your question<textarea rows={3} value={f.question} minLength={10} maxLength={cfg.limits.questionMax} required onChange={(e) => setF({ ...f, question: e.target.value })} /></label>
        <Err msg={err} />
        <button className="lp-btn" disabled={busy}>{busy ? 'Sending…' : 'Send question'}</button>
      </form>
    </Gate>
  )
}

function ApplyForm({ ctx, cfg, faculties, onDone }: { ctx: OzCtx; cfg: NonNullable<OzCtx['cfg']>; faculties: Faculty[]; onDone: () => void }) {
  const [f, setF] = useState({ facultyCode: faculties[0]?.code ?? '', position: cfg.positions[0] ?? '', name: '', yearCourse: '', manifesto: '', contact: '', whatsappUrl: '', instagram: '', x: '', tiktok: '', facebook: '' })
  const [acceptIssues, setAcceptIssues] = useState(false)
  const [photo, setPhoto] = useState<Upload[]>([])
  const [gallery, setGallery] = useState<Upload[]>([])
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const words = f.manifesto.trim() ? f.manifesto.trim().split(/\s+/).length : 0
  async function go(e: FormEvent) {
    e.preventDefault(); setBusy(true); setErr('')
    const { instagram, x, tiktok, facebook, ...rest } = f
    const links = [instagram, x, tiktok, facebook].map((v) => v.trim()).filter(Boolean)
    try { await oz('aspirant_apply', { ...rest, links, acceptIssues, facultyCode: f.facultyCode || faculties[0]?.code, photo: photo[0], gallery }); onDone() } catch (x) { setErr((x as Error).message) } finally { setBusy(false) }
  }
  return (
    <Gate ctx={ctx} what="apply as an aspirant">
      <form className="cpl-card cpl-form oz-form" onSubmit={go}>
        <div className="cpl-grid2">
          <label>Faculty<select value={f.facultyCode} onChange={(e) => setF({ ...f, facultyCode: e.target.value })} required>
            {faculties.map((x) => <option key={x.code} value={x.code}>{x.code}</option>)}</select></label>
          <label>Position<select value={f.position} onChange={(e) => setF({ ...f, position: e.target.value })}>
            {cfg.positions.map((p) => <option key={p}>{p}</option>)}</select></label>
        </div>
        <div className="cpl-grid2">
          <label>Full name<input type="text" value={f.name} required minLength={3} maxLength={60} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
          <label>Year and course<input type="text" value={f.yearCourse} required minLength={3} maxLength={60} onChange={(e) => setF({ ...f, yearCourse: e.target.value })} placeholder="3rd year, BSc Computer Science" /></label>
        </div>
        <label>Manifesto<textarea rows={6} value={f.manifesto} required minLength={40} onChange={(e) => setF({ ...f, manifesto: e.target.value })} />
          <small className={words > cfg.limits.manifestoWords ? 'oz-over' : ''}>{words}/{cfg.limits.manifestoWords} words. Everyone gets the same space.</small></label>
        <label>Public contact (optional)<input type="text" value={f.contact} maxLength={80} onChange={(e) => setF({ ...f, contact: e.target.value })} /></label>
        <label>Campaign WhatsApp group or channel (optional)<input type="url" inputMode="url" value={f.whatsappUrl} maxLength={200} placeholder="https://chat.whatsapp.com/..." onChange={(e) => setF({ ...f, whatsappUrl: e.target.value })} />
          <small>Anyone can join with this link, so use a group you are happy to make public.</small></label>
        <div className="cpl-grid2">
          <label>Instagram (optional)<input type="url" inputMode="url" value={f.instagram} maxLength={200} placeholder="https://instagram.com/yourname" onChange={(e) => setF({ ...f, instagram: e.target.value })} /></label>
          <label>X / Twitter (optional)<input type="url" inputMode="url" value={f.x} maxLength={200} placeholder="https://x.com/yourname" onChange={(e) => setF({ ...f, x: e.target.value })} /></label>
          <label>TikTok (optional)<input type="url" inputMode="url" value={f.tiktok} maxLength={200} placeholder="https://tiktok.com/@yourname" onChange={(e) => setF({ ...f, tiktok: e.target.value })} /></label>
          <label>Facebook (optional)<input type="url" inputMode="url" value={f.facebook} maxLength={200} placeholder="https://facebook.com/yourname" onChange={(e) => setF({ ...f, facebook: e.target.value })} /></label>
        </div>
        <label className="cpl-file"><input type="checkbox" checked={acceptIssues} onChange={(e) => setAcceptIssues(e.target.checked)} /> Let students send issues to my page (the admin checks every issue first; I cannot edit or hide them)</label>
        <div><span className="oz-lbl">Your photo (optional)</span><MediaPicker cfg={{ ...cfg, limits: { ...cfg.limits, maxMedia: 1 } }} allowVideo={false} onChange={setPhoto} /></div>
        <div><span className="oz-lbl">Campaign posters (optional, up to {cfg.limits.galleryMax ?? 3})</span><MediaPicker cfg={{ ...cfg, limits: { ...cfg.limits, maxMedia: cfg.limits.galleryMax ?? 3 } }} allowVideo={false} label="Add poster" onChange={setGallery} /></div>
        <Err msg={err} />
        <button className="lp-btn" disabled={busy || words > cfg.limits.manifestoWords}>{busy ? 'Sending…' : 'Apply'}</button>
      </form>
    </Gate>
  )
}

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { ExternalLink, GraduationCap, Heart, MapPin, Music2, Play, Search, Target, Users, Wallet, Clock } from 'lucide-react'
import { CHUKA_LINKS, CU_COURSES, CU_FACULTIES, CU_INTAKES, CU_LEVELS, matchCourses, type CuCourse, type Goal } from '../lib/chukaCourses'
import { GOALS, SKILL_IDEAS, ytLink, type SkillIdea } from '../lib/skillPaths'
import { COURSE_PROVIDERS, providerLink } from '../lib/courseProviders'
import { Empty } from '../components/HubUi'
import './SkillsExplore.css'

export type Tab = Goal | 'chuka'
const COURSERA = COURSE_PROVIDERS.find((p) => p.id === 'coursera')!
const ICONS: Record<Tab, ReactNode> = {
  earning: <Wallet size={22} />, interest: <Target size={22} />, health: <Heart size={22} />, hobby: <Music2 size={22} />, chuka: <GraduationCap size={22} />,
}
const goalOf = (id: Goal) => GOALS.find((g) => g.id === id)!
const PAGE = 24

/* ---------- a skill idea ---------- */
function IdeaCard({ s, onClasses, onChuka }: { s: SkillIdea; onClasses: (q: string) => void; onChuka: (name: string) => void }) {
  const g = goalOf(s.goal)
  const related = useMemo(() => matchCourses(s.chuka, 2), [s.chuka])
  return (
    <article className="sl-resource ex-idea">
      <div className="sl-resource-top">
        <span className="ex-goal" style={{ color: g.color, background: g.bg }}>{g.label}</span>
        <span className="sl-chip">{s.category}</span>
      </div>
      <h3>{s.title}</h3>
      <p>{s.blurb}</p>
      <small className="ex-line"><b>You need:</b> {s.needs}</small>
      {s.how && <small className="ex-line"><b>How people earn:</b> {s.how}</small>}
      {related.length > 0 && (
        <div className="ex-related">
          <small className="ex-line"><b>Study it at Chuka:</b></small>
          <div className="ex-chips">{related.map((c) => <button key={c.id} className="ex-chip" onClick={() => onChuka(c.name)}>{c.name}</button>)}</div>
        </div>
      )}
      <div className="sl-resource-foot"><span className="sl-foot-actions">
        <a className="sl-mini" href={ytLink(s.query)} target="_blank" rel="noreferrer noopener"><Play size={13} /> Watch tutorials</a>
        <a className="sl-mini ghost" href={providerLink(COURSERA, s.query).href} target="_blank" rel="noreferrer noopener"><ExternalLink size={13} /> Free courses</a>
        <button className="sl-mini ghost" onClick={() => onClasses(s.title)}><Users size={13} /> Find a class</button>
      </span></div>
    </article>
  )
}

/* ---------- Chuka University programmes ---------- */
function CourseCard({ c, onSkill }: { c: CuCourse; onSkill: (q: string) => void }) {
  return (
    <article className="sl-resource ex-course">
      <div className="sl-resource-top">
        <span className="sl-chip">{c.level}</span>
        {c.goals.map((g) => <span key={g} className="ex-goal" style={{ color: goalOf(g).color, background: goalOf(g).bg }}>{goalOf(g).label}</span>)}
      </div>
      <h3>{c.name}</h3>
      <small className="sl-unitline">{c.faculty}</small>
      <div className="hub-meta ex-meta">
        <span><Clock size={13} /> {c.duration}</span>
        <span><Wallet size={13} /> KES {c.fee}</span>
        <span><MapPin size={13} /> {c.campus}</span>
      </div>
      <details className="ex-entry"><summary>Entry requirements</summary><p>{c.entry}</p></details>
      <div className="sl-resource-foot"><span className="sl-foot-actions">
        <a className="sl-mini" href={ytLink(c.topic)} target="_blank" rel="noreferrer noopener"><Play size={13} /> Free lessons</a>
        <button className="sl-mini ghost" onClick={() => onSkill(c.topic)}>Related skills</button>
        <a className="sl-mini ghost" href={CHUKA_LINKS.apply} target="_blank" rel="noreferrer noopener"><ExternalLink size={13} /> Apply</a>
      </span></div>
    </article>
  )
}

function ChukaCourses({ q, setQ, onSkill }: { q: string; setQ: (v: string) => void; onSkill: (q: string) => void }) {
  const [level, setLevel] = useState<string>('All levels')
  const [faculty, setFaculty] = useState('')
  const [goal, setGoal] = useState<'' | Goal>('')
  const [shown, setShown] = useState(PAGE)
  const needle = q.trim().toLowerCase()
  const list = useMemo(() => CU_COURSES.filter((c) =>
    (level === 'All levels' || c.level === level) && (!faculty || c.faculty === faculty) && (!goal || c.goals.includes(goal)) &&
    (!needle || `${c.name} ${c.faculty} ${c.topic}`.toLowerCase().includes(needle))), [level, faculty, goal, needle])
  useEffect(() => { setShown(PAGE) }, [level, faculty, goal, needle])
  const counts = useMemo(() => {
    const m: Record<string, number> = {}
    CU_COURSES.forEach((c) => { m[c.level] = (m[c.level] ?? 0) + 1 })
    return m
  }, [])
  return (
    <>
      <div className="ex-source">
        <strong><GraduationCap size={16} /> Chuka University programmes</strong>
        <p>From the university’s official programme list (issued July 2026). Fees are tuition only and exclude statutory fees. {CU_INTAKES} Always confirm on the official site before you apply.</p>
        <div className="ex-links">
          <a className="sl-mini" href={CHUKA_LINKS.apply} target="_blank" rel="noreferrer noopener"><ExternalLink size={13} /> Apply online</a>
          <a className="sl-mini ghost" href={CHUKA_LINKS.courseList} target="_blank" rel="noreferrer noopener"><ExternalLink size={13} /> Live course list</a>
          <a className="sl-mini ghost" href={CHUKA_LINKS.programmesPdf} target="_blank" rel="noreferrer noopener"><ExternalLink size={13} /> Official PDF</a>
        </div>
      </div>
      <div className="hub-bar">
        <div className="sl-search"><Search size={18} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search programmes, e.g. nursing, computer, agribusiness, law…" maxLength={80} aria-label="Search Chuka programmes" /></div>
      </div>
      <div className="hub-chips">
        {CU_LEVELS.map((l) => <button key={l} className={level === l ? 'on' : ''} onClick={() => setLevel(l)}>{l}{l !== 'All levels' && counts[l] ? ` (${counts[l]})` : ''}</button>)}
      </div>
      <div className="ex-filters">
        <select value={faculty} onChange={(e) => setFaculty(e.target.value)} aria-label="Faculty"><option value="">All faculties and schools</option>{CU_FACULTIES.map((f) => <option key={f}>{f}</option>)}</select>
        <select value={goal} onChange={(e) => setGoal(e.target.value as '' | Goal)} aria-label="Goal"><option value="">Any goal</option>{GOALS.map((g) => <option key={g.id} value={g.id}>Fits: {g.label}</option>)}</select>
      </div>
      <p className="sl-sub">{list.length} programme{list.length === 1 ? '' : 's'} found</p>
      {list.length === 0 ? <Empty icon={<GraduationCap size={26} />} title="No programme matches" text="Try a shorter word, or clear a filter. The live course list on chuka.ac.ke may have newer programmes." /> : (
        <>
          <div className="sl-grid">{list.slice(0, shown).map((c) => <CourseCard key={c.id} c={c} onSkill={onSkill} />)}</div>
          {list.length > shown && <p style={{ textAlign: 'center', marginTop: 14 }}><button className="sl-primary small" onClick={() => setShown((n) => n + PAGE)}>Show more ({list.length - shown} left)</button></p>}
        </>
      )}
    </>
  )
}

/* ---------- the Explore page ---------- */
export default function Explore({ onClasses, initialTab }: { onClasses: (q: string) => void; initialTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab ?? 'earning')
  const [q, setQ] = useState('')
  const [cq, setCq] = useState('')
  const [cat, setCat] = useState('')
  const info = tab === 'chuka' ? null : goalOf(tab)
  const ideas = useMemo(() => {
    const n = q.trim().toLowerCase()
    return SKILL_IDEAS.filter((s) => s.goal === tab && (!cat || s.category === cat) && (!n || `${s.title} ${s.blurb} ${s.category} ${s.query}`.toLowerCase().includes(n)))
  }, [tab, cat, q])
  const cats = useMemo(() => Array.from(new Set(SKILL_IDEAS.filter((s) => s.goal === tab).map((s) => s.category))), [tab])
  const pick = (t: Tab) => { setTab(t); setQ(''); setCat('') }
  const toChuka = (name: string) => { setCq(name); setTab('chuka'); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  /** From a Chuka programme: jump to the first skill idea that shares a word with the programme's topic, else look for classes. */
  const toSkills = (phrase: string) => {
    const words = phrase.toLowerCase().split(/\W+/).filter((w) => w.length > 3)
    for (const s of SKILL_IDEAS) {
      const text = `${s.title} ${s.blurb} ${s.query}`.toLowerCase()
      const w = words.find((x) => text.includes(x))
      if (w) { setTab(s.goal); setCat(''); setQ(w); window.scrollTo({ top: 0, behavior: 'smooth' }); return }
    }
    onClasses(phrase)
  }
  return (
    <>
      <section className="sl-hero">
        <div><span className="sl-kicker">EXPLORE</span><h1>Find a skill for your <em>goal</em></h1>
          <p>Choose why you want to learn: to earn, out of interest, for your health, or for a hobby. Or browse every Chuka University programme in one place.</p></div>
        <div className="sl-hero-art"><GraduationCap size={46} /><span>{CU_COURSES.length} Chuka programmes</span></div>
      </section>
      <div className="ex-tiles" role="tablist">
        {GOALS.map((g) => (
          <button key={g.id} role="tab" aria-selected={tab === g.id} className={`ex-tile ${tab === g.id ? 'on' : ''}`} style={{ '--tile': g.color, '--tilebg': g.bg } as CSSProperties} onClick={() => pick(g.id)}>
            <span className="ex-ico">{ICONS[g.id]}</span><strong>{g.label}</strong><small>{SKILL_IDEAS.filter((s) => s.goal === g.id).length} ideas</small>
          </button>
        ))}
        <button role="tab" aria-selected={tab === 'chuka'} className={`ex-tile ${tab === 'chuka' ? 'on' : ''}`} style={{ '--tile': '#1e754a', '--tilebg': '#e4f4ea' } as CSSProperties} onClick={() => pick('chuka')}>
          <span className="ex-ico">{ICONS.chuka}</span><strong>Chuka courses</strong><small>{CU_COURSES.length} programmes</small>
        </button>
      </div>
      {tab === 'chuka' ? <ChukaCourses q={cq} setQ={setCq} onSkill={toSkills} /> : (
        <>
          <p className="sl-sub ex-tag">{info!.tagline}</p>
          <div className="hub-bar"><div className="sl-search"><Search size={18} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${info!.label.toLowerCase()} skills…`} maxLength={60} aria-label="Search skills" /></div></div>
          <div className="hub-chips"><button className={cat === '' ? 'on' : ''} onClick={() => setCat('')}>All</button>{cats.map((c) => <button key={c} className={cat === c ? 'on' : ''} onClick={() => setCat(c)}>{c}</button>)}</div>
          {ideas.length === 0 ? <Empty title="No skills match" text="Try a different word or clear the filter." /> : (
            <div className="sl-grid">{ideas.map((s) => <IdeaCard key={s.id} s={s} onClasses={onClasses} onChuka={toChuka} />)}</div>
          )}
          {tab === 'earning' && <p className="sl-sub" style={{ marginTop: 14 }}>Earning is never guaranteed. Start small, build a few real samples, and ask a class tutor or the admin for guidance. Be careful with anyone who asks you to pay to “unlock” jobs.</p>}
          {tab === 'health' && <p className="sl-sub" style={{ marginTop: 14 }}>These are learning resources, not medical advice. For illness, injury or a mental health crisis, visit a clinic or the campus health and counselling services.</p>}
        </>
      )}
    </>
  )
}

import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { CalendarDays, ExternalLink, FileText, ListChecks, Pencil, Plus, Shield } from 'lucide-react'
import { cpl, docEditUrl, fmtDate, seasonState, type Season } from '../lib/cpl'
import { fileToB64, shrinkImage } from '../lib/files'
import CplFixtures from './CplFixtures'
import CplTeams from './CplTeams'

type Msg = { text: string; bad?: boolean } | null

export default function CplSeasons() {
  const [seasons, setSeasons] = useState<Season[] | null>(null)
  const [editing, setEditing] = useState<Season | 'new' | null>(null)
  const [fixturesFor, setFixturesFor] = useState<Season | null>(null)
  const [teamsFor, setTeamsFor] = useState<Season | null>(null)
  const [msg, setMsg] = useState<Msg>(null)

  useEffect(() => {
    cpl<Season[]>('seasonsList').then(setSeasons).catch((e) => setMsg({ text: e.message, bad: true }))
  }, [])

  function merge(s: Season) {
    setSeasons((prev) => {
      const l = prev ?? []
      return l.some((x) => x.id === s.id) ? l.map((x) => (x.id === s.id ? s : x)) : [s, ...l]
    })
  }

  if (teamsFor) return <CplTeams season={teamsFor} onBack={() => setTeamsFor(null)} />
  if (fixturesFor) return <CplFixtures season={fixturesFor} onBack={() => setFixturesFor(null)} />
  if (editing) return <SeasonForm season={editing === 'new' ? null : editing} onClose={(s) => { if (s) merge(s); setEditing(null) }} />

  return (
    <div className="cpl-page">
      <h2>Manage seasons</h2>
      <p className="cpl-sub">Create a season, set its transfer windows, add a cover, rules and fixtures.</p>
      <button className="lp-btn" onClick={() => setEditing('new')}><Plus size={16} /> New season</button>
      {msg && <p className={`cpl-msg${msg.bad ? ' bad' : ''}`} role="status">{msg.text}</p>}
      {seasons === null && !msg && <p className="cpl-empty">Loading…</p>}
      {seasons?.length === 0 && <p className="cpl-empty">No seasons yet. Create the first one.</p>}
      <div className="cpl-seasons cpl-sc-grid">
        {seasons?.map((s) => (
          <article className="cpl-sc" key={s.id}>
            <div className="cpl-sc-cover compact">
              {s.coverUrl && <img src={s.coverUrl} alt="" loading="lazy" />}
              <span className={`cpl-badge st-${seasonState(s)}`}>{seasonState(s)}</span>
              <div className="cpl-sc-title"><h3>{s.name}</h3><small><CalendarDays size={13} /> {fmtDate(s.startDate)} – {fmtDate(s.endDate)}</small></div>
            </div>
            <div className="cpl-sc-body">
              <div className="cpl-inline">
                <button className="lp-btn lp-btn-soft" onClick={() => setEditing(s)}><Pencil size={14} /> Edit</button>
                <button className="lp-btn lp-btn-soft" onClick={() => setTeamsFor(s)}><Shield size={14} /> Teams</button>
                <button className="lp-btn lp-btn-soft" onClick={() => setFixturesFor(s)}><ListChecks size={14} /> Fixtures</button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}

function ruleMime(f: File) {
  if (f.type) return f.type
  const e = f.name.split('.').pop()?.toLowerCase()
  return e === 'pdf' ? 'application/pdf' : e === 'docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : e === 'doc' ? 'application/msword' : ''
}

function SeasonForm({ season, onClose }: { season: Season | null; onClose: (s: Season | null) => void }) {
  const [saved, setSaved] = useState<Season | null>(season)
  const [f, setF] = useState({
    name: season?.name ?? '', startDate: season?.startDate ?? '', endDate: season?.endDate ?? '',
    preStart: season?.preStart ?? '', preEnd: season?.preEnd ?? '', midStart: season?.midStart ?? '', midEnd: season?.midEnd ?? '',
    description: season?.description ?? '',
  })
  const [cover, setCover] = useState('')
  const [rules, setRules] = useState<File | null>(null)
  const [removeRules, setRemoveRules] = useState(false)
  const [fk, setFk] = useState(0)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<Msg>(null)
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }))

  async function pickCover(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try { setCover(await shrinkImage(file, 1280)); setMsg(null) }
    catch { setMsg({ text: 'Could not read that image.', bad: true }) }
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setMsg(null)
    try {
      const s = await cpl<Season>('seasonSave', {
        ...f, id: saved?.id,
        coverBase64: cover ? cover.split(',')[1] : '', coverMime: cover ? 'image/jpeg' : '',
        rulesBase64: rules ? await fileToB64(rules) : '', rulesMime: rules ? ruleMime(rules) : '', rulesName: rules?.name ?? '',
        removeRules: removeRules && !rules,
      })
      setSaved(s); setCover(''); setRules(null); setRemoveRules(false); setFk((n) => n + 1)
      setMsg({ text: 'Season saved.' })
    } catch (x) { setMsg({ text: (x as Error).message, bad: true }) }
    finally { setBusy(false) }
  }

  // Open the tab first (inside the click) so pop-up blockers allow it, then point it at the doc.
  async function openRulesDoc() {
    if (!saved) return
    const w = window.open('', '_blank')
    setBusy(true); setMsg(null)
    try {
      const s = await cpl<Season>('rulesDoc', { id: saved.id })
      setSaved(s)
      if (w) w.location.href = docEditUrl(s.rulesDocId)
    } catch (x) { w?.close(); setMsg({ text: (x as Error).message, bad: true }) }
    finally { setBusy(false) }
  }

  const shownCover = cover || saved?.coverUrl || ''
  return (
    <div className="cpl-page">
      <button className="cpl-back cpl-linkbtn" onClick={() => onClose(saved)}>← All seasons</button>
      <h2>{saved ? 'Edit season' : 'New season'}</h2>
      <form className="cpl-card cpl-form cpl-wide" onSubmit={save}>
        <label>Season name<input type="text" required minLength={2} maxLength={80} placeholder="e.g. CPL 2026/27" value={f.name} onChange={(e) => set('name', e.target.value)} /></label>

        <fieldset className="cpl-fs"><legend>Season dates</legend>
          <div className="cpl-grid2">
            <label>Start date<input type="date" required value={f.startDate} onChange={(e) => set('startDate', e.target.value)} /></label>
            <label>End date<input type="date" required min={f.startDate} value={f.endDate} onChange={(e) => set('endDate', e.target.value)} /></label>
          </div>
        </fieldset>
        <fieldset className="cpl-fs"><legend>Pre-season transfer window</legend>
          <div className="cpl-grid2">
            <label>Opens<input type="date" value={f.preStart} onChange={(e) => set('preStart', e.target.value)} /></label>
            <label>Closes<input type="date" min={f.preStart} value={f.preEnd} onChange={(e) => set('preEnd', e.target.value)} /></label>
          </div>
        </fieldset>
        <fieldset className="cpl-fs"><legend>Mid-season transfer window</legend>
          <div className="cpl-grid2">
            <label>Opens<input type="date" min={f.startDate} max={f.endDate} value={f.midStart} onChange={(e) => set('midStart', e.target.value)} /></label>
            <label>Closes<input type="date" min={f.midStart || f.startDate} max={f.endDate} value={f.midEnd} onChange={(e) => set('midEnd', e.target.value)} /></label>
          </div>
          <small>Must fall inside the season dates. Leave both dates empty if there is no window.</small>
        </fieldset>

        <label>Description
          <textarea rows={4} maxLength={2000} value={f.description} onChange={(e) => set('description', e.target.value)} placeholder="What this season is about, format, prizes…" />
        </label>

        <div className="cpl-cover-pick">
          {shownCover && <img src={shownCover} alt="Season cover preview" />}
          <label>Season cover image<input type="file" accept="image/png,image/jpeg,image/webp" onChange={pickCover} /></label>
        </div>

        <fieldset className="cpl-fs"><legend>Season rules</legend>
          {saved?.rulesUrl && !removeRules && (
            <p className="cpl-file"><FileText size={15} /> <a href={saved.rulesUrl} target="_blank" rel="noopener noreferrer">{saved.rulesName || 'Rules document'}</a>
              <button type="button" className="cpl-linkbtn" onClick={() => setRemoveRules(true)}>Remove</button></p>
          )}
          {removeRules && <p className="cpl-note">The uploaded rules file will be removed when you save. <button type="button" className="cpl-linkbtn" onClick={() => setRemoveRules(false)}>Undo</button></p>}
          <label>Upload rules (PDF or Word, max 5 MB)
            <input key={fk} type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(e) => setRules(e.target.files?.[0] ?? null)} />
          </label>
          <div className="cpl-inline">
            <button type="button" className="lp-btn lp-btn-soft" disabled={busy || !saved} onClick={openRulesDoc}>
              <ExternalLink size={14} /> {saved?.rulesDocId ? 'Edit rules in Google Docs' : 'Write rules in Google Docs'}
            </button>
          </div>
          {!saved && <small>Save the season first, then you can create its rules Google Doc.</small>}
        </fieldset>

        <div className="cpl-inline">
          <button className="lp-btn" disabled={busy}>{busy ? 'Saving…' : saved ? 'Save changes' : 'Create season'}</button>
          <button type="button" className="lp-btn lp-btn-soft" onClick={() => onClose(saved)}>Done</button>
        </div>
        {msg && <p className={`cpl-msg${msg.bad ? ' bad' : ''}`} role="status">{msg.text}</p>}
      </form>
    </div>
  )
}

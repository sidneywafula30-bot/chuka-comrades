import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { ArrowLeft, Check, Pencil, Users, Plus, Shield, Trash2, X } from 'lucide-react'
import { cpl, fmtDate, type Division, type Season, type Team } from '../lib/cpl'
import { shrinkImage } from '../lib/files'
import TeamCard from '../components/TeamCard'
import CplPlayers from './CplPlayers'

type Msg = { text: string; bad?: boolean } | null
const EMPTY = { id: '', name: '', divisionId: '', description: '', coachName: '', coachEmail: '', coachWhatsapp: '' }

/** Chairman page: divisions (A, B…) and teams for one season. */
export default function CplTeams({ season, onBack }: { season: Season; onBack: () => void }) {
  const [divs, setDivs] = useState<Division[] | null>(null)
  const [teams, setTeams] = useState<Team[] | null>(null)
  const [f, setF] = useState(EMPTY)
  const [logo, setLogo] = useState('')          // newly picked logo (data URL)
  const [oldLogo, setOldLogo] = useState('')    // existing logo of the team being edited
  const [removeLogo, setRemoveLogo] = useState(false)
  const [fk, setFk] = useState(0)
  const [playersFor, setPlayersFor] = useState<Team | null>(null)
  const [newDiv, setNewDiv] = useState('')
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null)
  const [msg, setMsg] = useState<Msg>(null)
  const [busy, setBusy] = useState(false)
  const set = (k: keyof typeof EMPTY, v: string) => setF((p) => ({ ...p, [k]: v }))

  useEffect(() => {
    cpl<Division[]>('divisionsList', { seasonId: season.id }).then(setDivs).catch((e) => setMsg({ text: e.message, bad: true }))
    cpl<Team[]>('teamsList', { seasonId: season.id }).then(setTeams).catch((e) => setMsg({ text: e.message, bad: true }))
  }, [season.id])

  async function run<T>(fn: () => Promise<T>, ok?: string): Promise<T | undefined> {
    setBusy(true); setMsg(null)
    try { const r = await fn(); if (ok) setMsg({ text: ok }); return r }
    catch (x) { setMsg({ text: (x as Error).message, bad: true }) }
    finally { setBusy(false) }
  }

  async function addDivision(name: string) {
    const r = await run(() => cpl<Division[]>('divisionAdd', { seasonId: season.id, name }), `${name} added.`)
    if (r) { setDivs(r); setNewDiv('') }
  }
  async function renameDivision(e: FormEvent) {
    e.preventDefault()
    if (!renaming) return
    const r = await run(() => cpl<Division[]>('divisionRename', renaming), 'Division renamed.')
    if (r) { setDivs(r); setRenaming(null) }
  }
  async function removeDivision(d: Division) {
    if (!window.confirm(`Delete ${d.name}?`)) return
    const r = await run(() => cpl<Division[]>('divisionDelete', { id: d.id }), `${d.name} deleted.`)
    if (r) setDivs(r)
  }

  async function pickLogo(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try { setLogo(await shrinkImage(file, 400)); setRemoveLogo(false); setMsg(null) }
    catch { setMsg({ text: 'Could not read that image.', bad: true }) }
  }

  function reset() { setF(EMPTY); setLogo(''); setOldLogo(''); setRemoveLogo(false); setFk((n) => n + 1) }

  function edit(t: Team) {
    setF({ id: t.id, name: t.name, divisionId: t.divisionId, description: t.description, coachName: t.coachName, coachEmail: t.coachEmail, coachWhatsapp: t.coachWhatsapp })
    setLogo(''); setOldLogo(t.logoUrl); setRemoveLogo(false); setFk((n) => n + 1); setMsg(null)
    document.getElementById('team-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    const r = await run(() => cpl<Team[]>('teamSave', {
      ...f, seasonId: season.id,
      logoBase64: logo ? logo.split(',')[1] : '', logoMime: logo ? 'image/jpeg' : '', removeLogo: removeLogo && !logo,
    }), f.id ? 'Team updated.' : 'Team added.')
    if (r) { setTeams(r); reset() }
  }

  async function removeTeam(t: Team) {
    if (!window.confirm(`Delete ${t.name}?`)) return
    const r = await run(() => cpl<Team[]>('teamDelete', { id: t.id }), `${t.name} deleted.`)
    if (r) { setTeams(r); if (f.id === t.id) reset() }
  }

  if (playersFor) return <CplPlayers team={playersFor} onBack={() => setPlayersFor(null)} />
  const shownLogo = logo || (!removeLogo ? oldLogo : '')
  const noDivs = divs?.length === 0
  const has = (n: string) => divs?.some((d) => d.name.toLowerCase() === n.toLowerCase())

  return (
    <div className="cpl-page">
      <button className="cpl-back cpl-linkbtn" onClick={onBack}><ArrowLeft size={16} /> All seasons</button>
      <h2>{season.name}: teams</h2>
      <p className="cpl-sub">{fmtDate(season.startDate)} – {fmtDate(season.endDate)}. Set up the divisions, then add each team.</p>

      <section className="cpl-card">
        <h3>Divisions</h3>
        <div className="cpl-divs">
          {divs?.map((d) => (
            <span className="cpl-div" key={d.id}>
              {renaming?.id === d.id ? (
                <form onSubmit={renameDivision} className="cpl-div-edit">
                  <input autoFocus value={renaming.name} maxLength={40} onChange={(e) => setRenaming({ id: d.id, name: e.target.value })} aria-label="Division name" />
                  <button aria-label="Save name" disabled={busy}><Check size={14} /></button>
                  <button type="button" aria-label="Cancel" onClick={() => setRenaming(null)}><X size={14} /></button>
                </form>
              ) : (
                <>
                  <b>{d.name}</b>
                  <small>{teams?.filter((t) => t.divisionId === d.id).length ?? 0} teams</small>
                  <button aria-label={`Rename ${d.name}`} onClick={() => setRenaming({ id: d.id, name: d.name })}><Pencil size={13} /></button>
                  <button aria-label={`Delete ${d.name}`} onClick={() => removeDivision(d)}><Trash2 size={13} /></button>
                </>
              )}
            </span>
          ))}
          {divs === null && <p className="cpl-empty">Loading…</p>}
        </div>
        <div className="cpl-inline" style={{ marginTop: 14 }}>
          {!has('Division A') && <button type="button" className="lp-btn" disabled={busy} onClick={() => addDivision('Division A')}><Plus size={15} /> Add Division A</button>}
          {!has('Division B') && <button type="button" className="lp-btn" disabled={busy} onClick={() => addDivision('Division B')}><Plus size={15} /> Add Division B</button>}
        </div>
        <form className="cpl-inline" style={{ marginTop: 10 }} onSubmit={(e) => { e.preventDefault(); if (newDiv.trim()) addDivision(newDiv.trim()) }}>
          <input placeholder="Or a custom name, e.g. Division C" maxLength={40} value={newDiv} onChange={(e) => setNewDiv(e.target.value)} aria-label="Custom division name" />
          <button className="lp-btn lp-btn-soft" disabled={busy || !newDiv.trim()}>Add</button>
        </form>
      </section>

      <form id="team-form" className="cpl-card cpl-form cpl-wide" onSubmit={save}>
        <h3>{f.id ? 'Edit team' : 'Add a team'}</h3>
        {noDivs && <p className="cpl-note">Add at least one division above before saving a team.</p>}

        <div className="cpl-logo-pick">
          <div className="cpl-team-logo big">{shownLogo ? <img src={shownLogo} alt="Team logo preview" /> : <Shield size={30} />}</div>
          <div>
            <label>Team logo<input key={fk} type="file" accept="image/png,image/jpeg,image/webp" onChange={pickLogo} /></label>
            {(oldLogo && !removeLogo && !logo) && <button type="button" className="cpl-linkbtn" onClick={() => setRemoveLogo(true)}>Remove logo</button>}
            {removeLogo && <small>Logo will be removed on save. <button type="button" className="cpl-linkbtn" onClick={() => setRemoveLogo(false)}>Undo</button></small>}
          </div>
        </div>

        <div className="cpl-grid2">
          <label>Team name<input type="text" required minLength={2} maxLength={40} value={f.name} onChange={(e) => set('name', e.target.value)} /></label>
          <label>Division
            <select required value={f.divisionId} onChange={(e) => set('divisionId', e.target.value)}>
              <option value="">Select division…</option>
              {divs?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </label>
        </div>
        <label>Description
          <textarea rows={3} maxLength={600} value={f.description} onChange={(e) => set('description', e.target.value)} placeholder="Who the team is, colours, history…" />
        </label>

        <fieldset className="cpl-fs"><legend>Coach</legend>
          <label>Full name<input type="text" required minLength={2} maxLength={60} value={f.coachName} onChange={(e) => set('coachName', e.target.value)} /></label>
          <div className="cpl-grid2">
            <label>Email<input type="email" required value={f.coachEmail} onChange={(e) => set('coachEmail', e.target.value)} /></label>
            <label>WhatsApp number<input type="tel" required inputMode="numeric" placeholder="2547XXXXXXXX" value={f.coachWhatsapp} onChange={(e) => set('coachWhatsapp', e.target.value)} /></label>
          </div>
          <small>Coach email and WhatsApp are visible to chairmen only, not the public.</small>
        </fieldset>

        <div className="cpl-inline">
          <button className="lp-btn" disabled={busy || noDivs}>{busy ? 'Saving…' : f.id ? 'Save changes' : 'Add team'}</button>
          {f.id && <button type="button" className="lp-btn lp-btn-soft" onClick={reset}>Cancel edit</button>}
        </div>
        {msg && <p className={`cpl-msg${msg.bad ? ' bad' : ''}`} role="status">{msg.text}</p>}
      </form>

      {teams === null && <p className="cpl-empty">Loading…</p>}
      {teams?.length === 0 && <p className="cpl-empty">No teams yet.</p>}
      {divs?.map((d) => {
        const list = teams?.filter((t) => t.divisionId === d.id) ?? []
        return (
          <section className="cpl-card" key={d.id}>
            <h3>{d.name} ({list.length})</h3>
            {list.length === 0 && <p className="cpl-empty" style={{ textAlign: 'left' }}>No teams in this division.</p>}
            <div className="cpl-tc-grid">
              {list.map((t) => (
                <TeamCard key={t.id} t={t} contacts>
                  <button className="lp-btn" disabled={busy} onClick={() => setPlayersFor(t)}><Users size={14} /> Players</button>
                  <button className="lp-btn lp-btn-soft" disabled={busy} onClick={() => edit(t)}><Pencil size={14} /> Edit</button>
                  <button className="lp-btn lp-btn-soft cpl-danger" disabled={busy} onClick={() => removeTeam(t)} aria-label={`Delete ${t.name}`}><Trash2 size={14} /></button>
                </TeamCard>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}

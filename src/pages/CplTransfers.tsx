import { useEffect, useState, type FormEvent } from 'react'
import { ArrowRightLeft, Check, Download, X } from 'lucide-react'
import { cpl, fmtStamp, type Me, type Transfer, type TransferStage } from '../lib/cpl'

type Msg = { text: string; bad?: boolean } | null
const STAGE_TEXT: Record<TransferStage, string> = {
  awaiting_player: 'Waiting for the player', awaiting_coach: 'Waiting for the current coach', awaiting_chairman: 'Waiting for the chairman',
  approved: 'Approved', rejected: 'Rejected', cancelled: 'Cancelled',
}

/** Transfers for coaches (request a player), players (accept) and chairmen (final approval + official letter). */
export default function CplTransfers({ me }: { me: Me }) {
  const [list, setList] = useState<Transfer[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<Msg>(null)
  const isCoach = me.teams.length > 0
  const [f, setF] = useState({ toTeamId: me.teams[0]?.id ?? '', playerEmail: '' })

  useEffect(() => { cpl<Transfer[]>('transfers').then(setList).catch((e) => setMsg({ text: e.message, bad: true })) }, [])

  async function run(action: string, payload: Record<string, unknown>, done: string) {
    setBusy(true); setMsg(null)
    try { setList(await cpl<Transfer[]>(action, payload)); setMsg({ text: done }); return true }
    catch (e) { setMsg({ text: (e as Error).message, bad: true }); return false }
    finally { setBusy(false) }
  }
  async function request(e: FormEvent) {
    e.preventDefault()
    if (await run('transferRequest', f, 'Request sent. The player must accept it first.')) setF({ ...f, playerEmail: '' })
  }
  function respond(t: Transfer, approve: boolean) {
    let reason = ''
    if (!approve && t.stage !== 'awaiting_player') {
      const r = window.prompt('Reason (optional)'); if (r === null) return; reason = r
    }
    if (!approve && t.stage === 'awaiting_player' && !window.confirm('Decline this transfer?')) return
    const act = t.stage === 'awaiting_player' ? 'transferRespond' : t.stage === 'awaiting_coach' ? 'transferCoach' : 'transferChair'
    const done = t.stage === 'awaiting_player' ? (approve ? 'Accepted. Your current coach is next.' : 'Declined.')
      : t.stage === 'awaiting_coach' ? (approve ? 'Released. The chairman is next.' : 'Not released.')
      : (approve ? 'Approved. The transfer letter was created and the player has moved.' : 'Rejected.')
    run(act, { id: t.id, accept: approve, approve, reason }, done)
  }

  const needs = list?.filter((t) => t.youAct) ?? []
  const open = list?.filter((t) => !t.youAct && t.stage.startsWith('awaiting')) ?? []
  const closed = list?.filter((t) => !t.stage.startsWith('awaiting')) ?? []

  const card = (t: Transfer) => (
    <section className="cpl-card cpl-tr" key={t.id}>
      <div className="cpl-tr-head">
        <div>
          <strong>{t.playerName}</strong>
          <small className="cpl-muted-block">{t.fromTeamName} <ArrowRightLeft size={12} style={{ verticalAlign: -1 }} /> {t.toTeamName}{t.seasonName && ` · ${t.seasonName}`}</small>
        </div>
        <span className={`cpl-badge tr-${t.stage}`}>{STAGE_TEXT[t.stage]}</span>
      </div>
      <ol className="cpl-steps" aria-label="Progress">
        <li className="done"><i><Check size={12} /></i> Requested by {t.toCoachName || t.toTeamName}<small>{fmtStamp(t.createdAt)}</small></li>
        <li className={t.playerAt ? 'done' : ''}><i>{t.playerAt && <Check size={12} />}</i> Player accepts<small>{fmtStamp(t.playerAt)}</small></li>
        <li className={t.fromCoachAt ? 'done' : ''}><i>{t.fromCoachAt && <Check size={12} />}</i> {t.fromCoachName || t.fromTeamName} releases<small>{fmtStamp(t.fromCoachAt)}</small></li>
        <li className={t.chairAt ? 'done' : ''}><i>{t.chairAt && <Check size={12} />}</i> Chairman approves<small>{fmtStamp(t.chairAt)}</small></li>
      </ol>
      {(t.stage === 'rejected' || t.stage === 'cancelled') && <p className="cpl-err" style={{ margin: 0 }}>{t.rejectedBy ? `${t.rejectedBy}: ` : ''}{t.rejectReason}</p>}
      <div className="cpl-inline">
        {t.youAct && (
          <>
            <button className="lp-btn" disabled={busy} onClick={() => respond(t, true)}><Check size={14} /> {t.stage === 'awaiting_player' ? 'Accept' : t.stage === 'awaiting_coach' ? 'Release player' : 'Approve transfer'}</button>
            <button className="lp-btn lp-btn-soft cpl-danger" disabled={busy} onClick={() => respond(t, false)}><X size={14} /> Decline</button>
          </>
        )}
        {t.canCancel && <button className="lp-btn lp-btn-soft" disabled={busy} onClick={() => window.confirm('Cancel this transfer request?') && run('transferCancel', { id: t.id }, 'Request cancelled.')}>Cancel request</button>}
        {t.stage === 'approved' && t.letterUrl && <a className="lp-btn" href={t.letterUrl} target="_blank" rel="noopener noreferrer"><Download size={14} /> Transfer letter {t.letterNo}</a>}
      </div>
    </section>
  )

  return (
    <div className="cpl-page">
      <h2>Transfers</h2>
      <p className="cpl-sub">A coach asks the player by email. The player accepts, the current coach releases him, then the chairman approves. The official letter is created and the player's team updates automatically.</p>
      {isCoach && (
        <form className="cpl-card cpl-form" onSubmit={request}>
          <h3>Request a player</h3>
          {me.teams.length > 1 && (
            <label>For my team<select value={f.toTeamId} onChange={(e) => setF({ ...f, toTeamId: e.target.value })}>
              {me.teams.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.seasonName})</option>)}
            </select></label>
          )}
          <label>Player's email<input type="email" required placeholder="the email the player signs in with" value={f.playerEmail} onChange={(e) => setF({ ...f, playerEmail: e.target.value })} /></label>
          <small>The player must already be registered on another team this season. Requests are only allowed in the pre-season or mid-season transfer window.</small>
          <div className="cpl-inline"><button className="lp-btn" disabled={busy}>{busy ? 'Sending…' : 'Send request'}</button></div>
        </form>
      )}
      {msg && <p className={`cpl-msg${msg.bad ? ' bad' : ''}`} role="status">{msg.text}</p>}
      {list === null && !msg && <p className="cpl-empty">Loading…</p>}
      {list?.length === 0 && <p className="cpl-empty" style={{ textAlign: 'left' }}>No transfers yet.</p>}
      {needs.length > 0 && <><h3 className="cpl-h3">Needs your action ({needs.length})</h3>{needs.map(card)}</>}
      {open.length > 0 && <><h3 className="cpl-h3">In progress ({open.length})</h3>{open.map(card)}</>}
      {closed.length > 0 && <><h3 className="cpl-h3">Finished ({closed.length})</h3>{closed.map(card)}</>}
    </div>
  )
}

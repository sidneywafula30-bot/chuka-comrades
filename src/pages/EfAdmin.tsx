import { useCallback, useEffect, useState } from 'react'
import { Copy, Trophy } from 'lucide-react'
import ImagePicker from '../components/ImagePicker'
import { usePayCfg } from '../components/EfPay'
import { driveImg, ef, fmtStamp, fromParts, toParts, tournamentInviteLink, type AdminEarnings, type AdminLeague, type AdminPay, type AdminPlayer, type Attention, type FplAdminInfo, type HomeData, type Listing, type PayAdmin, type Tournament, ksh, waLink } from '../lib/efootball'

type Tab = 'payments' | 'listings' | 'payouts' | 'tournament' | 'attention' | 'leagues' | 'players' | 'settings' | 'fpl'
type Msg = { ok: boolean; text: string } | null

export default function EfAdmin() {
  const [tab, setTab] = useState<Tab>('payments')
  return (
    <div className="cpl-page">
      <h2>eFootball admin</h2>
      <p className="cpl-sub">Verify M-Pesa payments, pay hosts, run the knockout and keep the leagues tidy. League results settle themselves.</p>
      <div className="ef-tabs" role="tablist">
        {([['payments', 'Payments'], ['listings', 'Listings'], ['payouts', 'Host payouts'], ['tournament', 'Tournament'], ['attention', 'Needs attention'], ['leagues', 'Leagues'], ['players', 'Players'], ['settings', 'Settings'], ['fpl', 'FPL']] as [Tab, string][]).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>
      {tab === 'payments' ? <PaymentsAdmin /> : tab === 'listings' ? <ListingsAdmin /> : tab === 'payouts' ? <PayoutsAdmin /> : tab === 'tournament' ? <TournamentAdmin /> : tab === 'attention' ? <AttentionAdmin /> : tab === 'leagues' ? <LeaguesAdmin /> : tab === 'players' ? <PlayersAdmin /> : tab === 'fpl' ? <FplAdmin /> : <SettingsAdmin />}
    </div>
  )
}

function useMsg() {
  const [msg, setMsg] = useState<Msg>(null)
  const el = msg && <p className={`cpl-msg${msg.ok ? '' : ' bad'}`} role="status">{msg.text}</p>
  return { setMsg, el }
}

/* ---------------- payments: verify M-Pesa codes ---------------- */
function PaymentsAdmin() {
  const [all, setAll] = useState(false)
  const [d, setD] = useState<PayAdmin | null>(null)
  const [busy, setBusy] = useState('')
  const [notes, setNotes] = useState<Record<string, string>>({})
  const { setMsg, el } = useMsg()
  const load = useCallback(() => ef<PayAdmin>('payments', { status: all ? 'all' : 'pending' }).then(setD).catch((e) => setMsg({ ok: false, text: (e as Error).message })), [all, setMsg])
  useEffect(() => { void load() }, [load])
  async function decide(p: AdminPay, approve: boolean) {
    if (!approve && !window.confirm('Reject this payment? Remember to refund the player if the money reached you.')) return
    setBusy(p.id); setMsg(null)
    try { await ef('payDecide', { id: p.id, approve, note: notes[p.id] ?? '' }); setMsg({ ok: true, text: approve ? 'Verified and applied.' : 'Rejected.' }); await load() }
    catch (e) { setMsg({ ok: false, text: (e as Error).message }) }
    finally { setBusy('') }
  }
  const kindLabel: Record<string, string> = { league: 'League activation', knockout: 'Knockout entry', listing: 'Marketplace listing' }
  return (
    <>
      <section className="cpl-card">
        <h3>M-Pesa payments</h3>
        <p className="cpl-sub" style={{ margin: '0 0 10px' }}>Check each code against your M-Pesa statement, then tap Verify. Verifying activates the player, adds the knockout entry, or publishes the listing. Each M-Pesa code can only be used once.</p>
        {d && <div className="ef-facts"><div><small>Waiting</small><b>{d.summary.pending}</b></div><div><small>Verified</small><b>{d.summary.verified}</b></div><div><small>Verified total</small><b>{ksh(d.summary.verifiedTotal)}</b></div></div>}
        <div className="ef-actions"><button className="lp-btn" onClick={() => setAll((v) => !v)}>{all ? 'Show only waiting' : 'Show all payments'}</button><button className="lp-btn" onClick={() => void load()}>Refresh</button></div>
        {el}
      </section>
      {d && !d.rows.length && <p className="cpl-empty">{all ? 'No payments yet.' : 'Nothing is waiting for verification.'}</p>}
      {d?.rows.map((p) => (
        <section className="cpl-card" key={p.id}>
          <h3>{kindLabel[p.kind] ?? p.kind}: {ksh(p.amount)} <span className={`ef-pill${p.status === 'verified' ? '' : p.status === 'rejected' ? ' red' : ' gold'}`}>{p.status}</span></h3>
          <p className="cpl-sub" style={{ margin: '0 0 6px' }}><strong>{p.label}</strong></p>
          <p className="cpl-note" style={{ textAlign: 'left', margin: '0 0 8px' }}>M-Pesa code <strong>{p.mpesa}</strong> · {p.username || p.email} {p.fullName ? `(${p.fullName})` : ''} · {fmtStamp(p.createdAt)}{p.note ? ` · ${p.note}` : ''}</p>
          {p.listing && <p className="cpl-note" style={{ textAlign: 'left', margin: '0 0 8px' }}>{p.listing.type === 'sell' ? 'For sale' : 'Wanted'}: {p.listing.title} · {p.listing.platform} · {ksh(p.listing.price)}{p.listing.imageId ? <> · <a href={driveImg(p.listing.imageId, 1200)} target="_blank" rel="noopener noreferrer">screenshot</a></> : ''}{p.listing.details ? ` · ${p.listing.details}` : ''}</p>}
          <div className="ef-actions" style={{ marginTop: 6 }}>
            {p.whatsapp && <a className="cpl-link" href={waLink(p.whatsapp, `Hi ${p.username}, about your KSh ${p.amount} payment (${p.mpesa}) for ${p.label}.`)} target="_blank" rel="noopener noreferrer">WhatsApp {p.username || 'player'}</a>}
            {p.status === 'pending' && (
              <>
                <input className="ef-sel" value={notes[p.id] ?? ''} onChange={(e) => setNotes((n) => ({ ...n, [p.id]: e.target.value }))} placeholder="Note (optional)" maxLength={200} aria-label="Note" />
                <button className="lp-btn" disabled={busy === p.id} onClick={() => decide(p, true)}>Verify</button>
                <button className="lp-btn cpl-danger" disabled={busy === p.id} onClick={() => decide(p, false)}>Reject</button>
              </>
            )}
          </div>
        </section>
      ))}
    </>
  )
}

/* ---------------- marketplace: take down live listings ---------------- */
function ListingsAdmin() {
  const [list, setList] = useState<Listing[] | null>(null)
  const [q, setQ] = useState('')
  const { setMsg, el } = useMsg()
  const load = useCallback(() => ef<Listing[]>('listings', { type: '' }).then(setList).catch((e) => setMsg({ ok: false, text: (e as Error).message })), [setMsg])
  useEffect(() => { void load() }, [load])
  async function remove(l: Listing) {
    if (!window.confirm(`Remove "${l.title}" by ${l.owner.username}? It disappears from the marketplace.`)) return
    setMsg(null)
    try { await ef('listingRemove', { id: l.id }); setMsg({ ok: true, text: 'Listing removed.' }); await load() }
    catch (e) { setMsg({ ok: false, text: (e as Error).message }) }
  }
  const s = q.toLowerCase()
  const shown = (list ?? []).filter((l) => !s || l.title.toLowerCase().includes(s) || l.owner.username.toLowerCase().includes(s))
  return (
    <>
      <section className="cpl-card">
        <h3>Live marketplace listings</h3>
        <p className="cpl-sub" style={{ margin: '0 0 10px' }}>Listings go live when you verify their payment and stay up for 30 days. Remove anything fake, abusive or already sold. Removing does not refund the fee.</p>
        <div className="cpl-inline"><input type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${list?.length ?? 0} listings (title or seller)`} aria-label="Search listings" /></div>
        {el}
      </section>
      {list && !shown.length && <p className="cpl-empty">No live listings.</p>}
      {shown.map((l) => (
        <section className="cpl-card" key={l.id}>
          <div className="cpl-row" style={{ border: 0, padding: 0 }}>
            <div>
              <strong>{l.title} <span className="ef-pill gold">{l.type === 'sell' ? 'For sale' : 'Wanted'}</span></strong>
              <small>{ksh(l.price)} · {l.platform}{l.strength ? ` · strength ${l.strength}` : ''} · {l.owner.username} · live since {fmtStamp(l.approvedAt)}</small>
            </div>
            {l.imageId && <a href={driveImg(l.imageId, 1200)} target="_blank" rel="noopener noreferrer">Screenshot</a>}
            <button className="lp-btn cpl-danger" onClick={() => void remove(l)}>Remove</button>
          </div>
        </section>
      ))}
    </>
  )
}

/* ---------------- tournament form ---------------- */
function TournamentAdmin() {
  const [t, setT] = useState<Tournament | null | undefined>(undefined)
  const [mode, setMode] = useState<'' | 'edit' | 'new'>('')
  const { setMsg, el } = useMsg()
  const [busy, setBusy] = useState(false)
  const load = useCallback(async () => { try { setT(await ef<Tournament | null>('tournament')) } catch (e) { setMsg({ ok: false, text: (e as Error).message }); setT(null) } }, [setMsg])
  useEffect(() => { void load() }, [load])

  if (t === undefined) return <p className="cpl-empty">Loading…</p>
  const live = !!t && t.status !== 'done'
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true); setMsg(null)
    try { await fn(); await load(); setMsg({ ok: true, text: ok }) } catch (e) { setMsg({ ok: false, text: (e as Error).message }) } finally { setBusy(false) }
  }
  const link = t ? tournamentInviteLink(t.token) : ''

  return (
    <>
      {t && (
        <section className="cpl-card">
          <h3>{t.name} <span className="ef-pill">{t.status === 'open' ? 'registration open' : t.status === 'running' ? `round ${t.round} of ${t.stages}` : 'finished'}</span></h3>
          <p className="cpl-sub" style={{ margin: '0 0 12px' }}>{t.count} verified of {t.cap} ({t.cap === 64 ? '64-player knockout' : '512-player knockout'}){t.pending ? ` · ${t.pending} waiting for payment verification (Payments tab)` : ''} · entry KSh {t.fee ?? 0} · hosts earn KSh {t.hostFee} per pool, chosen automatically.</p>
          <div className="ef-copy"><span style={{ flex: 1 }}>{link}</span>
            <button className="lp-btn" onClick={() => { void navigator.clipboard?.writeText(link); setMsg({ ok: true, text: 'Invite link copied.' }) }}><Copy size={14} /> Copy</button></div>
          <div className="ef-actions">
            <button className="lp-btn" disabled={busy} onClick={() => setMode((m) => (m === 'edit' ? '' : 'edit'))}>{mode === 'edit' ? 'Close editor' : 'Edit tournament'}</button>
            {!live && <button className="lp-btn" disabled={busy} onClick={() => setMode((m) => (m === 'new' ? '' : 'new'))}>{mode === 'new' ? 'Cancel' : 'Start a new tournament'}</button>}
            {live && <button className="lp-btn cpl-danger" disabled={busy} onClick={() => run(() => ef('regenToken', { tid: t.id }), 'New invite link created. The old one no longer works.')}>New invite link</button>}
            {t.status === 'open' && <button className="lp-btn" disabled={busy} onClick={() => confirm('Close registration and draw the pools now?') && run(() => ef('drawNow', { tid: t.id }), 'Pools drawn.')}>Draw pools now</button>}
            {t.status === 'running' && <button className="lp-btn" disabled={busy} onClick={() => run(() => ef('advanceNow', { tid: t.id }), 'Advanced.')}>Advance to next round</button>}
          </div>
          {el}
        </section>
      )}
      {(!t || mode) && <TournamentForm key={mode || 'new'} t={mode === 'edit' ? t : null} onSaved={async () => { setMode(''); await load() }} />}
      {!t && el}
    </>
  )
}

function TournamentForm({ t, onSaved }: { t: Tournament | null; onSaved: () => Promise<void> }) {
  const first = toParts(t?.windows[0][0] ?? '')
  const reg = toParts(t?.regClose ?? '')
  const w = (i: number, k: 0 | 1, d: string) => toParts(t?.windows[i][k] ?? '').time || d
  const [name, setName] = useState(t?.name ?? 'Chuka Weekly Knockout')
  const [date, setDate] = useState(first.date)
  const [regTime, setRegTime] = useState(reg.time || '13:00')
  const [times, setTimes] = useState([w(0, 0, '14:00'), w(0, 1, '15:15'), w(1, 0, '15:25'), w(1, 1, '16:10'), w(2, 0, '16:20'), w(2, 1, '17:00')])
  const cfg = usePayCfg()
  const [cap, setCap] = useState(String(t?.cap === 64 ? 64 : 512))
  const [fee, setFee] = useState(String(t?.fee ?? 20))
  const [rules, setRules] = useState(t?.rules ?? '')
  const [logo, setLogo] = useState('')
  const [removeLogo, setRemoveLogo] = useState(false)
  const [busy, setBusy] = useState(false)
  const { setMsg, el } = useMsg()
  const open = !t || t.status === 'open'
  const setTime = (i: number, v: string) => setTimes((a) => a.map((x, j) => (j === i ? v : x)))
  const labels = ['Round 1 starts', 'Round 1 ends', 'Round 2 starts', 'Round 2 ends', 'Final starts', 'Final ends']
  // A 64-player knockout has no Round 2 (8 pools, then the final), so its times are hidden.
  const showR2 = open ? cap !== '64' : (t?.stages ?? 3) >= 3

  async function save() {
    setBusy(true); setMsg(null)
    try {
      const [s1, e1, s2, e2, s3, e3] = times.map((x) => fromParts(date, x))
      await ef('saveTournament', { t: { id: t?.id, name, rules, regClose: fromParts(date, regTime), s1, e1, s2, e2, s3, e3, cap: cap === '64' ? 64 : 512, fee: Number(fee), logo: logo || undefined, removeLogo } })
      setMsg({ ok: true, text: t ? 'Saved.' : 'Tournament created. Share the invite link.' })
      await onSaved()
    } catch (x) { setMsg({ ok: false, text: (x as Error).message }) } finally { setBusy(false) }
  }

  return (
    <section className="cpl-card cpl-form cpl-wide">
      <h3>{t ? 'Edit tournament' : 'New weekly tournament'}</h3>
      <label>Name<input type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} /></label>
      <fieldset className="cpl-fs">
        <legend>Tournament logo</legend>
        <ImagePicker current={driveImg(t?.logoId ?? '', 300)} fallback={<Trophy size={28} />} label="logo" max={600} onChange={(v) => { setLogo(v.data); setRemoveLogo(v.removed) }} />
      </fieldset>
      {open && (
        <div className="cpl-grid2">
          <label>Match day<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
          <label>Registration closes at<input type="time" value={regTime} onChange={(e) => setRegTime(e.target.value)} /><small>Same day, before Round 1. Pools are drawn automatically then.</small></label>
        </div>
      )}
      {!open && <label>Match day<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>}
      <fieldset className="cpl-fs">
        <legend>Round times (Nairobi)</legend>
        <div className="cpl-grid2">{labels.map((l, i) => ((i === 2 || i === 3) && !showR2 ? null : <label key={l}>{l}<input type="time" value={times[i]} onChange={(e) => setTime(i, e.target.value)} /></label>))}</div>
        <small>With fewer players the Final always uses the Final times.</small>
      </fieldset>
      {open && (
        <fieldset className="cpl-fs">
          <legend>Tournament size</legend>
          <div className="ef-sizes" role="radiogroup" aria-label="Tournament size">
            <button type="button" role="radio" aria-checked={cap === '512'} className={cap === '512' ? 'on' : ''} onClick={() => setCap('512')}><b>512 players</b><small>64 pools, then 8 pools, then the final</small></button>
            <button type="button" role="radio" aria-checked={cap === '64'} className={cap === '64' ? 'on' : ''} onClick={() => setCap('64')}><b>64 players</b><small>8 pools, then the final</small></button>
          </div>
          <small>The size only caps sign-ups. If fewer join, it still runs with the players who are in.</small>
        </fieldset>
      )}
      <p className="ef-hostnote">Hosts are chosen automatically by the system, players who ticked “can host” first. Each host earns <strong>KSh {cfg.hostFee}</strong> per pool they host. Pay them in the Host payouts tab.</p>
      {open && <label>Entry fee (KSh)<input type="number" min={0} max={cfg.maxFee} value={fee} onChange={(e) => setFee(e.target.value)} /><small>Players pay this by M-Pesa and you verify it in the Payments tab. 0 = free.</small></label>}
      <label>Rules<textarea rows={9} value={rules} onChange={(e) => setRules(e.target.value)} placeholder={'1. Be in the room on time.\n2. Match time: ...\n3. Disputes go to the admin with a screenshot.'} /></label>
      <button className="lp-btn" disabled={busy || !name || !date} onClick={save}>{busy ? 'Saving…' : t ? 'Save changes' : 'Create tournament'}</button>
      {el}
    </section>
  )
}

/* ---------------- disputes ---------------- */
function AttentionAdmin() {
  const [list, setList] = useState<Attention[] | null>(null)
  const { setMsg, el } = useMsg()
  const load = useCallback(() => ef<Attention[]>('attention').then(setList).catch((e) => setMsg({ ok: false, text: (e as Error).message })), [setMsg])
  useEffect(() => { void load() }, [load])
  async function pick(poolId: string, winnerUid: string) {
    try { await ef('setPoolWinner', { poolId, winnerUid }); setMsg({ ok: true, text: 'Winner set.' }); await load() } catch (e) { setMsg({ ok: false, text: (e as Error).message }) }
  }
  if (!list) return <>{el || <p className="cpl-empty">Loading…</p>}</>
  return (
    <>
      {el}
      {!list.length && <p className="cpl-empty">Nothing needs attention right now.</p>}
      {list.map((a) => (
        <section className="cpl-card" key={a.id}>
          <h3>Pool {a.idx} <span className="ef-pill red">{a.why}</span></h3>
          {a.disputes.map((d, i) => <p key={i} className="cpl-note" style={{ textAlign: 'left' }}>Dispute by {a.members.find((m) => m.uid === d.uid)?.username ?? '?'}: {d.reason || 'no reason given'}</p>)}
          {a.proofId && <a href={driveImg(a.proofId, 1200)} target="_blank" rel="noopener noreferrer">View the host's screenshot</a>}
          {a.members.map((m) => (
            <div className="cpl-row" key={m.uid}>
              <div><strong>{m.username}{m.uid === a.hostUid ? ' (host)' : ''}{m.uid === a.winnerUid ? ' (reported winner)' : ''}</strong><small>{m.whatsapp}</small></div>
              <button className="lp-btn" onClick={() => pick(a.id, m.uid)}>Winner</button>
            </div>
          ))}
        </section>
      ))}
    </>
  )
}

/* ---------------- host payouts ---------------- */
function PayoutsAdmin() {
  const [all, setAll] = useState(false)
  const [d, setD] = useState<AdminEarnings | null>(null)
  const [codes, setCodes] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState('')
  const { setMsg, el } = useMsg()
  const load = useCallback(() => ef<AdminEarnings>('earnings', { status: all ? 'all' : 'pending' }).then(setD).catch((e) => setMsg({ ok: false, text: (e as Error).message })), [all, setMsg])
  useEffect(() => { void load() }, [load])
  async function pay(uid: string, ids: string[]) {
    setBusy(uid); setMsg(null)
    try { await ef('earningPay', { ids, mpesa: codes[uid] ?? '' }); setMsg({ ok: true, text: 'Marked as paid. The host sees it on their profile.' }); await load() }
    catch (e) { setMsg({ ok: false, text: (e as Error).message }) }
    finally { setBusy('') }
  }
  return (
    <>
      <section className="cpl-card">
        <h3>Host payouts</h3>
        <p className="cpl-sub" style={{ margin: '0 0 10px' }}>Each host earns a fixed amount for every pool whose result they reported and that was confirmed. Pools you settled by hand earn nothing. Send the total by M-Pesa, paste the transaction code, then tap Mark paid.</p>
        {d && <div className="ef-facts"><div><small>Waiting to be paid</small><b>{ksh(d.summary.pending)}</b></div><div><small>Paid so far</small><b>{ksh(d.summary.paid)}</b></div><div><small>Hosts in this list</small><b>{d.summary.hosts}</b></div></div>}
        <div className="ef-actions"><button className="lp-btn" onClick={() => setAll((v) => !v)}>{all ? 'Show only unpaid' : 'Show all'}</button><button className="lp-btn" onClick={() => void load()}>Refresh</button></div>
        {el}
      </section>
      {d && !d.hosts.length && <p className="cpl-empty">{all ? 'No host earnings yet.' : 'No host is waiting to be paid.'}</p>}
      {d?.hosts.map((h) => {
        const pending = h.rows.filter((r) => r.status === 'pending')
        const owed = pending.reduce((n, r) => n + r.amount, 0)
        return (
          <section className="cpl-card" key={h.uid}>
            <h3>{h.username} <span className={`ef-pill${owed ? ' gold' : ''}`}>{owed ? `owed ${ksh(owed)}` : 'paid up'}</span></h3>
            <p className="cpl-note" style={{ textAlign: 'left', margin: '0 0 8px' }}>{h.fullName} · {h.rows.length} pool{h.rows.length === 1 ? '' : 's'}{h.whatsapp ? ` · ${h.whatsapp}` : ''}</p>
            {h.rows.slice(0, 6).map((r) => <div className="cpl-row" key={r.id}><div><strong>{ksh(r.amount)}</strong><small>{r.note}{r.mpesa ? ` · ${r.mpesa}` : ''}</small></div><span className={`ef-pill${r.status === 'paid' ? '' : ' gold'}`}>{r.status}</span></div>)}
            {pending.length > 0 && (
              <div className="ef-actions">
                {h.whatsapp && <a className="cpl-link" href={waLink(h.whatsapp, `Hi ${h.username}, your eFootball hosting earnings are ${ksh(owed)}. I am sending them by M-Pesa now.`)} target="_blank" rel="noopener noreferrer">WhatsApp {h.username}</a>}
                <input className="ef-sel ef-code" value={codes[h.uid] ?? ''} onChange={(e) => setCodes((c) => ({ ...c, [h.uid]: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10) }))} placeholder="M-Pesa code (optional)" aria-label="M-Pesa code of your transfer" maxLength={10} />
                <button className="lp-btn" disabled={busy === h.uid} onClick={() => pay(h.uid, pending.map((r) => r.id))}>Mark {ksh(owed)} paid</button>
              </div>
            )}
          </section>
        )
      })}
    </>
  )
}

/* ---------------- leagues ---------------- */
function LeaguesAdmin() {
  const [list, setList] = useState<AdminLeague[] | null>(null)
  const [q, setQ] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const { setMsg, el } = useMsg()
  const load = useCallback(() => ef<AdminLeague[]>('adminLeagues').then(setList).catch((e) => setMsg({ ok: false, text: (e as Error).message })), [setMsg])
  useEffect(() => { void load() }, [load])
  async function run(fn: () => Promise<unknown>, ok: string) { setMsg(null); try { await fn(); setMsg({ ok: true, text: ok }); await load() } catch (e) { setMsg({ ok: false, text: (e as Error).message }) } }
  const rename = (l: AdminLeague) => { const name = window.prompt('New name for this league', l.name); if (name && name.trim() !== l.name) void run(() => ef('adminRenameLeague', { id: l.id, name }), 'Renamed.') }
  const remove = (l: AdminLeague) => { if (window.confirm(`Remove "${l.name}"? Its ${l.members} member(s) stay registered but are no longer in any league.`)) void run(() => ef('adminRemoveLeague', { id: l.id }), 'League removed.') }
  const s = q.toLowerCase()
  const shown = (list ?? []).filter((l) => !s || l.name.toLowerCase().includes(s) || l.founder.toLowerCase().includes(s) || l.code.toLowerCase().includes(s))
  return (
    <>
      <section className="cpl-card">
        <h3>Leagues</h3>
        <p className="cpl-sub" style={{ margin: '0 0 12px' }}>Anyone can start a league. Leagues with reports come first. Rename an offensive name, remove a league, or merge a duplicate into another (members and matches move across).</p>
        <div className="cpl-inline"><input type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${list?.length ?? 0} leagues (name, founder, code)`} aria-label="Search leagues" /></div>
        {list && list.length > 1 && (
          <div className="cpl-inline" style={{ marginTop: 10 }}>
            <select className="ef-sel" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Merge from"><option value="">Merge this league…</option>{list.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
            <select className="ef-sel" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Merge into"><option value="">…into this one</option>{list.filter((l) => l.id !== from).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
            <button className="lp-btn" disabled={!from || !to} onClick={() => window.confirm('Merge these leagues? The first one is closed.') && void run(async () => { await ef('adminMergeLeagues', { from, to }); setFrom(''); setTo('') }, 'Leagues merged.')}>Merge</button>
          </div>
        )}
        {el}
      </section>
      {list && !shown.length && <p className="cpl-empty">No leagues match.</p>}
      {shown.slice(0, 100).map((l) => (
        <section className="cpl-card" key={l.id}>
          <div className="cpl-row" style={{ border: 0, padding: 0 }}>
            <div>
              <strong>{l.name} {l.reports > 0 && <span className="ef-pill red">{l.reports} report{l.reports === 1 ? '' : 's'}</span>} <span className="ef-pill">{l.isPublic ? 'public' : 'invite-only'}</span></strong>
              <small>{l.members} member{l.members === 1 ? '' : 's'} · founder {l.founder || '?'} · code {l.code}{l.about ? ` · ${l.about}` : ''}</small>
            </div>
            <button className="lp-btn" onClick={() => rename(l)}>Rename</button>
            <button className="lp-btn cpl-danger" onClick={() => remove(l)}>Remove</button>
          </div>
        </section>
      ))}
    </>
  )
}

/* ---------------- players ---------------- */
function PlayersAdmin() {
  const [list, setList] = useState<AdminPlayer[] | null>(null)
  const [q, setQ] = useState('')
  const { setMsg, el } = useMsg()
  const load = useCallback(() => ef<AdminPlayer[]>('adminPlayers').then(setList).catch((e) => setMsg({ ok: false, text: (e as Error).message })), [setMsg])
  useEffect(() => { void load() }, [load])
  async function ban(p: AdminPlayer) {
    try { await ef('setPlayerStatus', { uid: p.uid, banned: p.status === 'active' }); await load() } catch (e) { setMsg({ ok: false, text: (e as Error).message }) }
  }
  async function unlinkFpl(p: AdminPlayer) {
    try { await ef('fplUnlinkPlayer', { uid: p.uid }); await load() } catch (e) { setMsg({ ok: false, text: (e as Error).message }) }
  }
  const s = q.toLowerCase()
  const shown = (list ?? []).filter((p) => !s || p.username.toLowerCase().includes(s) || p.fullName.toLowerCase().includes(s) || p.whatsapp.includes(s) || p.email.toLowerCase().includes(s))
  return (
    <section className="cpl-card">
      {el}
      <div className="cpl-inline" style={{ marginBottom: 8 }}><input type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${list?.length ?? 0} players (name, username, phone, email)`} /></div>
      {shown.slice(0, 100).map((p) => (
        <div className="cpl-row" key={p.uid}>
          <div><strong>{p.username} {p.status !== 'active' && <span className="ef-pill red">{p.status}</span>}</strong><small>{p.fullName} · {p.league || 'no league'} · {p.platform} · {p.strength} · {p.whatsapp}</small></div>
          {p.fplId && <button className="lp-btn" title="Remove this player's FPL link" onClick={() => confirm(`Unlink FPL team ${p.fplId} from ${p.username}?`) && unlinkFpl(p)}>Unlink FPL {p.fplId}</button>}
          {p.squadId && <a href={driveImg(p.squadId, 1200)} target="_blank" rel="noopener noreferrer">Squad</a>}
          <button className={`lp-btn${p.status === 'active' ? ' cpl-danger' : ''}`} onClick={() => ban(p)}>{p.status === 'active' ? 'Ban' : 'Unban'}</button>
        </div>
      ))}
    </section>
  )
}

/* ---------------- settings: WhatsApp group, fixtures, videos ---------------- */
function SettingsAdmin() {
  const { setMsg, el } = useMsg()
  async function fixtures() {
    try {
      const r = await ef<{ made: number; fixtureDay: boolean }>('runFixtures')
      setMsg({ ok: true, text: r.fixtureDay ? `${r.made} new fixture(s) created for today.` : 'Today is not a fixture day (Mon, Wed, Fri, Sun).' })
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }) }
  }
  async function videos() {
    try { await ef('refreshVideos'); setMsg({ ok: true, text: 'Home page videos refreshed.' }) } catch (e) { setMsg({ ok: false, text: (e as Error).message }) }
  }
  const [wa, setWa] = useState('')
  useEffect(() => { ef<HomeData>('home').then((h) => setWa(h.waGroup ?? '')).catch(() => {}) }, [])
  async function saveWa() {
    try { await ef('setWaGroup', { link: wa }); setMsg({ ok: true, text: wa.trim() ? 'WhatsApp group link saved. It shows on the landing page within a minute.' : 'WhatsApp group link removed.' }) }
    catch (e) { setMsg({ ok: false, text: (e as Error).message }) }
  }
  return (
    <>
      <section className="cpl-card">
        <h3>WhatsApp group</h3>
        <p className="cpl-sub" style={{ margin: '0 0 12px' }}>Paste the Chuka eFootball group invite link (WhatsApp group info, Invite via link, Copy link). It appears as a button on the landing page. Leave it empty to hide the button.</p>
        <div className="cpl-inline">
          <input type="url" value={wa} onChange={(e) => setWa(e.target.value)} placeholder="https://chat.whatsapp.com/…" aria-label="WhatsApp group invite link" maxLength={200} />
          <button className="lp-btn" onClick={saveWa}>Save</button>
        </div>
        {el}
      </section>
      <section className="cpl-card">
        <h3>Daily fixtures</h3>
        <p className="cpl-sub" style={{ margin: '0 0 12px' }}>Fixtures are made automatically at 00:00 on Monday, Wednesday, Friday and Sunday, between members of the same league. Players send scores before 21:00 and every fixture settles by the rules at 21:00: the same score is confirmed; one screenshot beats none; a one-sided loss or draw stands, a one-sided win needs a screenshot (walkover 3-0), and a fixture nobody reports is void. Nothing needs your decision. Use this button only if the automatic run was missed.</p>
        <button className="lp-btn" onClick={fixtures}>Make today's fixtures now</button>
      </section>
      <section className="cpl-card">
        <h3>Home page videos</h3>
        <p className="cpl-sub" style={{ margin: '0 0 12px' }}>The six video rows on the home page are saved automatically every 12 hours, so visitors never use your YouTube quota. Refresh them by hand after changing the API key.</p>
        <button className="lp-btn" onClick={videos}>Refresh videos now</button>
      </section>
    </>
  )
}

/* ---------------- Chuka FPL ---------------- */
function FplAdmin() {
  const [info, setInfo] = useState<FplAdminInfo | null>(null)
  const [leagueId, setLeagueId] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const { setMsg, el } = useMsg()
  const apply = useCallback((i: FplAdminInfo) => { setInfo(i); setLeagueId(i.leagueId); setCode(i.leagueCode) }, [])
  useEffect(() => { ef<FplAdminInfo>('fplInfo').then(apply).catch((e) => setMsg({ ok: false, text: (e as Error).message })) }, [apply, setMsg])
  async function run(action: string, payload: Record<string, unknown>, ok: string) {
    setBusy(true); setMsg(null)
    try { apply(await ef<FplAdminInfo>(action, payload)); setMsg({ ok: true, text: ok }) }
    catch (e) { setMsg({ ok: false, text: (e as Error).message }) }
    finally { setBusy(false) }
  }
  return (
    <>
      <section className="cpl-card">
        <h3>Chuka FPL league</h3>
        <p className="cpl-sub" style={{ margin: '0 0 12px' }}>Create a classic league on the FPL site (Leagues &amp; Cups, Create and join, Create a league). Paste its league ID below: it is the number in the standings address, fantasy.premierleague.com/leagues/<b>123456</b>/standings/c. Only managers inside this league can link and count. Optionally paste the league's join code so players get a join button.</p>
        <div className="cpl-inline" style={{ marginBottom: 10 }}>
          <input type="text" inputMode="numeric" value={leagueId} onChange={(e) => setLeagueId(e.target.value.replace(/\D/g, ''))} placeholder="League ID, e.g. 123456" aria-label="FPL league ID" maxLength={9} />
          <input type="text" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Join code (optional)" aria-label="FPL league join code" maxLength={20} />
        </div>
        <div className="ef-actions" style={{ marginTop: 0 }}>
          <button className="lp-btn" disabled={busy} onClick={() => run('fplSettings', { leagueId, leagueCode: code }, leagueId ? 'Saved and loaded from FPL.' : 'FPL league cleared.')}>{busy ? 'Working…' : 'Save league'}</button>
          {info?.leagueId && <button className="lp-btn" disabled={busy} onClick={() => run('fplRefresh', {}, 'Refreshed from FPL.')}>Refresh now</button>}
        </div>
        {el}
      </section>
      {info?.leagueId && (
        <section className="cpl-card">
          <h3>Status</h3>
          <p className="cpl-sub" style={{ margin: 0 }}>
            {info.members} members in the FPL league · {info.linked} Chuka players linked ({info.inLeague} inside the league){info.gw ? ` · gameweek ${info.gw}` : ''}<br />
            Last refreshed: {info.at ? fmtStamp(info.at) : 'not yet'} (automatic every 30 minutes).
          </p>
          {info.error && <p className="cpl-err" role="alert" style={{ marginTop: 10 }}>Last refresh failed: {info.error} The page keeps showing the last good data.</p>}
          <p className="cpl-note" style={{ textAlign: 'left' }}>To remove a wrong link, open the Players tab and use Unlink FPL next to that player.</p>
        </section>
      )}
    </>
  )
}
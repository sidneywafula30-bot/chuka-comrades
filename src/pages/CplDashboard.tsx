import { useEffect, useState, type FormEvent } from 'react'
import { cpl, type Chair, type Me } from '../lib/cpl'

export default function CplDashboard({ me }: { me: Me }) {
  const [list, setList] = useState<Chair[]>([])
  const [email, setEmail] = useState('')
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null)
  const [busy, setBusy] = useState(false)
  const isOwner = me.role === 'owner'

  useEffect(() => {
    cpl<Chair[]>('chairmenList').then(setList).catch((e) => setMsg({ text: e.message, bad: true }))
  }, [])

  async function run(action: string, target: string, done: string, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return
    setBusy(true); setMsg(null)
    try {
      setList(await cpl<Chair[]>(action, { email: target }))
      setMsg({ text: done })
      if (action === 'ownerTransfer') window.location.reload() // your role just changed
    } catch (x) { setMsg({ text: (x as Error).message, bad: true }) }
    finally { setBusy(false) }
  }

  function add(e: FormEvent) {
    e.preventDefault()
    run('chairmanAdd', email, 'Chairman added.').then(() => setEmail(''))
  }

  return (
    <div className="cpl-page">
      <h2>Chairman dashboard</h2>
      <p className="cpl-sub">You are signed in as {me.role === 'owner' ? 'the CPL owner' : 'a chairman'} ({me.email}).</p>

      <section className="cpl-card">
        <h3>Seasons and fixtures</h3>
        <p className="cpl-sub" style={{ margin: '0 0 14px' }}>Create seasons, set transfer windows, upload the cover and rules, and manage fixtures.</p>
        <a className="lp-btn" href="#/cpl/manage-seasons">Manage seasons</a>
      </section>

      <section className="cpl-card">
        <h3>Venues and referees</h3>
        <p className="cpl-sub" style={{ margin: '0 0 14px' }}>Add the pitches (with a Google Maps link) and the referee panel.</p>
        <div className="cpl-inline">
          <a className="lp-btn" href="#/cpl/venues">Manage venues</a>
          <a className="lp-btn lp-btn-soft" href="#/cpl/referees">Manage referees</a>
        </div>
      </section>

      <section className="cpl-card">
        <h3>Approvals</h3>
        <p className="cpl-sub" style={{ margin: '0 0 14px' }}>Approve player stats entered by referees, and give the final approval on player transfers.</p>
        <div className="cpl-inline">
          <a className="lp-btn" href="#/cpl/stats-approvals">Player stats</a>
          <a className="lp-btn lp-btn-soft" href="#/cpl/transfers">Transfers</a>
        </div>
      </section>

      <section className="cpl-card">
        <h3>Chairmen</h3>
        {list.map((c) => (
          <div className="cpl-row" key={c.email}>
            <div><strong>{c.fullName || c.email}</strong>{c.fullName && <small>{c.email}</small>}</div>
            <span className={`cpl-badge ${c.role}`}>{c.role === 'owner' ? 'Owner' : 'Chairman'}</span>
            {isOwner && c.role === 'chairman' && (
              <>
                <button className="lp-btn lp-btn-soft" disabled={busy}
                  onClick={() => run('ownerTransfer', c.email, 'Ownership transferred.', `Transfer ownership to ${c.email}? You will become a regular chairman.`)}>
                  Make owner
                </button>
                <button className="lp-btn lp-btn-soft cpl-danger" disabled={busy}
                  onClick={() => run('chairmanRemove', c.email, 'Chairman removed.', `Remove ${c.email} as chairman?`)}>
                  Remove
                </button>
              </>
            )}
          </div>
        ))}
        {!list.length && !msg && <p className="cpl-empty">Loading…</p>}
      </section>

      <section className="cpl-card">
        <h3>Add a chairman</h3>
        <form className="cpl-inline" onSubmit={add}>
          <input type="email" required placeholder="their Google email" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Chairman email" />
          <button className="lp-btn" disabled={busy}>Add chairman</button>
        </form>
        {isOwner && <p className="cpl-note">To hand over ownership, add them here first, then press “Make owner” beside their name.</p>}
      </section>
      {msg && <p className={`cpl-msg${msg.bad ? ' bad' : ''}`} role="status">{msg.text}</p>}
    </div>
  )
}

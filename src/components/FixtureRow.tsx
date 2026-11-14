import { useState, type ReactNode } from 'react'
import { ChevronDown, ClipboardCheck, MapPin, Whistle } from 'lucide-react'
import { fmtDate, type Fixture } from '../lib/cpl'

/** One fixture: teams/score, date, venue (with Maps link), referee, and the referee's match report when filed. */
export default function FixtureRow({ x, highlight, children }: { x: Fixture; highlight?: string; children?: ReactNode }) {
  const [open, setOpen] = useState(false)
  const played = x.homeScore !== ''
  const hasReport = !!x.summary
  const name = (n: string) => (highlight && n === highlight ? <b className="cpl-me">{n}</b> : n)
  return (
    <div className="cpl-fxc">
      <div className="cpl-fxc-top">
        <small>{[x.matchday && `Matchday ${x.matchday}`, fmtDate(x.date), x.time].filter(Boolean).join(' · ')}</small>
        <span className={`cpl-badge st-${x.status}`}>{x.status}</span>
      </div>
      <div className="cpl-fxc-teams">
        <span>{name(x.home)}</span>
        <em>{played ? `${x.homeScore} – ${x.awayScore}` : 'vs'}</em>
        <span>{name(x.away)}</span>
      </div>
      <div className="cpl-fxc-meta">
        {x.venue && (x.venueMapsUrl
          ? <a href={x.venueMapsUrl} target="_blank" rel="noopener noreferrer"><MapPin size={13} /> {x.venue}</a>
          : <span><MapPin size={13} /> {x.venue}</span>)}
        {x.refereeName && <span><Whistle size={13} /> {x.refereeName}</span>}
        {hasReport && <button type="button" className="cpl-linkbtn" onClick={() => setOpen(!open)} aria-expanded={open}><ClipboardCheck size={13} /> Match report <ChevronDown size={13} className={open ? 'flip' : ''} /></button>}
      </div>
      {open && hasReport && (
        <div className="cpl-report">
          <p>{x.summary}</p>
          {x.scorers && <p><b>Scorers:</b> {x.scorers}</p>}
          {x.cards && <p><b>Cards:</b> {x.cards}</p>}
          <small>Report by {x.refereeName || 'the referee'}</small>
        </div>
      )}
      {children}
    </div>
  )
}

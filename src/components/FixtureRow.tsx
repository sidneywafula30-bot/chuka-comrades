import { useEffect, useState, type ReactNode } from 'react'
import { ChevronDown, ClipboardCheck, ExternalLink, MapPin } from 'lucide-react'
import { fmtDate, type Fixture } from '../lib/cpl'
import './FixtureRow.css'

const isHttps = (u?: string) => /^https:\/\//i.test(u || '')
/** Drive thumbnails are saved at 1000px; ask for a smaller one (much faster to load) when the picture is shown small. */
const sized = (u: string | undefined, w: number) => (u || '').replace(/([?&]sz=)w\d+/, `$1w${w}`)
const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?'

/** CPL kick-off times are East Africa Time (UTC+3, no daylight saving). */
const kickoffOf = (x: Pick<Fixture, 'date' | 'time'>) => Date.parse(`${x.date}T${x.time || '00:00'}:00+03:00`)

/* One shared one-second ticker for every countdown on the page (instead of one timer per card). */
const listeners = new Set<() => void>()
let ticker: ReturnType<typeof setInterval> | undefined
function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const l = () => setNow(Date.now())
    listeners.add(l); l()
    if (!ticker) ticker = setInterval(() => listeners.forEach((fn) => fn()), 1000)
    return () => {
      listeners.delete(l)
      if (!listeners.size && ticker) { clearInterval(ticker); ticker = undefined }
    }
  }, [active])
  return now
}

function Pic({ url, name, className, w }: { url?: string; name: string; className: string; w: number }) {
  const [bad, setBad] = useState(false)
  useEffect(() => setBad(false), [url])
  if (!isHttps(url) || bad) return <span className={`${className} ph`} aria-hidden>{initials(name)}</span>
  return <img className={className} src={sized(url, w)} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setBad(true)} />
}

function Countdown({ ms }: { ms: number }) {
  const s = Math.max(0, Math.floor(ms / 1000))
  const parts: [number, string][] = [[Math.floor(s / 86400), 'days'], [Math.floor((s % 86400) / 3600), 'hrs'], [Math.floor((s % 3600) / 60), 'min'], [s % 60, 'sec']]
  return (
    <div className="cpl-fx-count" role="timer" aria-live="off">
      {parts.map(([n, l]) => <div key={l}><b>{String(n).padStart(2, '0')}</b><small>{l}</small></div>)}
    </div>
  )
}

/**
 * One fixture: venue photo as the background, both team logos, score or live countdown, venue with its Google Maps link,
 * the referee's photo, and (below the picture) the match report and any actions passed as children.
 */
export default function FixtureRow({ x, highlight, children }: { x: Fixture; highlight?: string; children?: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [bgBad, setBgBad] = useState(false)
  const played = x.homeScore !== ''
  const hasReport = !!x.summary
  const kick = kickoffOf(x)
  const counting = x.status === 'scheduled' && !isNaN(kick)
  const now = useNow(counting && Date.now() < kick)
  const left = kick - now
  const name = (n: string) => (highlight && n === highlight ? <b className="cpl-fx-me">{n}</b> : n)

  let centre: ReactNode
  if (x.status === 'postponed') centre = <span className="cpl-fx-pill warn">Postponed</span>
  else if (played) centre = <span className="cpl-fx-score">{x.homeScore} – {x.awayScore}</span>
  else if (x.status === 'live') centre = <><span className="cpl-fx-vs">VS</span><span className="cpl-fx-pill live">Live</span></>
  else if (counting && left > 0) centre = <><span className="cpl-fx-vs">VS</span><Countdown ms={left} /></>
  else centre = <><span className="cpl-fx-vs">VS</span>{counting && <span className="cpl-fx-pill">Kick-off time reached</span>}</>

  return (
    <article className="cpl-fx" aria-label={`${x.home} versus ${x.away}`}>
      <div className="cpl-fx-hero">
        {isHttps(x.venueImageUrl) && !bgBad && <img className="cpl-fx-bg" src={sized(x.venueImageUrl, 640)} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setBgBad(true)} />}
        <div className="cpl-fx-shade" />
        <div className="cpl-fx-body">
          <div className="cpl-fx-top">
            <span>{[x.matchday && `Matchday ${x.matchday}`, fmtDate(x.date), x.time ? `${x.time} EAT` : 'time to be confirmed'].filter(Boolean).join(' · ')}</span>
            <span className={`cpl-badge st-${x.status}`}>{x.status}</span>
          </div>

          <div className="cpl-fx-teams">
            <div className="cpl-fx-team"><Pic url={x.homeLogoUrl} name={x.home} className="cpl-fx-logo" w={160} /><b>{name(x.home)}</b></div>
            <div className="cpl-fx-mid">{centre}</div>
            <div className="cpl-fx-team"><Pic url={x.awayLogoUrl} name={x.away} className="cpl-fx-logo" w={160} /><b>{name(x.away)}</b></div>
          </div>

          <div className="cpl-fx-foot">
            <div className="cpl-fx-venue">
              <MapPin size={15} aria-hidden />
              <span>{x.venue || 'Venue to be confirmed'}</span>
              {x.venue && isHttps(x.venueMapsUrl) && (
                <a href={x.venueMapsUrl} target="_blank" rel="noopener noreferrer">Google Maps <ExternalLink size={11} aria-hidden /></a>
              )}
            </div>
            {x.refereeName && (
              <div className="cpl-fx-ref">
                <Pic url={x.refereeImageUrl} name={x.refereeName} className="cpl-fx-refpic" w={120} />
                <span><small>Referee</small><b>{x.refereeName}</b></span>
              </div>
            )}
          </div>
        </div>
      </div>

      {(hasReport || children) && (
        <div className="cpl-fx-extra">
          {hasReport && (
            <button type="button" className="cpl-linkbtn" onClick={() => setOpen(!open)} aria-expanded={open}>
              <ClipboardCheck size={13} /> Match report <ChevronDown size={13} className={open ? 'flip' : ''} />
            </button>
          )}
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
      )}
    </article>
  )
}

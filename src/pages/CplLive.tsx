import { useEffect, useState } from 'react'
import { Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, Droplets, Sun, Wind, type LucideIcon } from 'lucide-react'
import { cpl } from '../lib/cpl'
import './CplLive.css'

/* ---------- Weather: Open-Meteo (free, no API key, works from the browser) ---------- */

const CHUKA = { lat: -0.3333, lon: 37.65, name: 'Chuka' }
const WEATHER_URL =
  `https://api.open-meteo.com/v1/forecast?latitude=${CHUKA.lat}&longitude=${CHUKA.lon}` +
  '&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m' +
  '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max' +
  '&timezone=Africa%2FNairobi&forecast_days=4'

type Weather = {
  current: { temperature_2m: number; relative_humidity_2m: number; apparent_temperature: number; weather_code: number; wind_speed_10m: number }
  daily: { time: string[]; weather_code: number[]; temperature_2m_max: number[]; temperature_2m_min: number[]; precipitation_probability_max: number[] }
}

function wmo(code: number): { label: string; Icon: LucideIcon } {
  if (code === 0) return { label: 'Clear sky', Icon: Sun }
  if (code <= 2) return { label: 'Partly cloudy', Icon: CloudSun }
  if (code === 3) return { label: 'Overcast', Icon: Cloud }
  if (code === 45 || code === 48) return { label: 'Foggy', Icon: CloudFog }
  if (code >= 51 && code <= 57) return { label: 'Drizzle', Icon: CloudDrizzle }
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return { label: 'Rain', Icon: CloudRain }
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { label: 'Snow', Icon: CloudSnow }
  if (code >= 95) return { label: 'Thunderstorm', Icon: CloudLightning }
  return { label: 'Cloudy', Icon: Cloud }
}

function WeatherCard() {
  const [w, setW] = useState<Weather | null>(null)
  const [err, setErr] = useState(false)

  useEffect(() => {
    const ctrl = new AbortController()
    fetch(WEATHER_URL, { signal: ctrl.signal })
      .then((r) => { if (!r.ok) throw new Error('weather'); return r.json() })
      .then((j: Weather) => setW(j))
      .catch((e) => { if ((e as Error).name !== 'AbortError') setErr(true) })
    return () => ctrl.abort()
  }, [])

  const day = (iso: string, i: number) => (i === 0 ? 'Today' : new Date(iso + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short' }))

  return (
    <section className="cpl-live-card" aria-label={`Weather in ${CHUKA.name}`}>
      <header><h2>Match-day weather</h2><span>{CHUKA.name}</span></header>
      {err && <p className="cpl-live-empty">Weather is unavailable right now.</p>}
      {!w && !err && <div className="cpl-live-skel" aria-hidden><i /><i /><i /></div>}
      {w && (() => {
        const now = wmo(w.current.weather_code)
        return (
          <>
            <div className="cpl-wx-now">
              <now.Icon size={44} aria-hidden />
              <div>
                <strong>{Math.round(w.current.temperature_2m)}°C</strong>
                <span>{now.label} · feels like {Math.round(w.current.apparent_temperature)}°</span>
              </div>
            </div>
            <div className="cpl-wx-meta">
              <span><Droplets size={14} aria-hidden /> {Math.round(w.current.relative_humidity_2m)}%</span>
              <span><Wind size={14} aria-hidden /> {Math.round(w.current.wind_speed_10m)} km/h</span>
            </div>
            <ul className="cpl-wx-days">
              {w.daily.time.map((t, i) => {
                const d = wmo(w.daily.weather_code[i])
                return (
                  <li key={t}>
                    <small>{day(t, i)}</small>
                    <d.Icon size={20} aria-label={d.label} />
                    <b>{Math.round(w.daily.temperature_2m_max[i])}°</b>
                    <small>{Math.round(w.daily.temperature_2m_min[i])}°</small>
                    <small className="rain">{w.daily.precipitation_probability_max[i] ?? 0}% rain</small>
                  </li>
                )
              })}
            </ul>
          </>
        )
      })()}
      <footer>Weather by Open-Meteo</footer>
    </section>
  )
}

/* ---------- EPL fixtures: Fantasy Premier League API, via the CPL backend ---------- */

type Team = { name: string; short: string; code: number }
type EplMatch = { id: number; gw: number | null; kickoff: string; home: Team; away: Team; hs: number | null; as: number | null; live: boolean }
type Epl = { gameweek: number | null; updated: string; upcoming: EplMatch[]; results: EplMatch[]; stale?: boolean }

const TZ = 'Africa/Nairobi'

function Badge({ t }: { t: Team }) {
  const [bad, setBad] = useState(false)
  if (bad || !t.code) return <span className="cpl-epl-fallback" aria-hidden>{t.short}</span>
  return <img src={`https://resources.premierleague.com/premierleague/badges/50/t${t.code}.png`} alt="" width={22} height={22} loading="lazy" onError={() => setBad(true)} />
}

function EplCard() {
  const [d, setD] = useState<Epl | null>(null)
  const [err, setErr] = useState('')
  const [tab, setTab] = useState<'next' | 'results'>('next')

  useEffect(() => {
    let live = true
    cpl<Epl>('eplFixtures').then((x) => live && setD(x)).catch((e) => live && setErr((e as Error).message))
    return () => { live = false }
  }, [])

  const list = d ? (tab === 'next' ? d.upcoming : d.results) : []
  const dayKey = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ })
  const dayLabel = (iso: string) => new Date(iso).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', timeZone: TZ })
  const time = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ })

  return (
    <section className="cpl-live-card" aria-label="Premier League fixtures">
      <header>
        <h2>Premier League{d?.gameweek ? ` · GW ${d.gameweek}` : ''}</h2>
        <div className="cpl-live-tabs" role="group" aria-label="Fixtures or results">
          <button type="button" className={tab === 'next' ? 'on' : ''} aria-pressed={tab === 'next'} onClick={() => setTab('next')}>Fixtures</button>
          <button type="button" className={tab === 'results' ? 'on' : ''} aria-pressed={tab === 'results'} onClick={() => setTab('results')}>Results</button>
        </div>
      </header>
      {err && <p className="cpl-live-empty">{err}</p>}
      {!d && !err && <div className="cpl-live-skel" aria-hidden><i /><i /><i /><i /></div>}
      {d && list.length === 0 && <p className="cpl-live-empty">{tab === 'next' ? 'No upcoming fixtures.' : 'No results yet.'}</p>}
      {d && list.length > 0 && (
        <ul className="cpl-epl-list">
          {list.map((m, i) => (
            <li key={m.id}>
              {(i === 0 || dayKey(list[i - 1].kickoff) !== dayKey(m.kickoff)) && <small className="cpl-epl-day">{dayLabel(m.kickoff)}</small>}
              <div className="cpl-epl-row">
                <span className="cpl-epl-team home"><b>{m.home.name}</b><Badge t={m.home} /></span>
                <span className={`cpl-epl-mid${m.live ? ' live' : ''}`}>
                  {tab === 'results' || m.live ? `${m.hs ?? 0} - ${m.as ?? 0}` : time(m.kickoff)}
                  {m.live && <em>LIVE</em>}
                </span>
                <span className="cpl-epl-team"><Badge t={m.away} /><b>{m.away.name}</b></span>
              </div>
            </li>
          ))}
        </ul>
      )}
      <footer>Kick-off times in EAT · Data from the Fantasy Premier League API{d?.stale ? ' (may be slightly out of date)' : ''}</footer>
    </section>
  )
}

/* ---------- Football news: GNews API, via the CPL backend ---------- */

type Article = { title: string; description: string; url: string; image: string; publishedAt: string; source: string }
type News = { updated: string; articles: Article[]; stale?: boolean }

function ago(iso: string) {
  const t = Date.parse(iso)
  if (isNaN(t)) return ''
  const m = Math.max(0, Math.round((Date.now() - t) / 60000))
  if (m < 60) return `${Math.max(m, 1)}m ago`
  if (m < 1440) return `${Math.round(m / 60)}h ago`
  return `${Math.round(m / 1440)}d ago`
}

function Thumb({ src }: { src: string }) {
  const [bad, setBad] = useState(false)
  if (!src || bad) return <span className="cpl-news-img ph" aria-hidden />
  return <img className="cpl-news-img" src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBad(true)} />
}

function NewsCard() {
  const [d, setD] = useState<News | null>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    let live = true
    cpl<News>('news').then((x) => live && setD(x)).catch((e) => live && setErr((e as Error).message))
    return () => { live = false }
  }, [])

  return (
    <section className="cpl-live-card cpl-news" aria-label="Football news">
      <header><h2>Football news</h2></header>
      {err && <p className="cpl-live-empty">{err}</p>}
      {!d && !err && <div className="cpl-live-skel" aria-hidden><i /><i /><i /></div>}
      {d && d.articles.length === 0 && <p className="cpl-live-empty">No news right now.</p>}
      {d && d.articles.length > 0 && (
        <ul className="cpl-news-list">
          {d.articles.map((a) => (
            <li key={a.url}>
              <a href={a.url} target="_blank" rel="noopener noreferrer">
                <Thumb src={a.image} />
                <span className="cpl-news-text">
                  <b>{a.title}</b>
                  <small>{[a.source, ago(a.publishedAt)].filter(Boolean).join(' · ')}</small>
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
      <footer>News from GNews{d?.stale ? ' (may be slightly out of date)' : ''}</footer>
    </section>
  )
}

export default function CplLive() {
  return (
    <div className="cpl-live">
      <EplCard />
      <WeatherCard />
      <NewsCard />
    </div>
  )
}

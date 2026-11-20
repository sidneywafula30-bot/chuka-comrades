import { useCallback, useEffect, useState } from 'react'
import { signInWithPopup, type User } from 'firebase/auth'
import { WhatsAppLogo } from '../components/BrandLogos'
import { ArrowLeft, Clapperboard, Flame, Megaphone, Newspaper, ShieldCheck, LifeBuoy, MessageCircle, Users } from 'lucide-react'
import { auth, googleProvider } from '../lib/firebase'
import { oz, ozReady, type Config, type Me } from '../lib/ozone'
import { ShareButton, type OzCtx } from './OzCommon'
import { Compose, Feed, Thread, OZONE_WA_GROUP } from './OzConfessions'
import { AspirantPage, Elections, Faculties, FacultyPage, IssueDetail, Issues, Polls, Promises, ReportIssue } from './OzSauti'
import Hookup from './OzHookup'
import Trends from './OzTrends'
import News from './OzNews'
import Admin from './OzAdmin'
import { AdminCard, TrendingNow } from './OzHomeExtras'
import { ADMIN_NAME, AdminAvatar, adminWaUrl } from '../components/AdminChat'
import './Cpl.css'
import './Efootball.css'
import './Ozone.css'

const SAUTI = ['sauti', 'issue', 'report', 'faculties', 'faculty', 'polls', 'poll', 'promises', 'aspirants', 'aspirant']

export default function Ozone({ user, route }: { user: User | null; route: string }) {
  const [cfg, setCfg] = useState<Config | null>(null)
  const [cfgErr, setCfgErr] = useState('')
  const [me, setMe] = useState<Me | null>(null)
  const [busy, setBusy] = useState(false)
  const parts = route.split('/')
  const page = parts[2] || ''
  const arg = parts[3] || ''

  const loadCfg = useCallback(async () => {
    if (!ozReady) return
    try { setCfg(await oz<Config>('config')); setCfgErr('') } catch (e) { setCfgErr((e as Error).message) }
  }, [])
  useEffect(() => { void loadCfg() }, [loadCfg])

  const reload = useCallback(async () => {
    if (!user || !ozReady) { setMe(null); return }
    try { setMe(await oz<Me>('me')) } catch { setMe({ signedIn: false }) }
  }, [user])
  useEffect(() => { void reload() }, [reload])

  async function signIn() {
    if (!auth) return
    setBusy(true)
    try { await signInWithPopup(auth, googleProvider) } catch { /* popup closed */ } finally { setBusy(false) }
  }
  const ctx: OzCtx = { user, me, cfg, busy, signIn, reload }

  let body
  if (!ozReady) body = <p className="cpl-empty">The O-Zone server is not connected yet. Add <code>VITE_OZONE_API_URL</code> to <code>.env</code> and restart.</p>
  else if (cfgErr) body = <p className="cpl-err" role="alert">{cfgErr} <button type="button" className="cpl-link" onClick={() => void loadCfg()}>Try again</button></p>
  else if (!cfg) body = <p className="cpl-empty">Loading…</p>
  else if (page === 'confessions') body = <Feed ctx={ctx} />
  else if (page === 'thread') body = <Thread ctx={ctx} number={arg} />
  else if (page === 'confess') body = <Compose ctx={ctx} replyTo={arg} />
  else if (page === 'sauti') body = <Issues ctx={ctx} />
  else if (page === 'issue') body = <IssueDetail ctx={ctx} id={arg} />
  else if (page === 'report') body = <ReportIssue ctx={ctx} aspirantId={arg} />
  else if (page === 'faculties') body = <Faculties />
  else if (page === 'faculty') body = <FacultyPage code={arg.toUpperCase()} ctx={ctx} />
  else if (page === 'polls') body = <Polls ctx={ctx} />
  else if (page === 'poll') body = <Polls ctx={ctx} only={arg} />
  else if (page === 'aspirant') body = <AspirantPage id={arg} ctx={ctx} />
  else if (page === 'promises') body = <Promises />
  else if (page === 'aspirants') body = <Elections ctx={ctx} />
  else if (page === 'hookup') body = <Hookup ctx={ctx} />
  else if (page === 'trends') body = <Trends ctx={ctx} />
  else if (page === 'news') body = <News ctx={ctx} />
  else if (page === 'admin') {
    body = !user ? <div className="cpl-home"><p className="cpl-empty">Sign in with Google to continue.</p><button type="button" className="lp-btn" onClick={signIn}>Sign in</button></div>
      : !me ? <p className="cpl-empty">Checking access…</p>
      : me.isAdmin ? <Admin /> : <p className="cpl-empty">This area is for O-Zone admins only.</p>
  } else body = <Home ctx={ctx} />

  const back = page ? (SAUTI.includes(page) && page !== 'sauti' ? '#/ozone/sauti' : '#/ozone') : '#services'
  return (
    <div className="cpl oz">
      <header className="cpl-top">
        <a className="cpl-back" href={back}><ArrowLeft size={16} /> {page ? 'O-Zone home' : 'Student services'}</a>
        <img src={`${import.meta.env.BASE_URL}chukalogo.png`} alt="" height={34} />
      </header>
      <main className={`cpl-main${['confessions', 'confess', 'thread'].includes(page) ? ' oz-bleed' : ''}`}>{body}</main>
      <a className="oz-fab" href={adminWaUrl()} target="_blank" rel="noopener noreferrer" aria-label={`Chat with ${ADMIN_NAME}, the O-Zone admin, on WhatsApp`}>
        <AdminAvatar className="oz-fab-ph" /><span>Chat {ADMIN_NAME}</span><WhatsAppLogo size={20} className="oz-fab-wa" />
      </a>
    </div>
  )
}

function Home({ ctx }: { ctx: OzCtx }) {
  const { me, user, cfg } = ctx
  const waUrl = cfg?.whatsappGroupUrl || (import.meta.env.VITE_OZONE_WA_GROUP_URL as string | undefined) || OZONE_WA_GROUP
  return (
    <div className="cpl-home oz-home">
      <div className="ef-mark oz-mark"><img src={`${import.meta.env.BASE_URL}ozone.jfif`} alt="Chuka O-Zone logo" /></div>
      <h1>Chuka O-Zone</h1>
      <p>Say it anonymously, speak up for your faculty, and meet people on campus.</p>

      <AdminCard />

      <div className="oz-quick">
        <a href="#/ozone/confess">➕ Confess</a>
        <a href="#/ozone/report">📢 Report issue</a>
        <a href="#/ozone/polls">🗳️ Polls</a>
        <a href="#/ozone/aspirants">🏛️ Elections</a>
        <a className="oz-quick-wa" href={adminWaUrl()} target="_blank" rel="noopener noreferrer"><AdminAvatar className="oz-quick-ph" /> Chat {ADMIN_NAME}</a>
      </div>

      <div className="oz-live"><span className="oz-live-dot" /> O-Zone community is live <span className="oz-live-note">Anonymous · moderated · campus-focused</span></div>

      {waUrl && (
        <a className="oz-wa" href={waUrl} target="_blank" rel="noopener noreferrer">
          <span className="oz-wa-ic"><MessageCircle size={26} /></span>
          <span className="oz-wa-t"><strong>Join the Chuka O-Zone WhatsApp group</strong><small><Users size={13} /> Campus updates, trends and announcements. Tap to join.</small></span>
          <span className="oz-wa-go">Join</span>
        </a>
      )}

      <TrendingNow ctx={ctx} />

      <div className="oz-tiles">
        <a className="oz-tile oz-feature" href="#/ozone/confessions">
          <span className="oz-ic a"><Flame size={24} /></span>
          <strong>Confessions</strong>
          <small>Anonymous posts, replies and sharing. Read what comrades are saying.</small>
        </a>
        <a className="oz-tile oz-feature" href="#/ozone/sauti">
          <span className="oz-ic b"><Megaphone size={24} /></span>
          <strong>Sauti ya Comrades</strong>
          <small>Report campus problems and follow the journey from review to response.</small>
        </a>
        <a className="oz-tile oz-feature" href="#/ozone/trends">
          <span className="oz-ic d"><Clapperboard size={24} /></span>
          <strong>Chuka Trends</strong>
          <small>Videos and live streams from campus. Scroll and watch.</small>
        </a>
        <a className="oz-tile" href="#/ozone/news">
          <span className="oz-ic e"><Newspaper size={24} /></span>
          <strong>News</strong>
          <small>Latest headlines and politics from Kenyan news sites.</small>
        </a>
        <a className="oz-tile" href="#/ozone/hookup">
          <span className="oz-ic c">❤</span>
          <strong>Hookup <em>18+</em></strong>
          <small>Hidden profiles. The admin connects you only when both say yes.</small>
        </a>
      </div>



      <AdminCard />

      <nav className="cpl-links" aria-label="O-Zone links">
        <a className="cpl-link" href="#/ozone/news">News</a>
        <a className="cpl-link" href="#/ozone/confess">Confess now</a>
        <a className="cpl-link" href="#/ozone/report">Report an issue</a>
        <a className="cpl-link" href="#/ozone/faculties">Faculty scoreboard</a>
        <a className="cpl-link" href="#/ozone/polls">Polls</a>
        <a className="cpl-link" href="#/ozone/aspirants">Elections</a>
        <a className="cpl-link" href="#/ozone/promises">Promise tracker</a>
        {me?.isAdmin && <a className="cpl-link" href="#/ozone/admin"><ShieldCheck size={16} /> Admin desk</a>}
      </nav>

      <div className="oz-sharebar"><ShareButton text="Chuka O-Zone: anonymous confessions, student issues, campus videos and more." path="" label="Share O-Zone" /></div>

      {cfg && (
        <div className="oz-support oz-home-support">
          <LifeBuoy size={18} />
          <div><strong>{cfg.support.message}</strong><ul>{cfg.support.lines.map((l) => <li key={l}>{l}</li>)}</ul></div>
        </div>
      )}
      {!user && <p className="cpl-note">Sign in with Google (top of the home page) to post, vote and report. Reading is open to everyone.</p>}
    </div>
  )
}

import { useState } from 'react'
import { signInWithPopup, signOut, type User } from 'firebase/auth'
import {
  BookOpen, Building2, ChevronRight, Clapperboard, ExternalLink, Gamepad2, GraduationCap, Download, Mail, MapPin, MessageCircle, Monitor, Phone, ShieldAlert, ShoppingBag, Stethoscope, Trophy, Vote, Wallet,
} from 'lucide-react'
import { auth, firebaseReady, googleProvider } from '../lib/firebase'
import { markSignedOut } from '../lib/session'
import { GoogleMapsLogo, YouTubeLogo } from '../components/BrandLogos'
import Avatar from '../components/Avatar'
import GoogleSignInButton from '../components/GoogleSignInButton'
import WhatsAppGroups from '../components/WhatsAppGroups'
import ExamCountdown from '../components/ExamCountdown'
import { shareToWhatsApp, useInstall } from '../lib/install'
import { WhatsAppLogo } from '../components/BrandLogos'
import './Landing.css'

const BASE = import.meta.env.BASE_URL
const YOUTUBE_URL =
  (import.meta.env.VITE_YOUTUBE_CHANNEL_URL as string) ||
  'https://www.youtube.com/results?search_query=Chuka+University'
const MAPS_URL =
  (import.meta.env.VITE_MAPS_URL as string) ||
  'https://www.google.com/maps/search/?api=1&query=Chuka+University'

const OFFICIAL_URL = 'https://www.chuka.ac.ke/'

const FACTS = [
  { value: '9th', label: 'Public university in Kenya' },
  { value: '2013', label: 'Chartered' },
  { value: 'Mt. Kenya', label: 'Eastern slopes, Chuka' },
]

const ADMIN_WHATSAPP =
  (import.meta.env.VITE_ADMIN_WHATSAPP as string) || '254184198432'
const WHATSAPP_URL = `https://wa.me/${ADMIN_WHATSAPP}?text=${encodeURIComponent('Hello Chuka Comrades admin,')}`

/** Services that are open now -> where their card goes. */
/** Official Chuka University student portal (login) and e-learning (Moodle) links. */
const PORTAL_URL = 'https://portal.chuka.ac.ke/'
const LMS_URL = 'https://lms.chuka.ac.ke/'

const LIVE_LINKS: Record<string, string> = {
  'Chuka Premier League': '#/cpl',
  'Hostels & Roommates': '#/hostel',
  'Chuka Music & Movies': '#/music',
  'Chuka eFootball': '#/efootball',
  'Chuka O Zone': '#/ozone',
  'Cyber Services': '#/cyber',
  'Chuka Soko': '#/soko',
  'Study Labs': '#/labs',
  'Chuka Earning & Gigs': '#/gigs',
  'Chuka Skills': '#/skills',
  'The Long Campus Journey': '#/journey',
}

const POBOX = 'P.O. Box 109 – 60400 Chuka, Kenya'

type Line = { label: string; href: string }
const OFFICES: { title: string; phones: Line[]; email: string }[] = [
  {
    title: 'Customer Care Desk',
    phones: [
      { label: '020 231 0512', href: 'tel:+254202310512' },
      { label: '020 231 0518', href: 'tel:+254202310518' },
    ],
    email: 'info@chuka.ac.ke',
  },
  {
    title: 'Admissions Office',
    phones: [
      { label: '020 232 9073', href: 'tel:+254202329073' },
      { label: '0771 094 000', href: 'tel:+254771094000' },
    ],
    email: 'raca@chuka.ac.ke',
  },
  { title: 'Procurement Department', phones: [], email: 'procurementdept@chuka.ac.ke' },
]

const SERVICES = [
  { title: 'Hostels & Roommates', text: 'Hostels with live room availability, plus a roommate finder.', icon: Building2 },
  { title: 'Study Labs', text: 'Notes, past papers and study partners.', icon: BookOpen },
  { title: 'Chuka O Zone', text: 'Anonymous confessions, student issues (Sauti ya Comrades) and hookup.', icon: MessageCircle },
  { title: 'Chuka Premier League', text: 'Fixtures, results and campus football.', icon: Trophy },
  { title: 'Chuka eFootball', text: 'Find players, organise matches and tournaments.', icon: Gamepad2 },
  { title: 'Chuka Soko', text: 'Buy and sell within the campus marketplace.', icon: ShoppingBag },
  { title: 'Chuka Music & Movies', text: 'Tracks, films and entertainment for comrades.', icon: Clapperboard },
  { title: 'Chuka Earning & Gigs', text: 'Side hustles, gigs and ways to earn on campus.', icon: Wallet },
  { title: 'The Long Campus Journey', text: 'Your graduation memory page and QR code. Class of 2026.', icon: GraduationCap },
  { title: 'Chuka Skills', text: 'Learn a skill, join a class or teach what you know.', icon: GraduationCap },
  { title: 'Cyber Services', text: 'Printing, typing, internet and online application help.', icon: Monitor },
]

export default function Landing({ user }: { user: User | null }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const { installed, canInstall, install } = useInstall()

  async function handleSignIn() {
    if (!auth) {
      setError('Sign-in is not set up yet. Add your Firebase keys to .env and restart.')
      return
    }
    setBusy(true); setError('')
    try { await signInWithPopup(auth, googleProvider); window.location.hash = '#services' }
    catch { setError('Could not sign in. Please try again.') }
    finally { setBusy(false) }
  }

  async function handleSignOut() {
    if (!auth) return
    setBusy(true)
    try { markSignedOut(); await signOut(auth) } finally { setBusy(false) }
  }

  const firstName = user?.displayName?.split(' ')[0]

  return (
    <div className="landing">
      <ExamCountdown />
      <header className="lp-header">
        <a className="lp-brand" href="#home" aria-label="Chuka Comrades home">
          <span className="lp-brand-crest"><img src={`${BASE}chukalogo.png`} alt="Chuka University crest" /></span>
          <span className="lp-brand-copy">
            <strong>Chuka Comrades</strong>
            <small>Your campus. Your community.</small>
          </span>
        </a>
        <nav className="lp-nav" aria-label="Main navigation">
          <a href="#home">Home</a>
          <a href="#services">Student services</a>
          <a href="#community">WhatsApp groups</a>
          <a href={PORTAL_URL} target="_blank" rel="noopener noreferrer">Student portal</a>
          <a href="#find-us">Find us</a>
          <a href="#contact">Contact</a>
        </nav>
        {user ? (
          <div className="lp-user-menu">
            <Avatar src={user.photoURL} name={user.displayName} email={user.email} size={40} />
            <button className="lp-btn lp-btn-soft" onClick={handleSignOut} disabled={busy}>Sign out</button>
          </div>
        ) : (
          <GoogleSignInButton onClick={handleSignIn} disabled={busy} />
        )}
      </header>

      <main>
        <section className="lp-hero" id="home">
          <div className="lp-hero-copy">
            <span className="lp-kicker"><span className="lp-dot" /> MADE FOR THE CHUKA CAMPUS COMMUNITY</span>
            <h1>{firstName ? `Welcome back, ${firstName}.` : 'Your campus. Your community.'}</h1>
            <p>Find your people, follow campus life and get to the student resources you need — all in one place.</p>

            {user && (
              <div className="lp-welcome-card">
                <Avatar src={user.photoURL} name={user.displayName} email={user.email} size={56} />
                <span>
                  <strong>{user.displayName || 'Chuka Comrades member'}</strong>
                  <small>{user.email}</small>
                </span>
              </div>
            )}

            <div className="lp-actions">
              {!installed && (
                <button className="lp-btn lp-btn-soft" onClick={() => (canInstall ? void install() : alert('To install: open your browser menu (⋮ or the Share icon on iPhone) and choose "Install app" or "Add to Home Screen".'))}>
                  <Download size={16} /> Install app
                </button>
              )}
              <button className="lp-btn lp-btn-soft" onClick={shareToWhatsApp}>
                <WhatsAppLogo size={16} /> Share on WhatsApp
              </button>
              {user ? (
                <a className="lp-btn" href="#services">Explore services <ChevronRight size={16} /></a>
              ) : (
                <GoogleSignInButton onClick={handleSignIn} disabled={busy} label="Continue with Google" />
              )}
              <a className="lp-btn lp-btn-outline" href={PORTAL_URL} target="_blank" rel="noopener noreferrer">
                <GraduationCap size={16} /> Student portal login
              </a>
              <a className="lp-btn lp-btn-outline" href={LMS_URL} target="_blank" rel="noopener noreferrer">
                E-learning (LMS)
              </a>
            </div>
            {error && <p className="lp-error" role="alert">{error}</p>}
            {!firebaseReady && !error && (
              <p className="lp-hint">Dev note: Firebase keys not set — sign-in is disabled.</p>
            )}
          </div>

          <div className="lp-hero-visual">
            <div className="lp-glow" aria-hidden="true" />
            <div className="lp-logo-ring">
              <img src={`${BASE}chukalogo.png`} alt="Chuka University crest" />
            </div>
            <a className="lp-official" href={OFFICIAL_URL} target="_blank" rel="noopener noreferrer">
              <span>Chuka official website</span>
              <ExternalLink size={16} />
            </a>
            <small className="lp-official-note">chuka.ac.ke</small>
          </div>
        </section>

        <section className="lp-facts" aria-label="About Chuka University">
          {FACTS.map((f) => (
            <div className="lp-fact" key={f.label}>
              <strong>{f.value}</strong>
              <span>{f.label}</span>
            </div>
          ))}
        </section>

        <section className="lp-aspirant-wrap" aria-label="Chuka University elections">
          <div className="lp-aspirant-banner">
            <span className="lp-aspirant-icon"><Vote size={27} /></span>
            <div className="lp-aspirant-copy">
              <span className="lp-aspirant-kicker">CHUKA UNIVERSITY ELECTIONS</span>
              <h2>Planning to lead? Let comrades know.</h2>
              <p>Create your aspirant profile, share your manifesto and give students a place to ask you questions.</p>
            </div>
            <a className="lp-aspirant-cta" href="#/ozone/aspirants/apply">I am an aspirant <ChevronRight size={17} /></a>
          </div>
        </section>

        <section className="lp-section" id="services">
          <span className="lp-kicker">STUDENT SERVICES</span>
          <h2>Everything campus, in one app</h2>
          <div className="lp-grid">
            {SERVICES.map(({ title, text, icon: Icon }) => {
              const href = LIVE_LINKS[title]
              const live = Boolean(href)
              const body = (
                <>
                  {title === 'Chuka Premier League'
                    ? (
                      <span className="lp-card-icon has-logo">
                        <img
                          src={`${BASE}cpl%20logo.jfif`}
                          alt="Chuka Premier League logo"
                          onError={(e) => { const i = e.currentTarget; if (!i.src.endsWith('cpl-logo.svg')) i.src = `${BASE}cpl-logo.svg` }}
                        />
                      </span>
                    )
                    : title === 'Chuka eFootball'
                    ? (
                      <span className="lp-card-icon has-logo">
                        <img
                          src={`${BASE}efootball.png`}
                          alt="Chuka eFootball logo"
                          onError={(e) => { const i = e.currentTarget; if (!i.src.endsWith('efootball-logo.svg')) i.src = `${BASE}efootball-logo.svg` }}
                        />
                      </span>
                    )
                    : title === 'Chuka O Zone'
                    ? (
                      <span className="lp-card-icon has-logo">
                        <img src={`${BASE}ozone-logo.svg`} alt="Chuka O-Zone logo" />
                      </span>
                    )
                    : title === 'Hostels & Roommates'
                    ? (
                      <span className="lp-card-icon has-logo">
                        <img src={`${BASE}hostel-logo.png`} alt="Chuka House Connect logo" />
                      </span>
                    )
                    : title === 'Chuka Music & Movies'
                    ? (
                      <span className="lp-card-icon has-logo">
                        <img src={`${BASE}music-movies-logo.svg`} alt="Chuka Music & Movies logo" />
                      </span>
                    )
                    : title === 'Cyber Services'
                    ? (
                      <span className="lp-card-icon has-logo">
                        <img src={`${BASE}cyber-logo.svg`} alt="Chuka Cyber logo" />
                      </span>
                    )
                    : title === 'Chuka Soko'
                    ? (
                      <span className="lp-card-icon has-logo">
                        <img src={`${BASE}soko-logo.svg`} alt="Chuka Soko logo" />
                      </span>
                    )
                    : title === 'Study Labs'
                    ? (
                      <span className="lp-card-icon has-logo">
                        <img src={`${BASE}study-labs-logo.svg`} alt="Chuka Study Labs logo" />
                      </span>
                    )
                    : title === 'Chuka Earning & Gigs'
                    ? (
                      <span className="lp-card-icon has-logo">
                        <img src={`${BASE}gigs-logo.svg`} alt="Chuka Earning & Gigs logo" />
                      </span>
                    )
                    : title === 'The Long Campus Journey'
                    ? (
                      <span className="lp-card-icon has-logo">
                        <img src={`${BASE}journey-logo.svg`} alt="The Long Campus Journey logo" />
                      </span>
                    )
                    : title === 'Chuka Skills'
                    ? (
                      <span className="lp-card-icon has-logo">
                        <img src={`${BASE}skills-logo.svg`} alt="Chuka Skills logo" />
                      </span>
                    )
                    : <span className="lp-card-icon"><Icon size={22} /></span>}
                  <h3>{title}</h3>
                  <p>{text}</p>
                  <span className={live ? 'lp-soon lp-live' : 'lp-soon'}>{live ? 'Open' : 'Coming soon'}</span>
                </>
              )
              return live
                ? <a className="lp-card lp-card-link" key={title} href={href}>{body}</a>
                : <article className="lp-card" key={title}>{body}</article>
            })}
          </div>
        </section>

        <WhatsAppGroups user={user} />

        <section className="lp-section" id="find-us">
          <span className="lp-kicker">FIND US</span>
          <h2>Watch and visit</h2>
          <div className="lp-find">
            <a className="lp-find-card" href={YOUTUBE_URL} target="_blank" rel="noopener noreferrer">
              <YouTubeLogo size={40} />
              <span><strong>Watch on YouTube</strong><small>Campus videos and updates</small></span>
              <ChevronRight size={18} />
            </a>
            <a className="lp-find-card" href={MAPS_URL} target="_blank" rel="noopener noreferrer">
              <GoogleMapsLogo size={44} />
              <span><strong>Open in Google Maps</strong><small><MapPin size={12} /> Chuka University</small></span>
              <ChevronRight size={18} />
            </a>
          </div>
        </section>
        <section className="lp-section" id="contact">
          <span className="lp-kicker">CONTACT</span>
          <h2>Get in touch</h2>

          <a className="lp-wa" href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
            <span className="lp-wa-icon"><MessageCircle size={26} /></span>
            <span className="lp-wa-copy">
              <strong>Chat with Chuka Comrades admin</strong>
              <small>WhatsApp · +{ADMIN_WHATSAPP}</small>
            </span>
            <ChevronRight size={20} />
          </a>

          <div className="lp-contacts">
            {OFFICES.map((o) => (
              <article className="lp-contact" key={o.title}>
                <h3>{o.title}</h3>
                <p className="lp-addr"><MapPin size={15} /> {POBOX}</p>
                {o.phones.length > 0 && (
                  <p className="lp-line">
                    <Phone size={15} />
                    <span>
                      {o.phones.map((ph, i) => (
                        <span key={ph.href}>
                          {i > 0 && ' / '}
                          <a href={ph.href}>{ph.label}</a>
                        </span>
                      ))}
                    </span>
                  </p>
                )}
                <p className="lp-line"><Mail size={15} /> <a href={`mailto:${o.email}`}>{o.email}</a></p>
              </article>
            ))}

            <article className="lp-contact lp-hotline">
              <h3>Hotline</h3>
              <p className="lp-line">
                <ShieldAlert size={15} />
                <span>Security / Fire Services: <a href="tel:0800230008">0800 230008</a></span>
              </p>
              <p className="lp-line">
                <Stethoscope size={15} />
                <span>Medical Services / Ambulance: <a href="tel:0800230009">0800 230009</a></span>
              </p>
            </article>
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <img src={`${BASE}chukalogo.png`} alt="Chuka University crest" />
        <span>© {new Date().getFullYear()} Chuka Comrades. Built for the campus community.</span>
      </footer>
    </div>
  )
}





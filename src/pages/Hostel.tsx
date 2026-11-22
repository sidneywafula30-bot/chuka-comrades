import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { signInWithPopup, signOut, type User } from 'firebase/auth'
import type { LucideIcon } from 'lucide-react'
import {
  ArrowLeft, BadgeCheck, BedDouble, Building2, ChevronLeft, ChevronRight, Clock, DoorOpen, Droplets,
  ExternalLink, Footprints, MapPin, Phone, RefreshCw, Search, ShieldCheck, Sofa, Table2, Wifi, X, Zap,
} from 'lucide-react'
import { markSignedOut } from '../lib/session'
import { auth, googleProvider } from '../lib/firebase'
import {
  ADMIN_WHATSAPP, DEFAULT_SETTINGS, STUDENT_GROUP_URL, cleanProvided, hostelApi, hostelReady, isFull, isStale, kes, niceDateTime,
  providedLabel, roomTotals, showPhone, timeAgo, waLink, type Hostel as HostelT, type HostelImage, type Settings,
} from '../lib/hostel'
import { GoogleMapsLogo, WhatsAppLogo } from '../components/BrandLogos'
import Avatar from '../components/Avatar'
import GoogleSignInButton from '../components/GoogleSignInButton'
import PayCard from '../components/PayCard'
import HostelAdminFab, { HostelAdminLogo } from '../components/HostelAdminChat'
import SemesterCalendar from '../components/SemesterCalendar'
import HostelAdmin from './HostelAdmin'
import Roommates from './Roommates'
import RoommateAdmin from './RoommateAdmin'
import { roommateApi, roommateReady } from '../lib/roommate'
import './Hostel.css'

const BASE = import.meta.env.BASE_URL

const ICONS: Record<string, LucideIcon> = {
  water: Droplets, electricity: Zap, wifi: Wifi, security: ShieldCheck, bed: BedDouble, chair: Sofa, table: Table2,
}
const FILTER_FEATURES = ['wifi', 'security', 'water', 'bed']

type Tab = 'browse' | 'roommates' | 'landlords' | 'admin' | 'roommate-admin'
type Lightbox = { images: HostelImage[]; index: number } | null

export default function Hostel({ user }: { user: User | null }) {
  const [tab, setTab] = useState<Tab>('browse')
  const [hostels, setHostels] = useState<HostelT[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [rmAdmin, setRmAdmin] = useState(false)
  const [authBusy, setAuthBusy] = useState(false)
  const [lightbox, setLightbox] = useState<Lightbox>(null)
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [locked, setLocked] = useState(true)
  const [lockedCount, setLockedCount] = useState(0)
  const [accessUntil, setAccessUntil] = useState('')

  const [search, setSearch] = useState('')
  const [area, setArea] = useState('')
  const [roomType, setRoomType] = useState('')
  const [onlyAvailable, setOnlyAvailable] = useState(false)
  const [features, setFeatures] = useState<string[]>([])

  const refresh = useCallback(async () => {
    if (!hostelReady) { setLoading(false); return }
    setLoading(true); setError('')
    try {
      const r = await hostelApi.list()
      setHostels(r.hostels); setLocked(r.locked); setLockedCount(r.lockedCount); setAccessUntil(r.accessUntil); setSettings(r.settings)
    }
    catch (e) { setError((e as Error).message) }
    finally { setLoading(false) }
  }, [])
  // Reload when the student signs in or out: what the server sends depends on who is asking.
  const uid = user?.uid ?? ''
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void refresh() }, [refresh, uid])

  // Ask the server whether this signed-in email is the hostel admin.
  useEffect(() => {
    if (!user || !hostelReady) { setIsAdmin(false); return }
    let live = true
    hostelApi.adminCheck().then((r) => { if (live) setIsAdmin(r.isAdmin) }).catch(() => { if (live) setIsAdmin(false) })
    return () => { live = false }
  }, [user])

  // Roommate moderation is decided by the database (verified admin email), separately from the hostel script.
  useEffect(() => {
    if (!user || !roommateReady) { setRmAdmin(false); return }
    let live = true
    roommateApi.isAdmin().then((v) => { if (live) setRmAdmin(v) }).catch(() => { if (live) setRmAdmin(false) })
    return () => { live = false }
  }, [user])

  const activeTab: Tab = (tab === 'admin' && !isAdmin) || (tab === 'roommate-admin' && !rmAdmin) ? 'browse' : tab

  async function handleSignIn() {
    if (!auth) { setError('Sign-in is not set up yet. Add your Firebase keys to .env and restart.'); return }
    setAuthBusy(true)
    try { await signInWithPopup(auth, googleProvider) } catch { setError('Could not sign in. Please try again.') }
    finally { setAuthBusy(false) }
  }
  async function handleSignOut() {
    if (!auth) return
    setAuthBusy(true)
    try { markSignedOut(); await signOut(auth); setTab('browse') } finally { setAuthBusy(false) }
  }

  const areas = useMemo(() => Array.from(new Set(hostels.map((h) => h.area).filter(Boolean))).sort(), [hostels])
  const roomTypeNames = useMemo(() => Array.from(new Set(hostels.flatMap((h) => h.roomTypes.map((r) => r.type)))).sort(), [hostels])

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase()
    return hostels
      .filter((h) => {
        if (q && ![h.name, h.area, h.landmark, ...h.roomTypes.map((r) => r.type)].join(' ').toLowerCase().includes(q)) return false
        if (area && h.area !== area) return false
        const rooms = roomType ? h.roomTypes.filter((r) => r.type === roomType) : h.roomTypes
        if (roomType && rooms.length === 0) return false
        if (onlyAvailable && !rooms.some((r) => r.available > 0)) return false
        const have = cleanProvided(h.provided).map(([k]) => k)
        return features.every((f) => have.includes(f))
      })
      .sort((a, b) => Number(isFull(a)) - Number(isFull(b)) || Number(b.verified) - Number(a.verified))
  }, [hostels, search, area, roomType, onlyAvailable, features])

  const toggleFeature = (f: string) => setFeatures((cur) => (cur.includes(f) ? cur.filter((x) => x !== f) : [...cur, f]))

  return (
    <div className="hs">
      <header className="hs-top">
        <a className="hs-back" href="#services"><ArrowLeft size={16} /> Student services</a>
        <a className="hs-brand" href="#home" aria-label="Chuka Comrades home">
          <img src={`${BASE}chukalogo.png`} alt="" /><strong>Chuka Comrades</strong>
        </a>
        {user ? (
          <div className="hs-user">
            <Avatar src={user.photoURL} name={user.displayName} email={user.email} size={34} />
            <button className="hs-btn hs-btn-soft" onClick={handleSignOut} disabled={authBusy}>Sign out</button>
          </div>
        ) : (
          <GoogleSignInButton onClick={handleSignIn} disabled={authBusy} label="Sign in" />
        )}
      </header>

      <main className="hs-main">
        <SemesterCalendar settings={settings} />

        <section className="hs-hero" style={{ '--hostel-bg': `url(${BASE}hostel-bg.jpeg)` } as CSSProperties}>
          <span className="hs-kicker">CHUKA COMRADES ACCOMMODATION</span>
          <h1>Find a hostel. Find your space.</h1>
          <p>Browse student accommodation around Chuka with live room availability, see exactly what each hostel provides, and reach the landlord or our admin on WhatsApp.</p>
          <div className="hs-hero-actions">
            <button className="hs-btn hs-btn-white" onClick={() => setTab('browse')}>Browse hostels <ChevronRight size={16} /></button>
            <button className="hs-btn hs-btn-glass" onClick={() => setTab('landlords')}>List your hostel <Building2 size={16} /></button>
          </div>
        </section>

        <div className="hs-groups">
          <a href={STUDENT_GROUP_URL} target="_blank" rel="noopener noreferrer">
            <HostelAdminLogo className="hs-group-ph" />
            <span><strong>Students: Hostels &amp; Reviews</strong><small>Ask questions and share hostel experiences.</small></span>
            <ExternalLink size={16} />
          </a>
        </div>

        <nav className="hs-tabs" aria-label="Hostel sections">
          <button className={activeTab === 'browse' ? 'active' : ''} onClick={() => setTab('browse')}>Hostel directory</button>
          <button className={activeTab === 'roommates' ? 'active' : ''} onClick={() => setTab('roommates')}>Roommates</button>
          <button className={activeTab === 'landlords' ? 'active' : ''} onClick={() => setTab('landlords')}>For landlords</button>
          {rmAdmin && <button className={activeTab === 'roommate-admin' ? 'active' : ''} onClick={() => setTab('roommate-admin')}>Roommate requests</button>}
          {isAdmin && <button className={activeTab === 'admin' ? 'active' : ''} onClick={() => setTab('admin')}>Admin desk</button>}
          <button className="hs-refresh" onClick={() => void refresh()} disabled={loading}><RefreshCw size={15} className={loading ? 'hs-spin' : ''} /> Refresh</button>
        </nav>

        {!hostelReady && <p className="hs-note">Dev note: <code>VITE_HOSTEL_API_URL</code> is not set, so hostels cannot load yet.</p>}
        {error && <p className="hs-error" role="alert">{error}</p>}

        {activeTab === 'browse' && (
          <>
            {!locked && accessUntil && <p className="hs-access-ok"><BadgeCheck size={15} /> Full access active until {niceDateTime(accessUntil)}.</p>}
            {isAdmin && locked === false && <p className="hs-access-ok"><BadgeCheck size={15} /> Admin view: you see every published hostel.</p>}
            {!locked && <div className="hs-filters">
              <label className="hs-search"><Search size={16} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search hostel, area, landmark or room type…" aria-label="Search hostels" /></label>
              <select value={area} onChange={(e) => setArea(e.target.value)} aria-label="Filter by area"><option value="">All areas</option>{areas.map((a) => <option key={a}>{a}</option>)}</select>
              <select value={roomType} onChange={(e) => setRoomType(e.target.value)} aria-label="Filter by room type"><option value="">All room types</option>{roomTypeNames.map((t) => <option key={t}>{t}</option>)}</select>
            </div>}
            {!locked && <div className="hs-chips" role="group" aria-label="Quick filters">
              <button className={onlyAvailable ? 'on' : ''} onClick={() => setOnlyAvailable(!onlyAvailable)}>Rooms available</button>
              {FILTER_FEATURES.map((f) => (
                <button key={f} className={features.includes(f) ? 'on' : ''} onClick={() => toggleFeature(f)}>{providedLabel(f)}</button>
              ))}
            </div>}

            {loading && hostels.length === 0 ? <p className="hs-empty">Loading hostels…</p>
              : shown.length === 0 ? <p className="hs-empty">{hostels.length === 0 ? 'No hostels have been listed yet. Check back soon.' : 'No hostels match these filters.'}</p>
              : (
                <div className="hs-grid">
                  {shown.map((h) => <HostelCard key={h.id} h={h} onOpen={(images, index) => setLightbox({ images, index })} />)}
                </div>
              )}

            {locked && !loading && (
              <PayCard
                kind="hostels" user={user} settings={settings} onSignIn={handleSignIn} authBusy={authBusy}
                onRefresh={() => void refresh()} refreshing={loading}
                headline={lockedCount > 0 ? `${lockedCount} more hostel${lockedCount === 1 ? '' : 's'} to browse` : 'Unlock every hostel'}
                detail="You are viewing one free preview hostel. Pay once to see every hostel, with live room counts, prices and landlord contacts, for the whole semester."
              />
            )}

            <aside className="hs-soon"><Footprints size={18} /> <span><strong>Need a roommate?</strong> Match with students of the same gender by budget and lifestyle.</span><button className="hs-btn hs-btn-green" onClick={() => setTab('roommates')}>Find a roommate</button></aside>
          </>
        )}

        {activeTab === 'roommates' && <Roommates user={user} settings={settings} onSignIn={handleSignIn} authBusy={authBusy} />}
        {activeTab === 'roommate-admin' && <RoommateAdmin settings={settings} />}
        {activeTab === 'landlords' && <LandlordsTab />}
        {activeTab === 'admin' && <HostelAdmin settings={settings} onSettings={setSettings} onChanged={() => void refresh()} />}
      </main>

      {lightbox && <PhotoViewer box={lightbox} onChange={setLightbox} />}
      <HostelAdminFab />
    </div>
  )
}

function HostelCard({ h, onOpen }: { h: HostelT; onOpen: (images: HostelImage[], index: number) => void }) {
  const [shot, setShot] = useState(0)
  const [showAll, setShowAll] = useState(false)
  const full = isFull(h)
  const { available, total } = roomTotals(h)
  const provided = cleanProvided(h.provided)
  const chips = showAll ? provided : provided.slice(0, 6)
  const stale = isStale(h.roomsUpdatedAt)
  const firstName = h.landlordName.split(' ')[0]

  return (
    <article className={`hs-card${full ? ' is-full' : ''}`}>
      <div className="hs-gallery">
        {h.images.length > 0 ? (
          <>
            <button className="hs-gallery-main" onClick={() => onOpen(h.images, shot)} aria-label={`Open photos of ${h.name}`}>
              <img src={h.images[shot]?.url} alt={`${h.name}, photo ${shot + 1}`} loading="lazy" />
              {full && <span className="hs-full-badge">Full</span>}
            </button>
            {h.images.length > 1 && (
              <div className="hs-thumbs">
                {h.images.map((img, i) => (
                  <button key={img.id} className={i === shot ? 'on' : ''} onClick={() => setShot(i)} aria-label={`Show photo ${i + 1}`}><img src={img.url} alt="" loading="lazy" /></button>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="hs-noimg"><Building2 size={32} />{full && <span className="hs-full-badge">Full</span>}</div>
        )}
      </div>

      <div className="hs-card-body">
        <div className="hs-title">
          <h3>{h.name}</h3>
          {h.verified && <span className="hs-verified"><BadgeCheck size={14} /> Verified</span>}
        </div>
        <p className="hs-loc"><MapPin size={14} /> {h.area}{h.landmark ? ` · near ${h.landmark}` : ''}</p>
        {h.walkingTime && <p className="hs-loc"><Footprints size={14} /> {h.walkingTime}</p>}

        <div className={`hs-avail${full ? ' none' : available <= 3 ? ' low' : ''}`}>
          <DoorOpen size={26} />
          <span className="hs-avail-num">{available}</span>
          <span className="hs-avail-txt"><strong>{full ? 'No rooms available' : available === 1 ? 'room available' : 'rooms available'}</strong><small>out of {total} · updated {timeAgo(h.roomsUpdatedAt)}</small></span>
        </div>
        <ul className="hs-rooms">
          {h.roomTypes.map((r) => (
            <li key={r.type} className={r.available === 0 ? 'is-out' : r.available <= 2 ? 'is-low' : ''}>
              <span className="hs-room-info">
                <span className="hs-room-name">{r.type}</span>
                <span className="hs-room-rent">{kes(r.rent)}<small>/{r.period}</small></span>
              </span>
              <span className={`hs-room-left${r.available === 0 ? ' out' : r.available <= 2 ? ' low' : ''}`}>
                {r.available === 0 ? <b>Full</b> : <><b>{r.available}</b><small>{r.available === 1 ? 'room left' : 'rooms left'}</small></>}
              </span>
            </li>
          ))}
        </ul>
        {stale && <p className="hs-updated stale"><Clock size={12} /> Room count may be outdated, ask admin</p>}

        {provided.length > 0 && (
          <div className="hs-provided">
            <strong>What is provided</strong>
            <div className="hs-pchips">
              {chips.map(([key, state]) => {
                const Icon = ICONS[key] ?? BadgeCheck
                return <span key={key} className={`hs-pchip ${state}`}><Icon size={13} /> {providedLabel(key)}{state === 'extra' ? ' · extra cost' : ''}</span>
              })}
              {provided.length > 6 && <button className="hs-linkbtn" onClick={() => setShowAll(!showAll)}>{showAll ? 'Show less' : `+${provided.length - 6} more`}</button>}
            </div>
          </div>
        )}

        {h.description && <p className="hs-desc">{h.description}</p>}
        {(h.deposit || h.rules) && (
          <details className="hs-details">
            <summary>Deposit &amp; house rules</summary>
            {h.deposit && <p><strong>Deposit:</strong> {h.deposit}</p>}
            {h.rules && <p className="hs-pre">{h.rules}</p>}
          </details>
        )}

        <a className="hs-map" href={h.locationUrl} target="_blank" rel="noopener noreferrer" aria-label={`Open ${h.name} in Google Maps`}>
          <GoogleMapsLogo size={22} /><span>Open in Google Maps</span><ExternalLink size={14} />
        </a>

        {h.showContact && h.landlordContact && (
          <div className="hs-contact">
            <span>Landlord{h.landlordName ? `: ${h.landlordName}` : ''}</span>
            <strong>{showPhone(h.landlordContact)}</strong>
          </div>
        )}
        <div className="hs-actions">
          {h.showContact && h.landlordContact && (
            <>
              <a href={waLink(h.landlordContact, `Hello${firstName ? ` ${firstName}` : ''}, I found ${h.name} on Chuka Comrades. Is a room still available?`)} target="_blank" rel="noopener noreferrer"><WhatsAppLogo size={16} /> WhatsApp landlord</a>
              <a className="outline" href={`tel:+${h.landlordContact}`}><Phone size={15} /> Call</a>
            </>
          )}
          <a className={h.showContact ? 'outline' : ''} href={waLink(ADMIN_WHATSAPP, `Hello Chuka Comrades admin, I'm interested in ${h.name} (${h.area}). Is a room still available?`)} target="_blank" rel="noopener noreferrer"><WhatsAppLogo size={16} /> Ask admin</a>
        </div>
      </div>
    </article>
  )
}

function PhotoViewer({ box, onChange }: { box: NonNullable<Lightbox>; onChange: (b: Lightbox) => void }) {
  const { images, index } = box
  const go = useCallback((d: number) => onChange({ images, index: (index + d + images.length) % images.length }), [images, index, onChange])
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onChange(null)
      else if (e.key === 'ArrowRight') go(1)
      else if (e.key === 'ArrowLeft') go(-1)
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [go, onChange])
  return (
    <div className="hs-viewer" role="dialog" aria-modal="true" aria-label="Hostel photos" onClick={() => onChange(null)}>
      <button className="hs-viewer-close" onClick={() => onChange(null)} aria-label="Close"><X size={22} /></button>
      {images.length > 1 && <button className="hs-viewer-nav left" onClick={(e) => { e.stopPropagation(); go(-1) }} aria-label="Previous photo"><ChevronLeft size={26} /></button>}
      <img src={images[index].url} alt={`Photo ${index + 1} of ${images.length}`} onClick={(e) => e.stopPropagation()} />
      {images.length > 1 && <button className="hs-viewer-nav right" onClick={(e) => { e.stopPropagation(); go(1) }} aria-label="Next photo"><ChevronRight size={26} /></button>}
      <span className="hs-viewer-count">{index + 1} / {images.length}</span>
    </div>
  )
}

function LandlordsTab() {
  const msg = "Hello Chuka Comrades admin, I'm a landlord and I'd like to list my hostel."
  return (
    <section className="hs-panel">
      <span className="hs-kicker dark">FOR LANDLORDS</span>
      <h2>List your hostel, then keep your rooms up to date</h2>
      <p>Only the Chuka Comrades admin publishes hostels, so every listing is checked. Landlords do not need an account.</p>
      <ol className="hs-steps">
        <li><strong>Message the admin on WhatsApp</strong> with your hostel name and a Google Maps link (in Google Maps: Share → Copy link).</li>
        <li><strong>Send the details:</strong> area and landmark, each room type with its rent and how many rooms are free, what is provided (water, electricity, WiFi, security…), deposit and house rules.</li>
        <li><strong>Send 1 to 3 clear photos</strong> and say whether we may show your phone number to students.</li>
        <li><strong>When a room is taken or becomes free, just text the admin.</strong> The listing is updated so students always see current availability.</li>
      </ol>
      <div className="hs-actions left">
        <a href={waLink(ADMIN_WHATSAPP, msg)} target="_blank" rel="noopener noreferrer"><WhatsAppLogo size={16} /> Message the admin</a>
      </div>
    </section>
  )
}

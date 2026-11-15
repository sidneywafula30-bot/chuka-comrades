import { useCallback, useEffect, useState } from 'react'
import { onAuthStateChanged, signInWithPopup, type User } from 'firebase/auth'
import { auth, firebaseReady, googleProvider } from './lib/firebase'
import { syncProfile } from './lib/profile'
import Preloader from './components/Preloader'
import InstallPopup from './components/InstallPopup'
import Landing from './pages/Landing'
import Cpl from './pages/Cpl'
import Hostel from './pages/Hostel'
import Media from './pages/Media'
import Efootball from './pages/Efootball'
import Ozone from './pages/Ozone'
import Cyber from './pages/Cyber'
import Soko from './pages/Soko'
import StudyLabs from './pages/StudyLabs'
import Gigs from './pages/Gigs'
import Skills from './pages/Skills'

function useHash() {
  const [hash, setHash] = useState(window.location.hash)
  useEffect(() => {
    const on = () => setHash(window.location.hash)
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return hash
}

export default function App() {
  const [showPreloader, setShowPreloader] = useState(true)
  const [authChecked, setAuthChecked] = useState(!firebaseReady)
  const [user, setUser] = useState<User | null>(null)
  const hash = useHash()
  const inCpl = hash.startsWith('#/cpl')
  const inHostel = hash.startsWith('#/hostel')
  const inMedia = hash.startsWith('#/music')
  const inEf = hash.startsWith('#/efootball')
  const inOz = hash.startsWith('#/ozone')
  const inCy = hash.startsWith('#/cyber')
  const inSoko = hash.startsWith('#/soko')
  const inLabs = hash.startsWith('#/labs')
  const inGigs = hash.startsWith('#/gigs')
  const inSkills = hash.startsWith('#/skills')

  // Firebase = who is signed in.
  useEffect(() => {
    if (!auth) return
    return onAuthStateChanged(auth, (u) => {
      setUser(u)
      setAuthChecked(true)
    })
  }, [])

  // Supabase = where data lives. Save/refresh the profile after sign-in.
  useEffect(() => {
    if (!user) return
    syncProfile(user).then((r) => {
      if (!r.ok) console.warn('Profile sync failed:', r.error)
    })
  }, [user])

  // Landing remounts when leaving CPL, so scroll to the target section ourselves (e.g. #services).
  useEffect(() => {
    if (inCpl || inHostel || inMedia || inEf || inOz || inCy || inSoko || inLabs || inGigs || inSkills) { window.scrollTo(0, 0); return }
    const id = hash.slice(1)
    if (id) requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView())
  }, [hash, inCpl, inHostel, inMedia, inEf, inOz, inCy, inSoko, inLabs, inGigs, inSkills])

  const signIn = useCallback(() => {
    if (auth) void signInWithPopup(auth, googleProvider).catch(() => {})
  }, [])
  const leaveSoko = useCallback(() => { window.location.hash = '#services' }, [])
  const done = useCallback(() => setShowPreloader(false), [])

  return (
    <>
      {inCy ? <Cyber user={user} route={hash} /> : inGigs ? <Gigs user={user} onSignIn={signIn} onBack={leaveSoko} /> : inSkills ? <Skills user={user} onSignIn={signIn} onBack={leaveSoko} /> : inLabs ? <StudyLabs user={user} onSignIn={signIn} onBack={leaveSoko} /> : inSoko ? <Soko user={user} onSignIn={signIn} onBack={leaveSoko} /> : inCpl ? <Cpl user={user} route={hash} /> : inOz ? <Ozone user={user} route={hash} /> : inEf ? <Efootball user={user} route={hash} /> : inHostel ? <Hostel user={user} /> : inMedia ? <Media /> : <Landing user={user} />}
      {!showPreloader && <InstallPopup />}
      {showPreloader && <Preloader ready={authChecked} onDone={done} />}
    </>
  )
}

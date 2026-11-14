import { useEffect, useState } from 'react'
import {
  GoogleClassroomLogo, GoogleGroupsLogo, GoogleMapsLogo, GoogleTVLogo, YouTubeLogo, YouTubeMusicLogo,
} from './BrandLogos'
import './Preloader.css'

const BASE = import.meta.env.BASE_URL
const MIN_MS = 2600

type Props = { ready?: boolean; onDone: () => void }

/** Shows for at least MIN_MS, and until `ready` (e.g. auth check) is true. */
export default function Preloader({ ready = true, onDone }: Props) {
  const [minElapsed, setMinElapsed] = useState(false)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setMinElapsed(true), MIN_MS)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (!(minElapsed && ready)) return
    setLeaving(true)
    const t = setTimeout(onDone, 500)
    return () => clearTimeout(t)
  }, [minElapsed, ready, onDone])

  return (
    <main
      className={`preloader${leaving ? ' leaving' : ''}`}
      aria-label="Loading Chuka Comrades"
    >
      <div className="preloader-inner">
        <img className="pl-crest" src={`${BASE}chukalogo.png`} alt="Chuka University crest" />

        <h1 className="pl-name">Chuka Comrades</h1>
        <p className="pl-tagline">Your campus. Your community.</p>

        {/* Below the name: Google/YouTube apps + Chuka crest */}
        <div className="pl-row">
          <span className="pl-chip" style={{ animationDelay: '.40s' }}><YouTubeLogo size={26} /></span>
          <span className="pl-chip" style={{ animationDelay: '.48s' }}><GoogleMapsLogo size={32} /></span>
          <span className="pl-chip" style={{ animationDelay: '.56s' }}><GoogleClassroomLogo size={30} /></span>
          <span className="pl-chip" style={{ animationDelay: '.64s' }}><GoogleGroupsLogo size={28} /></span>
          <span className="pl-chip" style={{ animationDelay: '.72s' }}><YouTubeMusicLogo size={32} /></span>
          <span className="pl-chip" style={{ animationDelay: '.80s' }}><GoogleTVLogo size={26} /></span>
          <span className="pl-chip pl-cr" style={{ animationDelay: '.88s' }}>
            <img src={`${BASE}chukalogo.png`} alt="Chuka University crest" />
          </span>
        </div>

        <p className="pl-solved">All your problems solved</p>

        <div className="pl-bar" role="status" aria-live="polite">
          <span className="pl-bar-fill" style={{ animationDuration: `${MIN_MS}ms` }} />
        </div>
        <p className="pl-welcome">Welcome to Chuka Comrades</p>
      </div>
    </main>
  )
}

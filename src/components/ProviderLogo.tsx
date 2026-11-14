import { useState } from 'react'
import { siCoursera, siEdx, siFreecodecamp, siFuturelearn, siGoogle, siKhanacademy, siUdacity, siYale } from 'simple-icons'
import type { CourseProvider } from '../lib/courseProviders'

/**
 * Provider logo, tried in this order:
 *  1. OFFICIAL FILE you add: put the provider's press-kit logo at public/logos/providers/<id>.svg (or .png) and add the
 *     id (and extension) to LOCAL_LOGOS below. This is the best quality and is what you should use for every provider.
 *  2. Brand glyph from the `simple-icons` package (8 providers have one).
 *  3. The provider's own site icon (favicon) fetched from Google's icon service.
 *  4. Coloured initials.
 * Logos are trademarks of their owners and are shown only to identify the provider.
 */
const LOCAL_LOGOS: Record<string, 'svg' | 'png'> = {
  // e.g.  'mit-ocw': 'svg',  coursera: 'png',
}
const GLYPHS: Record<string, { path: string; hex: string; title: string }> = {
  yale: siYale, khan: siKhanacademy, freecodecamp: siFreecodecamp, coursera: siCoursera, edx: siEdx, futurelearn: siFuturelearn, udacity: siUdacity, google: siGoogle,
}
const BASE = import.meta.env.BASE_URL

export default function ProviderLogo({ p, size = 44 }: { p: CourseProvider; size?: number }) {
  const [favBroken, setFavBroken] = useState(false)
  const [localBroken, setLocalBroken] = useState(false)
  const box = { width: size, height: size } as const
  const local = LOCAL_LOGOS[p.id]
  if (local && !localBroken) return <span className="cf-logo" style={box}><img src={`${BASE}logos/providers/${p.id}.${local}`} alt={`${p.name} logo`} onError={() => setLocalBroken(true)} /></span>
  const g = GLYPHS[p.id]
  if (g) return <span className="cf-logo" style={box}><svg viewBox="0 0 24 24" role="img" aria-label={`${p.name} logo`} width={size * 0.66} height={size * 0.66}><path fill={`#${g.hex}`} d={g.path} /></svg></span>
  if (!favBroken) return <span className="cf-logo" style={box}><img src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(p.domain.split('/')[0])}&sz=128`} alt={`${p.name} logo`} onError={() => setFavBroken(true)} referrerPolicy="no-referrer" /></span>
  const initials = p.name.split(/\s+/).filter((w) => /^[A-Za-z]/.test(w)).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
  return <span className="cf-logo cf-initials" style={{ ...box, background: p.color }} aria-label={`${p.name} logo`}>{initials}</span>
}

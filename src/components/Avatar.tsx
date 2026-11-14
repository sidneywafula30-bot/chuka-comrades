import { useState } from 'react'
import './Avatar.css'

type Props = { src?: string | null; name?: string | null; email?: string | null; size?: number }

/** Profile photo with a safe fallback to initials if the image can't load. */
export default function Avatar({ src, name, email, size = 40 }: Props) {
  const [failed, setFailed] = useState(false)
  const label = (name || email || 'C').trim()
  const initials = label
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')

  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.38 }}>
      {src && !failed ? (
        <img
          src={src}
          alt={name ? `${name}'s profile photo` : 'Your profile photo'}
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <span aria-hidden="true">{initials}</span>
      )}
    </span>
  )
}

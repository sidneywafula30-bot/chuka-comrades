import type { ReactNode } from 'react'
import { UserRound } from 'lucide-react'
import type { Player } from '../lib/cpl'

export default function PlayerCard({ p, children }: { p: Player; children?: ReactNode }) {
  return (
    <article className="cpl-pl">
      <div className="cpl-pl-photo">
        {p.imageUrl ? <img src={p.imageUrl} alt={p.name} loading="lazy" /> : <UserRound size={34} />}
        {p.number && <span className="cpl-pl-num">{p.number}</span>}
      </div>
      <strong>{p.name}</strong>
      <span className={`cpl-pos pos-${p.position}`}>{p.position}</span>
      {p.bio && <p>{p.bio}</p>}
      {(p.email || p.phone) && <small className="cpl-pl-contact">{[p.email, p.phone && `+${p.phone}`].filter(Boolean).join(' · ')}</small>}
      {children && <div className="cpl-tc-actions">{children}</div>}
    </article>
  )
}

import type { ReactNode } from 'react'
import { ExternalLink, MapPin } from 'lucide-react'
import type { Venue } from '../lib/cpl'

export default function VenueCard({ v, children }: { v: Venue; children?: ReactNode }) {
  return (
    <article className="cpl-vn">
      <div className="cpl-vn-img">{v.imageUrl ? <img src={v.imageUrl} alt={v.name} loading="lazy" /> : <MapPin size={34} />}</div>
      <div className="cpl-vn-body">
        <h4>{v.name}</h4>
        {v.description && <p>{v.description}</p>}
        <div className="cpl-tc-actions" style={{ justifyContent: 'flex-start' }}>
          {v.mapsUrl && <a className="lp-btn" href={v.mapsUrl} target="_blank" rel="noopener noreferrer"><MapPin size={14} /> Open in Maps <ExternalLink size={12} /></a>}
          {children}
        </div>
      </div>
    </article>
  )
}

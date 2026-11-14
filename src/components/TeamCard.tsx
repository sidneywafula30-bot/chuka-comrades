import type { ReactNode } from 'react'
import { Mail, MessageCircle, Shield, User } from 'lucide-react'
import type { Team } from '../lib/cpl'

/** One team as a card: gradient banner, logo, name, division, coach. Coach contacts show only when the data has them (chairmen/coach). */
export default function TeamCard({ t, division, contacts, children }: { t: Team; division?: string; contacts?: boolean; children?: ReactNode }) {
  return (
    <article className="cpl-tc">
      <div className="cpl-tc-banner">{division && <span className="cpl-tc-div">{division}</span>}</div>
      <div className="cpl-tc-logo">{t.logoUrl ? <img src={t.logoUrl} alt={`${t.name} logo`} loading="lazy" /> : <Shield size={30} />}</div>
      <div className="cpl-tc-body">
        <h4>{t.name}</h4>
        <p className="cpl-tc-coach"><User size={13} /> Coach {t.coachName}</p>
        {t.description && <p className="cpl-tc-desc">{t.description}</p>}
        {contacts && (t.coachEmail || t.coachWhatsapp) && (
          <div className="cpl-tc-chips">
            {t.coachEmail && <a href={`mailto:${t.coachEmail}`}><Mail size={12} /> {t.coachEmail}</a>}
            {t.coachWhatsapp && <a href={`https://wa.me/${t.coachWhatsapp}`} target="_blank" rel="noopener noreferrer"><MessageCircle size={12} /> +{t.coachWhatsapp}</a>}
          </div>
        )}
        {children && <div className="cpl-tc-actions">{children}</div>}
      </div>
    </article>
  )
}

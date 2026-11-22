import { ADMIN_WHATSAPP, waLink } from '../lib/hostel'
import { WhatsAppLogo } from './BrandLogos'

/**
 * Hostel admin identity: the Chuka House Connect logo (same one as the Hostels & Roommates card)
 * in place of a photo, plus the admin WhatsApp number. Mirrors the O-Zone admin chat button.
 */
export const HOSTEL_ADMIN_LABEL = 'Hostel admin'
export const hostelAdminUrl = (text = 'Hello Chuka Comrades admin, ') => waLink(ADMIN_WHATSAPP, text)

export function HostelAdminLogo({ className = 'hs-fab-ph' }: { className?: string }) {
  return <img className={className} src={`${import.meta.env.BASE_URL}hostel-logo.png`} alt="" />
}

/** Floating WhatsApp button, fixed bottom-right on every hostel tab. */
export default function HostelAdminFab() {
  return (
    <a
      className="hs-fab"
      href={hostelAdminUrl()}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with the hostel admin on WhatsApp"
    >
      <HostelAdminLogo />
      <span>Chat admin</span>
      <WhatsAppLogo size={20} className="hs-fab-wa" />
    </a>
  )
}

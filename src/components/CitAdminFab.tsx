import { BlueskyLogo } from './Bluesky'
import './Cit.css'

/**
 * Floating "Chat admin" button for every CIT Group (Skills) page. Same look as the Hostel and O-Zone
 * buttons: the CIT logo as the photo, and the Bluesky butterfly where the WhatsApp logo would be.
 * It still opens a WhatsApp chat with the admin number.
 */
export default function CitAdminFab({ phone }: { phone: string }) {
  const digits = (phone || '254184198432').replace(/\D/g, '')
  const url = `https://wa.me/${digits}?text=${encodeURIComponent('Hello CIT Group admin, ')}`
  return (
    <a className="cit-fab" href={url} target="_blank" rel="noopener noreferrer" aria-label="Chat with the CIT Group admin on WhatsApp">
      <img className="cit-fab-ph" src={`${import.meta.env.BASE_URL}skills-logo.svg`} alt="" />
      <span>Chat admin</span>
      <BlueskyLogo size={20} className="cit-fab-bs" />
    </a>
  )
}

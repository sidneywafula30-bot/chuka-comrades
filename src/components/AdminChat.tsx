import { useState } from 'react'

/**
 * Single source of truth for the O-Zone admin identity (name, photo, WhatsApp).
 * Every "chat the admin on WhatsApp" link/button uses this, so the photo and
 * name always match the Admin profile card at the bottom of the O-Zone page.
 * Photo lives in /public/sherif.jpeg.
 */
export const ADMIN_NAME = 'Sherif'
export const ADMIN_INITIALS = 'SH'
export const OZONE_ADMIN_WA = '254707245180'
export const adminWaUrl = (text = 'Hi O-Zone admin, ') => `https://wa.me/${OZONE_ADMIN_WA}?text=${encodeURIComponent(text)}`

/** Round admin photo, falling back to initials if the image is missing. */
export function AdminAvatar({ className = 'oz-admin-ph', size }: { className?: string; size?: number }) {
  const [noPhoto, setNoPhoto] = useState(false)
  const style = size ? { width: size, height: size } : undefined
  return noPhoto
    ? <span className={`${className} oz-admin-init`} style={style} aria-hidden>{ADMIN_INITIALS}</span>
    : <img className={className} style={style} src={`${import.meta.env.BASE_URL}sherif.jpeg`} alt={`${ADMIN_NAME}, O-Zone admin`} onError={() => setNoPhoto(true)} />
}

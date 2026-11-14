/**
 * YouTube + Google Maps logos.
 *
 * These are inline SVG recreations so the project works offline with no
 * extra files. To use the OFFICIAL artwork, download it from the brand
 * resource pages (YouTube: youtube.com/howyoutubeworks/resources/brand-resources,
 * Google Maps: developers.google.com/maps/documentation/resources/brand) and
 * save as public/logos/youtube.svg and public/logos/google-maps.svg, then
 * set USE_OFFICIAL_FILES = true.
 */
const USE_OFFICIAL_FILES = false
const BASE = import.meta.env.BASE_URL

type LogoProps = { size?: number; className?: string }

export function YouTubeLogo({ size = 44, className }: LogoProps) {
  if (USE_OFFICIAL_FILES) {
    return <img className={className} src={`${BASE}logos/youtube.svg`} alt="YouTube" height={size} />
  }
  return (
    <svg
      className={className}
      width={size * 1.42}
      height={size}
      viewBox="0 0 71 50"
      role="img"
      aria-label="YouTube"
    >
      <rect width="71" height="50" rx="13" fill="#FF0000" />
      <path d="M28 14.5v21l18.5-10.5z" fill="#fff" />
    </svg>
  )
}

export function GoogleMapsLogo({ size = 44, className }: LogoProps) {
  if (USE_OFFICIAL_FILES) {
    return <img className={className} src={`${BASE}logos/google-maps.svg`} alt="Google Maps" height={size} />
  }
  return (
    <svg
      className={className}
      width={size * 0.75}
      height={size}
      viewBox="0 0 48 64"
      role="img"
      aria-label="Google Maps"
    >
      <defs>
        <clipPath id="gm-pin">
          <path d="M24 0C10.7 0 0 10.7 0 24c0 17 24 40 24 40s24-23 24-40C48 10.7 37.3 0 24 0z" />
        </clipPath>
      </defs>
      <g clipPath="url(#gm-pin)">
        <rect width="48" height="64" fill="#34A853" />
        <path d="M0 0h24L0 30z" fill="#1A73E8" />
        <path d="M0 0h48v14L24 24z" fill="#4285F4" />
        <path d="M48 0v26L24 24 34 0z" fill="#EA4335" />
        <path d="M0 30L24 24l24 2v10L24 64 0 38z" fill="#34A853" />
        <path d="M0 24l4 18 20 22L8 40z" fill="#188038" />
        <path d="M30 8l18 6v22L33 22z" fill="#FBBC04" />
      </g>
      <circle cx="24" cy="23" r="8.5" fill="#fff" />
      <circle cx="24" cy="23" r="4.2" fill="#B31412" />
    </svg>
  )
}

export function GoogleClassroomLogo({ size = 44, className }: LogoProps) {
  return (
    <svg className={className} width={size * 1.1} height={size} viewBox="0 0 66 60" role="img" aria-label="Google Classroom">
      <rect x="2" y="2" width="62" height="56" rx="8" fill="#0F9D58" />
      <path d="M2 44h62v6a8 8 0 0 1-8 8H10a8 8 0 0 1-8-8z" fill="#F4B400" />
      <rect x="9" y="9" width="48" height="31" rx="3" fill="#57BB8A" />
      <circle cx="33" cy="20" r="6.5" fill="#fff" />
      <path d="M20 36c0-7.5 6-11 13-11s13 3.5 13 11z" fill="#fff" />
    </svg>
  )
}

export function GoogleGroupsLogo({ size = 44, className }: LogoProps) {
  return (
    <svg className={className} width={size * 1.2} height={size} viewBox="0 0 72 60" role="img" aria-label="Google Groups">
      <circle cx="14" cy="22" r="8" fill="#1A73E8" />
      <path d="M0 48c0-9 6-14 14-14s14 5 14 14z" fill="#1A73E8" />
      <circle cx="58" cy="22" r="8" fill="#1A73E8" />
      <path d="M44 48c0-9 6-14 14-14s14 5 14 14z" fill="#1A73E8" />
      <circle cx="36" cy="18" r="10" fill="#4285F4" />
      <path d="M17 52c0-12 8-18 19-18s19 6 19 18z" fill="#4285F4" />
    </svg>
  )
}

/** "Music" = YouTube Music. */
export function YouTubeMusicLogo({ size = 44, className }: LogoProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 48 48" role="img" aria-label="YouTube Music">
      <circle cx="24" cy="24" r="22" fill="#FF0000" />
      <circle cx="24" cy="24" r="14.5" fill="none" stroke="#fff" strokeWidth="2.6" />
      <path d="M20 16.5v15l12-7.5z" fill="#fff" />
    </svg>
  )
}

/** "Movies" = Google TV (formerly Google Play Movies & TV). */
export function GoogleTVLogo({ size = 44, className }: LogoProps) {
  return (
    <svg className={className} width={size * 1.3} height={size} viewBox="0 0 64 48" role="img" aria-label="Google TV">
      <defs>
        <clipPath id="gtv-clip"><rect x="2" y="2" width="60" height="44" rx="10" /></clipPath>
      </defs>
      <g clipPath="url(#gtv-clip)">
        <rect x="2" y="2" width="30" height="22" fill="#4285F4" />
        <rect x="32" y="2" width="30" height="22" fill="#EA4335" />
        <rect x="2" y="24" width="30" height="22" fill="#34A853" />
        <rect x="32" y="24" width="30" height="22" fill="#FBBC04" />
      </g>
      <circle cx="32" cy="24" r="13" fill="#fff" />
      <path d="M28 17.5v13l11-6.5z" fill="#202124" />
    </svg>
  )
}

/** Official WhatsApp glyph (green), used on the hostel group links. */
export function WhatsAppLogo({ size = 28, className }: LogoProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" role="img" aria-label="WhatsApp">
      <path fill="#25D366" d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  )
}

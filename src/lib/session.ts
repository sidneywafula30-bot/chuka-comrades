// Remembers that this device was signed in, so an unexpected sign-out (browser cleared
// its storage) can be told apart from the user pressing "Sign out".
const KEY = 'comrades-was-signed-in'

export const markSignedIn = () => { try { localStorage.setItem(KEY, '1') } catch { /* private mode */ } }
export const markSignedOut = () => { try { localStorage.removeItem(KEY) } catch { /* private mode */ } }
export const wasSignedIn = () => { try { return localStorage.getItem(KEY) === '1' } catch { return false } }

/** True inside WhatsApp / Instagram / Facebook / Telegram etc. in-app browsers, which often wipe saved logins. */
export function inAppBrowser(): string | null {
  const ua = navigator.userAgent || ''
  if (/FBAN|FBAV|FB_IAB/i.test(ua)) return 'Facebook'
  if (/Instagram/i.test(ua)) return 'Instagram'
  if (/Telegram/i.test(ua)) return 'Telegram'
  if (/TikTok|musical_ly|BytedanceWebview/i.test(ua)) return 'TikTok'
  if (/Snapchat/i.test(ua)) return 'Snapchat'
  if (/Line\//i.test(ua)) return 'LINE'
  if (/; wv\)/i.test(ua) && /Android/i.test(ua)) return 'this app' // generic Android WebView (WhatsApp, etc.)
  return null
}

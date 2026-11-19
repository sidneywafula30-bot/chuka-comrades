import { makeApi } from './hub'

const raw = makeApi(import.meta.env.VITE_JOURNEY_API_URL as string | undefined, 'Long Campus Journey', 'VITE_JOURNEY_API_URL')
export const journeyReady = raw.ready
export const jcall = raw.call
export const ADMIN_WA = (import.meta.env.VITE_ADMIN_WHATSAPP as string) || '254184198432'

export type Status = 'draft' | 'pending' | 'active' | 'rejected' | 'expired'
export type Grad = { slug: string; name: string; course: string; classYear: string | number; story: string; thanks: string; youtube: string; gift: string; photoId: string; status: Status; reason: string; ref: string; mpesa: string; expiresAt: string }
export type Msg = { id: string; name: string; text: string; status: string; priv?: string; at?: string; photos?: string[]; videoId?: string; yt?: string }
export type Me = { grad: Grad | null; msgs: Msg[]; isAdmin: boolean; classYear: number; price: number; gradDate: string; payTo: string }
export type Home = { classYear: number; price: number; gradDate: string; payTo: string }
export type PublicGrad = Omit<Grad, 'status' | 'reason' | 'ref' | 'mpesa' | 'expiresAt'> & { wall: Msg[] }
export type AdminRow = { slug: string; name: string; course: string; email: string; classYear: string; ref: string; mpesa: string; status: Status; expiresAt: string }

export const pageUrl = (slug: string, write = false) => `${window.location.origin}${window.location.pathname}#/journey/${slug}${write ? '/write' : ''}`
export const ytId = (u: string) => u.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([\w-]{11})/)?.[1] ?? ''
export const waAdmin = (text: string) => `https://wa.me/${ADMIN_WA}?text=${encodeURIComponent(text)}`
export const fmt = (s: string) => (s ? new Date(s).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' }) : '')

/** All-day reminder: a Google Calendar link (optionally yearly) and an .ics file (iPhone/Outlook) with an alert the day before. */
export function reminder(title: string, ymd: string, details: string, yearly = false) {
  const d = ymd.replace(/-/g, ''), next = new Date(`${ymd}T00:00:00`); next.setDate(next.getDate() + 1)
  const end = next.toISOString().slice(0, 10).replace(/-/g, '')
  const q = new URLSearchParams({ action: 'TEMPLATE', text: title, dates: `${d}/${end}`, details })
  if (yearly) q.set('recur', 'RRULE:FREQ=YEARLY')
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Chuka Comrades//Journey//EN', 'BEGIN:VEVENT', `UID:${d}-${Date.now()}@chuka-comrades`, `DTSTAMP:${new Date().toISOString().replace(/[-:]|\.\d{3}/g, '')}`,
    `DTSTART;VALUE=DATE:${d}`, `DTEND;VALUE=DATE:${end}`, `SUMMARY:${title}`, `DESCRIPTION:${details.replace(/\n/g, '\\n')}`, ...(yearly ? ['RRULE:FREQ=YEARLY'] : []),
    'BEGIN:VALARM', 'TRIGGER:-P1D', 'ACTION:DISPLAY', `DESCRIPTION:${title}`, 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n')
  return { google: `https://calendar.google.com/calendar/render?${q.toString()}`, ics: `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}` }
}

/** Graduation-day gallery: the owner uploads ceremony photos, anyone with the page link can view them. */
export type Pic = { id: string; photoId: string; caption: string; at?: string }
export const MAX_PICS = 30
export const picDownload = (photoId: string) => `https://drive.google.com/uc?export=download&id=${photoId}`

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { DEFAULT_PAY, ef, ksh, showPhone, waLink, type PayCfg } from '../lib/efootball'
import { WhatsAppLogo } from './BrandLogos'

let cached: PayCfg | null = null
let inflight: Promise<PayCfg> | null = null

/** Fees, the conditions and the admin's number, from the server. Falls back to the built-in defaults until (or if) the server answers. */
export function usePayCfg(): PayCfg {
  const [cfg, setCfg] = useState<PayCfg>(cached ?? DEFAULT_PAY)
  useEffect(() => {
    if (cached) return
    inflight ||= ef<PayCfg>('config').then((c) => (cached = c)).catch(() => DEFAULT_PAY)
    void inflight.then(setCfg)
  }, [])
  return cfg
}

export const cleanCode = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10)

const logoSrc = () => `${import.meta.env.BASE_URL}efootball-logo.svg`

/** The round eFootball logo with the small WhatsApp mark on its corner: the face of the admin on every chat button. */
export function AdminBadge({ size = 40 }: { size?: number }) {
  return (
    <span className="ef-badge" style={{ width: size, height: size }} aria-hidden>
      <img src={logoSrc()} alt="" width={size} height={size} />
      <WhatsAppLogo size={Math.round(size * 0.46)} className="ef-badge-wa" />
    </span>
  )
}

/** "Chat admin on WhatsApp": one component for every place the admin is on the other end, so the number never drifts. */
export function AdminChat({ message, label = 'Chat admin on WhatsApp' }: { message: string; label?: string }) {
  const cfg = usePayCfg()
  return (
    <a className="ef-wa-admin" href={waLink(cfg.adminWa, message)} target="_blank" rel="noopener noreferrer">
      <AdminBadge size={30} /><span>{label}</span>
    </a>
  )
}

/** Floating button on every eFootball page, bottom right. */
export function AdminFab({ page = '' }: { page?: string }) {
  const cfg = usePayCfg()
  const where: Record<string, string> = { league: 'my league', players: 'the players list', market: 'the marketplace', fpl: 'FPL', tournament: 'the weekly knockout', join: 'the weekly knockout', profile: 'my profile' }
  const msg = where[page] ? `Hi eFootball admin, I need help with ${where[page]}. ` : 'Hi eFootball admin, '
  const btn = (
    <a className={`ef-fab${page ? '' : ' wide'}`} href={waLink(cfg.adminWa, msg)} target="_blank" rel="noopener noreferrer" aria-label="Chat with the eFootball admin on WhatsApp">
      <AdminBadge size={44} /><span>Chat admin</span>
    </a>
  )
  // Drawn on <body>, so a parent with transform / overflow can never hide or move it.
  return typeof document === 'undefined' ? btn : createPortal(btn, document.body)
}

type BoxProps = {
  amount: number; label: string; code: string; onCode: (v: string) => void; onSubmit: () => void
  busy?: boolean; button: string; disabled?: boolean; extra?: string
}

/** "Pay by M-Pesa, type the code, chat the admin": the same three steps for every paid thing. */
export function PayBox({ amount, label, code, onCode, onSubmit, busy, button, disabled, extra }: BoxProps) {
  const cfg = usePayCfg()
  return (
    <div className="ef-pay">
      <ol>
        <li><b>1</b><span>Send <strong>{ksh(amount)}</strong> by M-Pesa to <strong>{showPhone(cfg.payPhone)}</strong>.{extra ? ` ${extra}` : ''}</span></li>
        <li><b>2</b><span>Type the 10-character code from the M-Pesa message (like <em>QJK4ABC123</em>) and send.</span></li>
        <li><b>3</b><span>Chat the admin on WhatsApp so your payment is verified. Nothing is activated until the admin verifies it.</span></li>
      </ol>
      <div className="cpl-inline">
        <input className="ef-sel ef-code" value={code} onChange={(e) => onCode(cleanCode(e.target.value))} placeholder="M-Pesa code" aria-label="M-Pesa code" maxLength={10} autoCapitalize="characters" />
        <button className="lp-btn" disabled={busy || disabled || code.length !== 10} onClick={onSubmit}>{busy ? 'Sending…' : button}</button>
      </div>
      <AdminChat message={`Hi admin, I paid ${ksh(amount)} for: ${label}.${code ? ` M-Pesa code: ${code}.` : ''} Please verify.`} />
    </div>
  )
}

/** Shown after a payment code was sent and before the admin verified it. */
export function PendingPay({ label, amount, code }: { label: string; amount: number; code?: string }) {
  return (
    <div className="ef-pay pending">
      <p className="cpl-msg"><span className="ef-pill gold">Waiting for the admin</span> {label}</p>
      <p className="cpl-note" style={{ textAlign: 'left', margin: '0 0 10px' }}>Your payment code was received. The admin checks it against the M-Pesa statement and verifies it. Chat the admin to speed it up.</p>
      <AdminChat message={`Hi admin, I paid ${ksh(amount)} for: ${label}.${code ? ` M-Pesa code: ${code}.` : ''} Please verify.`} />
    </div>
  )
}

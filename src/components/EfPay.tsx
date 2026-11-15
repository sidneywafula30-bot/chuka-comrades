import { useEffect, useState } from 'react'
import { MessageCircle } from 'lucide-react'
import { DEFAULT_PAY, ef, ksh, showPhone, waLink, type PayCfg } from '../lib/efootball'

let cached: PayCfg | null = null
let inflight: Promise<PayCfg> | null = null

/** Fees and the admin's number, from the server. Falls back to the built-in defaults until (or if) the server answers. */
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
      <a className="ef-wa-admin" href={waLink(cfg.adminWa, `Hi admin, I paid ${ksh(amount)} for: ${label}.${code ? ` M-Pesa code: ${code}.` : ''} Please verify.`)} target="_blank" rel="noopener noreferrer"><MessageCircle size={15} /> Chat admin on WhatsApp</a>
    </div>
  )
}

/** Shown after a payment code was sent and before the admin verified it. */
export function PendingPay({ label, amount, code }: { label: string; amount: number; code?: string }) {
  const cfg = usePayCfg()
  return (
    <div className="ef-pay pending">
      <p className="cpl-msg"><span className="ef-pill gold">Waiting for the admin</span> {label}</p>
      <p className="cpl-note" style={{ textAlign: 'left', margin: '0 0 10px' }}>Your payment code was received. The admin checks it against the M-Pesa statement and verifies it. Chat the admin to speed it up.</p>
      <a className="ef-wa-admin" href={waLink(cfg.adminWa, `Hi admin, I paid ${ksh(amount)} for: ${label}.${code ? ` M-Pesa code: ${code}.` : ''} Please verify.`)} target="_blank" rel="noopener noreferrer"><MessageCircle size={15} /> Chat admin on WhatsApp</a>
    </div>
  )
}

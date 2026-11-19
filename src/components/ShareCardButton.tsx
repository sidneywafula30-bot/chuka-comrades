import { useState } from 'react'
import { Share2 } from 'lucide-react'
import { drawCard, shareCard, type CardSpec } from '../lib/shareCard'

/** Builds a card picture on tap and opens the share sheet (WhatsApp, Status, ...) or downloads it. */
export default function ShareCardButton({ build, filename, text, label = 'Share card', className = 'lp-btn' }: {
  build: () => Promise<CardSpec>; filename: string; text: string; label?: string; className?: string
}) {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  async function go() {
    setBusy(true); setMsg('')
    try {
      const canvas = await drawCard(await build())
      const r = await shareCard(canvas, filename, text)
      setMsg(r === 'downloaded' ? 'Picture saved. Send it on WhatsApp from your gallery.' : '')
    } catch (e) { setMsg((e as Error).message) }
    finally { setBusy(false) }
  }
  return (
    <>
      <button type="button" className={className} disabled={busy} onClick={go}><Share2 size={14} /> {busy ? 'Making card…' : label}</button>
      {msg && <small className="cpl-msg" role="status" style={{ alignSelf: 'center' }}>{msg}</small>}
    </>
  )
}

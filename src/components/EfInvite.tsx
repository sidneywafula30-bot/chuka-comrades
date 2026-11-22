import { useEffect, useState } from 'react'
import { Copy, Download, Share2 } from 'lucide-react'
import QRCode from 'qrcode'
import { drawInvite, shareCard, type InviteSpec } from '../lib/efCard'

/** Drawn once into a canvas; the same picture is shown on the page, shared, or saved. Tapping the card opens the link. */
async function build(spec: InviteSpec): Promise<HTMLCanvasElement> {
  const qr = await QRCode.toDataURL(spec.link, { width: 520, margin: 1, errorCorrectionLevel: 'M' })
  return drawInvite(spec, qr, `${import.meta.env.BASE_URL}efootball.png`)
}

/**
 * The invite card for a league or the knockout. It is a picture (so it can go on WhatsApp Status or into a chat),
 * a link (tapping it opens the join page), and has a QR code for people who only see a screenshot.
 */
export default function EfInvite({ spec, filename, message }: { spec: InviteSpec; filename: string; message: string }) {
  const [src, setSrc] = useState('')
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null)
  const [msg, setMsg] = useState('')
  const key = JSON.stringify(spec)
  useEffect(() => {
    let dead = false
    build(JSON.parse(key) as InviteSpec).then((c) => { if (!dead) { setCanvas(c); setSrc(c.toDataURL('image/png')) } }).catch(() => { if (!dead) setMsg('Could not draw the card. The link below still works.') })
    return () => { dead = true }
  }, [key])

  async function share() {
    if (!canvas) return
    try { const r = await shareCard(canvas, filename, `${message} ${spec.link}`); setMsg(r === 'downloaded' ? 'Card saved. Send it on WhatsApp from your gallery, and paste the link with it.' : '') }
    catch (e) { setMsg((e as Error).message) }
  }
  function save() {
    if (!src) return
    const a = document.createElement('a'); a.href = src; a.download = filename; document.body.appendChild(a); a.click(); a.remove()
  }
  function copy() { void navigator.clipboard?.writeText(spec.link); setMsg('Link copied.'); setTimeout(() => setMsg(''), 2500) }

  return (
    <div className="ef-invite">
      <a className="ef-invite-card" href={spec.link} aria-label={`Open the invite: ${spec.title}`}>
        {src ? <img src={src} alt={`Invite card for ${spec.title}`} /> : <span className="ef-invite-load">Drawing the card…</span>}
      </a>
      <div className="ef-actions" style={{ marginTop: 12 }}>
        <button type="button" className="lp-btn" disabled={!canvas} onClick={share}><Share2 size={14} /> Share card</button>
        <button type="button" className="lp-btn ef-soft" disabled={!src} onClick={save}><Download size={14} /> Save card</button>
        <button type="button" className="lp-btn ef-soft" onClick={copy}><Copy size={14} /> Copy link</button>
      </div>
      <p className="ef-invite-link">{spec.link}</p>
      {msg && <small className="cpl-msg" role="status">{msg}</small>}
    </div>
  )
}

/**
 * Share cards: a PNG drawn on a canvas (no libraries), shared through the phone's share sheet (WhatsApp shows up there),
 * or downloaded when the browser cannot share files. Everything is drawn from data already on the page.
 */

export type CardRow = { cells: string[]; hot?: boolean }
export type CardSpec = {
  theme: 'green' | 'purple'
  eyebrow: string
  title: string
  subtitle?: string
  /** Data URL of a logo (league card). */
  logo?: string
  /** Up to 4 big numbers under the title. */
  stats?: { value: string; label: string }[]
  /** Table: first cell is the rank, the second the name, then right-aligned numbers. */
  head: string[]
  rows: CardRow[]
  footer?: string
  note?: string
}

const THEMES = {
  green: { bg1: '#0f1d16', bg2: '#1f5a38', accent: '#e8b923', text: '#ffffff', soft: '#cfe8d8', rowA: 'rgba(255,255,255,0.06)', rowHot: 'rgba(232,185,35,0.22)' },
  purple: { bg1: '#2a002d', bg2: '#6b1175', accent: '#00ff87', text: '#ffffff', soft: '#e4c9f0', rowA: 'rgba(255,255,255,0.07)', rowHot: 'rgba(0,255,135,0.2)' },
}

const W = 1080

function fit(g: CanvasRenderingContext2D, text: string, max: number): string {
  if (g.measureText(text).width <= max) return text
  let t = text
  while (t.length > 1 && g.measureText(t + '…').width > max) t = t.slice(0, -1)
  return t + '…'
}

function round(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath()
}

function loadImg(src: string): Promise<HTMLImageElement | null> {
  return new Promise((ok) => {
    if (!src) return ok(null)
    const im = new Image()
    im.onload = () => ok(im)
    im.onerror = () => ok(null)
    im.src = src
  })
}

/** Draws the card and returns the canvas. Height grows with the number of rows. */
export async function drawCard(spec: CardSpec): Promise<HTMLCanvasElement> {
  const T = THEMES[spec.theme]
  const logo = await loadImg(spec.logo ?? '')
  const rowH = 64
  const stats = spec.stats ?? []
  const headH = 330 + (stats.length ? 150 : 0)
  const H = headH + 70 + spec.rows.length * rowH + (spec.note ? 70 : 0) + 130
  const c = document.createElement('canvas')
  c.width = W; c.height = H
  const g = c.getContext('2d')!

  const bg = g.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, T.bg2); bg.addColorStop(0.55, T.bg1); bg.addColorStop(1, T.bg1)
  g.fillStyle = bg; g.fillRect(0, 0, W, H)
  g.globalAlpha = 0.07; g.fillStyle = '#fff'; g.beginPath(); g.arc(W - 120, 120, 260, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1

  // header: logo + titles
  let tx = 70
  if (logo) {
    const s = 190, x = 70, y = 70
    g.save(); round(g, x, y, s, s, 36); g.clip(); g.fillStyle = '#fff'; g.fillRect(x, y, s, s)
    const k = Math.min(s / logo.width, s / logo.height); g.drawImage(logo, x + (s - logo.width * k) / 2, y + (s - logo.height * k) / 2, logo.width * k, logo.height * k)
    g.restore(); tx = x + s + 40
  }
  g.textBaseline = 'alphabetic'; g.textAlign = 'left'
  g.fillStyle = T.accent; g.font = '700 28px Manrope, Arial, sans-serif'; g.fillText(spec.eyebrow.toUpperCase(), tx, 108)
  g.fillStyle = T.text; g.font = '800 52px Manrope, Arial, sans-serif'
  const maxT = W - tx - 70
  const words = spec.title.split(' '); const lines: string[] = []; let cur = ''
  for (const w of words) { const t = cur ? `${cur} ${w}` : w; if (g.measureText(t).width > maxT && cur) { lines.push(cur); cur = w } else cur = t }
  if (cur) lines.push(cur)
  lines.slice(0, 3).forEach((l, i) => g.fillText(i === 2 && lines.length > 3 ? fit(g, l, maxT) : l, tx, 170 + i * 58))
  if (spec.subtitle) { g.fillStyle = T.soft; g.font = '500 28px Manrope, Arial, sans-serif'; g.fillText(fit(g, spec.subtitle, maxT), tx, 170 + Math.min(lines.length, 3) * 58 + 14) }

  // stat tiles
  let y = 300
  if (stats.length) {
    const gap = 18, w = (W - 140 - gap * (stats.length - 1)) / stats.length
    stats.forEach((s, i) => {
      const x = 70 + i * (w + gap)
      g.fillStyle = T.rowA; round(g, x, y, w, 118, 24); g.fill()
      g.fillStyle = T.text; g.font = '800 44px Manrope, Arial, sans-serif'; g.textAlign = 'center'; g.fillText(fit(g, s.value, w - 20), x + w / 2, y + 56)
      g.fillStyle = T.soft; g.font = '500 22px Manrope, Arial, sans-serif'; g.fillText(fit(g, s.label, w - 20), x + w / 2, y + 94)
    })
    g.textAlign = 'left'; y += 150
  } else y += 30

  // table
  const cols = spec.head.length
  const numW = 96
  const nameX = 70 + 70
  g.fillStyle = T.soft; g.font = '700 22px Manrope, Arial, sans-serif'
  spec.head.forEach((h, i) => {
    if (i === 0) { g.textAlign = 'left'; g.fillText(h, 78, y + 30) }
    else if (i === 1) { g.textAlign = 'left'; g.fillText(h, nameX, y + 30) }
    else { g.textAlign = 'right'; g.fillText(h, W - 70 - (cols - 1 - i) * numW - 8, y + 30) }
  })
  y += 50
  spec.rows.forEach((r, ri) => {
    g.fillStyle = r.hot ? T.rowHot : ri % 2 ? 'rgba(255,255,255,0.02)' : T.rowA
    round(g, 60, y, W - 120, rowH - 8, 16); g.fill()
    g.fillStyle = r.hot || ri === 0 ? T.accent : T.text
    r.cells.forEach((cell, i) => {
      if (i === 0) { g.textAlign = 'left'; g.font = '800 26px Manrope, Arial, sans-serif'; g.fillText(cell, 78, y + 38) }
      else if (i === 1) { g.textAlign = 'left'; g.font = '700 26px Manrope, Arial, sans-serif'; g.fillStyle = T.text; g.fillText(fit(g, cell, W - 70 - (cols - 2) * numW - nameX - 16), nameX, y + 38); g.fillStyle = r.hot || ri === 0 ? T.accent : T.text }
      else { g.textAlign = 'right'; g.font = (i === cols - 1 ? '800' : '600') + ' 26px Manrope, Arial, sans-serif'; g.fillText(cell, W - 70 - (cols - 1 - i) * numW - 8, y + 38) }
    })
    y += rowH
  })
  g.textAlign = 'left'
  if (spec.note) { g.fillStyle = T.soft; g.font = '500 22px Manrope, Arial, sans-serif'; g.fillText(fit(g, spec.note, W - 140), 70, y + 38); y += 70 }

  // footer
  g.fillStyle = T.accent; g.fillRect(70, H - 120, 90, 6)
  g.fillStyle = T.text; g.font = '800 30px Manrope, Arial, sans-serif'; g.fillText('Chuka Comrades · eFootball', 70, H - 62)
  g.fillStyle = T.soft; g.font = '500 24px Manrope, Arial, sans-serif'; g.fillText(fit(g, spec.footer ?? window.location.host, W - 140), 70, H - 28)
  return c
}

const toBlob = (c: HTMLCanvasElement) => new Promise<Blob | null>((ok) => c.toBlob((b) => ok(b), 'image/png'))

/** Shares the card as an image where the browser can (phones), otherwise downloads it. Returns what happened. */
export async function shareCard(c: HTMLCanvasElement, filename: string, text: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const blob = await toBlob(c)
  if (!blob) throw new Error('Could not make the picture. Try again.')
  const file = new File([blob], filename, { type: 'image/png' })
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try { await nav.share({ files: [file], text }); return 'shared' }
    catch (e) { if ((e as Error).name === 'AbortError') return 'cancelled' }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
  return 'downloaded'
}

/** "Kenya time" style label for a card, e.g. 19 Nov 2026. */
export const cardDate = () => new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Nairobi' })

/* ---------------- invite card (league or knockout): portrait, logo, big name, rules line, QR + link ---------------- */
export type InviteSpec = {
  /** 'league' or 'knockout' changes only the wording and the accent. */
  kind: 'league' | 'knockout'
  title: string
  /** Line under the title, e.g. "Set up by Sidney" or the tournament date. */
  subtitle?: string
  /** Data URL of the league / tournament logo. The eFootball logo is used when empty. */
  logo?: string
  /** Facts shown as tiles, up to 3. */
  facts: { value: string; label: string }[]
  /** Short sentence of rules under the tiles. */
  rules: string
  link: string
  /** Text printed above the QR. */
  cta: string
}

/** Draws the invite card. The QR code holds the link, so the card works from a screenshot or a WhatsApp status. */
export async function drawInvite(spec: InviteSpec, qrDataUrl: string, fallbackLogo: string): Promise<HTMLCanvasElement> {
  const w = 1080, h = 1500
  const c = document.createElement('canvas'); c.width = w; c.height = h
  const g = c.getContext('2d')!
  const gold = '#e8b923'
  const [logo, qr] = await Promise.all([loadImg(spec.logo || fallbackLogo), loadImg(qrDataUrl)])
  const bg = g.createLinearGradient(0, 0, w, h)
  bg.addColorStop(0, '#1f5a38'); bg.addColorStop(0.5, '#0f1d16'); bg.addColorStop(1, '#0a130e')
  g.fillStyle = bg; g.fillRect(0, 0, w, h)
  // pitch lines: a centre circle and halfway line, drawn very faintly
  g.strokeStyle = 'rgba(255,255,255,0.07)'; g.lineWidth = 6
  g.beginPath(); g.moveTo(0, 560); g.lineTo(w, 560); g.stroke()
  g.beginPath(); g.arc(w / 2, 560, 230, 0, Math.PI * 2); g.stroke()
  g.fillStyle = 'rgba(255,255,255,0.07)'; g.beginPath(); g.arc(w / 2, 560, 10, 0, Math.PI * 2); g.fill()

  g.textAlign = 'center'; g.textBaseline = 'alphabetic'
  g.fillStyle = gold; g.font = '800 30px Manrope, Arial, sans-serif'
  g.fillText(spec.kind === 'league' ? 'You are invited to a league' : 'Weekly knockout', w / 2, 120)

  // logo disc
  const s = 280, cx = w / 2, cy = 330
  g.save(); g.beginPath(); g.arc(cx, cy, s / 2 + 10, 0, Math.PI * 2); g.fillStyle = gold; g.fill(); g.restore()
  g.save(); g.beginPath(); g.arc(cx, cy, s / 2, 0, Math.PI * 2); g.clip(); g.fillStyle = '#fff'; g.fillRect(cx - s / 2, cy - s / 2, s, s)
  if (logo) { const k = Math.max(s / logo.width, s / logo.height); g.drawImage(logo, cx - (logo.width * k) / 2, cy - (logo.height * k) / 2, logo.width * k, logo.height * k) }
  g.restore()

  // title (up to 2 lines, shrinks to fit)
  g.fillStyle = '#fff'
  let size = 84; const maxW = w - 140
  const lines = (): string[] => {
    g.font = `800 ${size}px Manrope, Arial, sans-serif`
    const out: string[] = []; let cur = ''
    for (const word of spec.title.split(' ')) { const t = cur ? `${cur} ${word}` : word; if (g.measureText(t).width > maxW && cur) { out.push(cur); cur = word } else cur = t }
    if (cur) out.push(cur); return out
  }
  let L = lines(); while (L.length > 2 && size > 44) { size -= 6; L = lines() }
  L.slice(0, 2).forEach((l, i) => g.fillText(i === 1 && L.length > 2 ? fit(g, l, maxW) : l, w / 2, 590 + i * (size + 10)))
  const ty = 590 + (Math.min(L.length, 2) - 1) * (size + 10)
  if (spec.subtitle) { g.fillStyle = '#cfe8d8'; g.font = '500 32px Manrope, Arial, sans-serif'; g.fillText(fit(g, spec.subtitle, maxW), w / 2, ty + 60) }

  // fact tiles
  const f = spec.facts.slice(0, 3), gap = 20, fw = (w - 140 - gap * (f.length - 1)) / Math.max(1, f.length), fy = ty + 110
  f.forEach((x, i) => {
    const fx = 70 + i * (fw + gap)
    g.fillStyle = 'rgba(255,255,255,0.09)'; round(g, fx, fy, fw, 130, 26); g.fill()
    g.fillStyle = '#fff'; g.font = '800 44px Manrope, Arial, sans-serif'; g.fillText(fit(g, x.value, fw - 24), fx + fw / 2, fy + 60)
    g.fillStyle = '#cfe8d8'; g.font = '500 24px Manrope, Arial, sans-serif'; g.fillText(fit(g, x.label, fw - 24), fx + fw / 2, fy + 100)
  })
  g.fillStyle = '#cfe8d8'; g.font = '500 28px Manrope, Arial, sans-serif'; g.fillText(fit(g, spec.rules, w - 140), w / 2, fy + 190)

  // QR panel
  const qs = 330, qy = h - 520
  g.fillStyle = '#fff'; round(g, w / 2 - qs / 2 - 26, qy - 26, qs + 52, qs + 52, 34); g.fill()
  if (qr) g.drawImage(qr, w / 2 - qs / 2, qy, qs, qs)
  g.fillStyle = gold; g.font = '800 34px Manrope, Arial, sans-serif'; g.fillText(spec.cta, w / 2, qy - 56)
  g.fillStyle = '#fff'; g.font = '700 26px Manrope, Arial, sans-serif'; g.fillText(fit(g, spec.link.replace(/^https?:\/\//, ''), w - 120), w / 2, qy + qs + 90)
  g.fillStyle = gold; g.fillRect(w / 2 - 45, h - 130, 90, 6)
  g.fillStyle = '#fff'; g.font = '800 30px Manrope, Arial, sans-serif'; g.fillText('Chuka Comrades · eFootball', w / 2, h - 70)
  return c
}

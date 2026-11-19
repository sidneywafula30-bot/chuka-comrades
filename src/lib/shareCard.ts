/* Draws a confession as a picture, like NGL's share card: gradient story background,
 * one big white card with the gradient header, the words, and a "send yours" footer.
 * The picture is what gets shared to WhatsApp (Status, chats, groups). */

export const CAT_COLORS: Record<string, [string, string]> = {
  spicy: ['#ff5a3c', '#ff2d75'],
  heartbreak: ['#ff2d75', '#a62bd6'],
  academics: ['#3b82f6', '#6d4aff'],
  funny: ['#ffb100', '#ff6a00'],
  deep: ['#6d4aff', '#2b1b8a'],
  other: ['#2dd4bf', '#3b82f6'],
}
export const catColors = (c: string): [string, string] => CAT_COLORS[c] || CAT_COLORS.other
export const catGradient = (c: string) => { const [a, b] = catColors(c); return `linear-gradient(135deg,${a},${b})` }

export type CardPost = { number: number; category: string; categoryLabel: string; text: string }

function wrap(g: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = []
  for (const para of text.split('\n')) {
    if (!para.trim()) { out.push(''); continue }
    let line = ''
    for (const word of para.split(/\s+/)) {
      let w = word
      // a single very long word is broken by characters
      while (g.measureText(w).width > maxW) {
        let k = w.length
        while (k > 1 && g.measureText(w.slice(0, k)).width > maxW) k--
        if (line) { out.push(line); line = '' }
        out.push(w.slice(0, k)); w = w.slice(k)
      }
      const test = line ? `${line} ${w}` : w
      if (g.measureText(test).width <= maxW) line = test
      else { out.push(line); line = w }
    }
    if (line) out.push(line)
  }
  return out
}

function rr(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath(); g.moveTo(x + r, y)
  g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r)
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath()
}

function loadLogo(): Promise<HTMLImageElement | null> {
  return new Promise((ok) => {
    const im = new Image()
    im.onload = () => ok(im)
    im.onerror = () => ok(null)
    im.src = `${import.meta.env.BASE_URL}ozone.jfif`
  })
}

/** `text` must already have video links taken out. `site` is the short address shown at the bottom. */
export async function confessionImage(p: CardPost, text: string, site: string): Promise<Blob> {
  const FONT = "'Manrope', 'Segoe UI', Roboto, Arial, sans-serif"
  try { await Promise.all([document.fonts.load(`800 40px ${FONT}`), document.fonts.load(`600 40px ${FONT}`)]) } catch { /* fall back to system font */ }
  const logo = await loadLogo()

  const W = 1080, CX = 70, CW = W - CX * 2, PAD = 62, HEAD = 170, LH = 70, MAXL = 15
  const probe = document.createElement('canvas').getContext('2d')
  if (!probe) throw new Error('Could not draw the picture on this device.')
  probe.font = `700 54px ${FONT}`
  let lines = wrap(probe, text.trim() || '🎬 Shared a video. Watch it on Chuka O-Zone.', CW - PAD * 2)
  if (lines.length > MAXL) { lines = lines.slice(0, MAXL); lines[MAXL - 1] = `${lines[MAXL - 1].replace(/\s+\S*$/, '')}…` }

  const FOOT = 230
  const cardH = HEAD + 70 + lines.length * LH + 60 + FOOT
  const H = Math.max(1920, cardH + 440)
  const c = document.createElement('canvas'); c.width = W; c.height = H
  const g = c.getContext('2d')
  if (!g) throw new Error('Could not draw the picture on this device.')

  // story background
  const bg = g.createLinearGradient(0, 0, W * 0.55, H)
  bg.addColorStop(0, '#ff7a18'); bg.addColorStop(0.48, '#ff2d75'); bg.addColorStop(1, '#8b2fd6')
  g.fillStyle = bg; g.fillRect(0, 0, W, H)

  const cy = Math.round((H - cardH) / 2) - 30
  // card shadow + body
  g.save(); g.shadowColor = 'rgba(0,0,0,.28)'; g.shadowBlur = 60; g.shadowOffsetY = 26
  g.fillStyle = '#fff'; rr(g, CX, cy, CW, cardH, 64); g.fill(); g.restore()

  // gradient header
  const [c1, c2] = catColors(p.category)
  g.save(); rr(g, CX, cy, CW, cardH, 64); g.clip()
  const hg = g.createLinearGradient(CX, cy, CX + CW, cy + HEAD); hg.addColorStop(0, c1); hg.addColorStop(1, c2)
  g.fillStyle = hg; g.fillRect(CX, cy, CW, HEAD); g.restore()

  // avatar
  const ax = CX + PAD + 52, ay = cy + HEAD / 2
  g.save(); g.beginPath(); g.arc(ax, ay, 52, 0, Math.PI * 2); g.closePath(); g.fillStyle = '#fff'; g.fill(); g.clip()
  if (logo) g.drawImage(logo, ax - 52, ay - 52, 104, 104)
  g.restore()
  g.fillStyle = '#fff'; g.textBaseline = 'alphabetic'; g.textAlign = 'left'
  g.font = `800 46px ${FONT}`; g.fillText('@chuka.ozone', ax + 52 + 28, ay - 6)
  g.font = `600 31px ${FONT}`; g.globalAlpha = 0.92
  g.fillText(`${p.categoryLabel || 'confession'}  ·  #${String(p.number).padStart(4, '0')}`, ax + 52 + 28, ay + 38); g.globalAlpha = 1

  // the confession
  g.fillStyle = '#111'; g.font = `700 54px ${FONT}`
  let y = cy + HEAD + 70 + 46
  for (const ln of lines) { g.fillText(ln, CX + PAD, y); y += LH }

  // footer
  const fy = cy + cardH - FOOT
  g.fillStyle = '#eeeef2'; g.fillRect(CX + PAD, fy, CW - PAD * 2, 3)
  g.textAlign = 'center'
  const mid = CX + CW / 2
  g.fillStyle = '#111'; g.font = `800 44px ${FONT}`; g.fillText('👇 send your own confession', mid, fy + 88)
  g.fillStyle = '#111'; rr(g, mid - 250, fy + 118, 500, 84, 42); g.fill()
  g.fillStyle = '#fff'; g.font = `800 36px ${FONT}`; g.fillText('Send anonymously!', mid, fy + 174)

  // site name under the card
  g.fillStyle = '#fff'; g.font = `800 42px ${FONT}`; g.fillText('Chuka O-Zone', mid, cy + cardH + 120)
  g.font = `600 33px ${FONT}`; g.globalAlpha = 0.9; g.fillText(site, mid, cy + cardH + 172); g.globalAlpha = 1

  return new Promise((ok, no) => c.toBlob((b) => (b ? ok(b) : no(new Error('Could not make the picture.'))), 'image/png'))
}

/** True when this browser can hand a picture to the phone's share sheet (WhatsApp, Status, ...). */
export function canShareFiles(): boolean {
  try { return !!navigator.canShare && navigator.canShare({ files: [new File([''], 'x.png', { type: 'image/png' })] }) } catch { return false }
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

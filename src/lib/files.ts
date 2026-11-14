/** Shrinks a chosen image to a JPEG data URL (white background) so uploads stay small. */
export function shrinkImage(file: File, max = 512, quality = 0.85): Promise<string> {
  return new Promise((ok, no) => {
    const url = URL.createObjectURL(file)
    const im = new Image()
    im.onload = () => {
      const s = Math.min(1, max / Math.max(im.width, im.height))
      const c = document.createElement('canvas')
      c.width = Math.round(im.width * s); c.height = Math.round(im.height * s)
      const g = c.getContext('2d')!
      g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height)
      g.drawImage(im, 0, 0, c.width, c.height)
      URL.revokeObjectURL(url)
      ok(c.toDataURL('image/jpeg', quality))
    }
    im.onerror = () => no(new Error('bad image'))
    im.src = url
  })
}

/** Reads any file as base64 (no data: prefix). */
export function fileToB64(file: File): Promise<string> {
  return new Promise((ok, no) => {
    const r = new FileReader()
    r.onload = () => ok(String(r.result).split(',')[1] ?? '')
    r.onerror = () => no(new Error('Could not read the file'))
    r.readAsDataURL(file)
  })
}

import { useState, type ChangeEvent, type ReactNode } from 'react'
import { Camera } from 'lucide-react'
import { shrinkImage } from '../lib/files'

/** Image chooser with preview. Calls onChange with a JPEG data URL (new pick), or removed=true. */
export default function ImagePicker({ current, fallback, label, max = 400, round, onChange }: {
  current: string; fallback: ReactNode; label: string; max?: number; round?: boolean
  onChange: (v: { data: string; removed: boolean }) => void
}) {
  const [data, setData] = useState('')
  const [removed, setRemoved] = useState(false)
  const [err, setErr] = useState('')
  const shown = data || (removed ? '' : current)

  async function pick(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    try { const d = await shrinkImage(f, max); setData(d); setRemoved(false); setErr(''); onChange({ data: d, removed: false }) }
    catch { setErr('Could not read that image.') }
  }
  function remove() { setData(''); setRemoved(true); onChange({ data: '', removed: true }) }

  return (
    <div className="cpl-imgpick">
      <div className={`cpl-imgpick-prev${round ? ' round' : ''}`}>{shown ? <img src={shown} alt="Preview" /> : fallback}</div>
      <div className="cpl-imgpick-ctl">
        <label className="cpl-upload"><Camera size={15} /> {shown ? `Change ${label}` : `Upload ${label}`}
          <input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={pick} />
        </label>
        {shown && <button type="button" className="cpl-linkbtn" onClick={remove}>Remove</button>}
        {err && <small className="cpl-msg bad">{err}</small>}
      </div>
    </div>
  )
}

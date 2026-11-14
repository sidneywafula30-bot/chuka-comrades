import { useState, type ReactNode } from 'react'
import { ArrowLeft, CheckCircle2, FileText, FolderOpen, LoaderCircle, Paperclip, X } from 'lucide-react'
import { openAttachment, type Attachment, type Call, type FileRules, type Note, errMsg } from '../lib/hub'
import '../pages/StudyLabs.css'
import '../pages/Hub.css'

/** Small UI kit shared by Gigs and Skills (re-uses the Study Labs look). */
export function Msg({ msg }: { msg: Note }) {
  if (!msg) return null
  return <p className={`sl-alert ${msg.type === 'ok' ? 'ok' : 'err'}`}>{msg.type === 'ok' && <CheckCircle2 size={16} />}{msg.text}</p>
}
export function Loading({ text = 'Loading…' }: { text?: string }) {
  return <div className="sl-empty"><LoaderCircle className="sl-spin" size={22} /><span>{text}</span></div>
}
export function Empty({ icon, title, text }: { icon?: ReactNode; title: string; text?: string }) {
  return <div className="sl-empty">{icon ?? <FolderOpen size={26} />}<h3>{title}</h3>{text && <p>{text}</p>}</div>
}
export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="sl-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="sl-modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="sl-modal-head"><h2>{title}</h2><button className="sl-icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button></div>
        {children}
      </div>
    </div>
  )
}
export function StatusBadge({ s }: { s: 'pending' | 'approved' | 'rejected' }) {
  return <span className={`sl-badge ${s}`}>{s === 'pending' ? 'Pending review' : s === 'approved' ? 'Approved' : 'Rejected'}</span>
}

type ShellProps = { name: string; sub: string; logo: string; backLabel: string; onBack: () => void; nav: ReactNode; children: ReactNode }
export function HubShell({ name, sub, logo, backLabel, onBack, nav, children }: ShellProps) {
  return (
    <div className="sl-shell">
      <div className="sl-topbar">
        <button className="sl-back" onClick={onBack}><ArrowLeft size={18} /> {backLabel}</button>
        <div className="sl-brand"><span className="has-logo"><img src={`${import.meta.env.BASE_URL}${logo}`} alt={`${name} logo`} /></span><div><strong>{name}</strong><small>{sub}</small></div></div>
        <nav className="sl-nav">{nav}</nav>
      </div>
      {children}
    </div>
  )
}

const kb = (n: number) => (n >= 1024 ? `${(n / 1024).toFixed(1)} MB` : `${n} KB`)

/** Attachment list; each file opens through the server (files are private to signed-in people who may see them). */
export function AttachList({ items, call, onError }: { items: Attachment[]; call: Call; onError: (m: string) => void }) {
  const [busy, setBusy] = useState('')
  if (!items.length) return null
  return (
    <ul className="sl-files">
      {items.map((f) => (
        <li key={f.id}>
          <span className="sl-file-ico"><FileText size={18} /></span>
          <span className="sl-file-name"><strong>{f.name}</strong><small>{kb(f.sizeKB)}</small></span>
          <button className="sl-mini" disabled={busy === f.id} onClick={async () => { setBusy(f.id); try { await openAttachment(call, f.id) } catch (e) { onError(errMsg(e)) } finally { setBusy('') } }}>{busy === f.id ? '…' : 'Open'}</button>
        </li>
      ))}
    </ul>
  )
}

type PickerProps = {
  files: File[]; setFiles: (f: File[]) => void; rules: FileRules; onError: (m: string) => void
  existing?: Attachment[]; removeIds?: string[]; setRemoveIds?: (ids: string[]) => void
}
/** File chooser with the same rules as the server (count, size, allowed types). Handles existing files when editing. */
export function FilePicker({ files, setFiles, rules, onError, existing = [], removeIds = [], setRemoveIds }: PickerProps) {
  const kept = existing.filter((e) => !removeIds.includes(e.id)).length
  const allowed = rules.extensions
  function pick(list: FileList | null) {
    if (!list) return
    const add = Array.from(list)
    if (files.length + kept + add.length > rules.maxFiles) return onError(`You can attach up to ${rules.maxFiles} files.`)
    for (const f of add) {
      const ext = f.name.split('.').pop()?.toLowerCase() ?? ''
      if (!allowed.includes(ext)) return onError(`.${ext || '?'} files are not allowed. Allowed: ${allowed.join(', ')}.`)
      if (f.size > rules.maxFileMB * 1024 * 1024 && !f.type.startsWith('image/')) return onError(`${f.name} is over ${rules.maxFileMB} MB.`)
    }
    setFiles([...files, ...add])
  }
  return (
    <>
      <label className="sl-drop"><Paperclip size={18} /> Attach files (optional)
        <input type="file" multiple accept={allowed.map((x) => `.${x}`).join(',')} onChange={(e) => { pick(e.target.files); e.target.value = '' }} />
        <small>Up to {rules.maxFiles} files, {rules.maxFileMB} MB each (PDF, Word, PowerPoint, Excel, text or photos). Photos are shrunk automatically.</small>
      </label>
      {(existing.length > 0 || files.length > 0) && (
        <ul className="sl-picked">
          {existing.map((e) => (
            <li key={e.id} style={{ opacity: removeIds.includes(e.id) ? 0.4 : 1 }}><FileText size={14} /><span>{e.name}</span>
              <button type="button" className="sl-mini ghost" onClick={() => setRemoveIds?.(removeIds.includes(e.id) ? removeIds.filter((x) => x !== e.id) : [...removeIds, e.id])}>{removeIds.includes(e.id) ? 'Keep' : 'Remove'}</button></li>
          ))}
          {files.map((f, i) => (
            <li key={`${f.name}${i}`}><FileText size={14} /><span>{f.name}</span>
              <button type="button" className="sl-icon-btn" onClick={() => setFiles(files.filter((_, j) => j !== i))} aria-label="Remove"><X size={14} /></button></li>
          ))}
        </ul>
      )}
    </>
  )
}

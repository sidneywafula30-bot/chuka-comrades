import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { ArrowRight, CheckCircle2, Circle, Code2, Download, ExternalLink, Laptop, Pencil, Plus, Trash2, Youtube } from 'lucide-react'
import { skillsApi, skillsReady, SW_PLATFORMS, type Software, type SoftwareInput, type SoftwarePrice } from '../lib/skills'
import { LEARN_PATHS, type LearnPath } from '../lib/learnPaths'
import { errMsg, type Note } from '../lib/hub'
import { Empty, Loading, Modal, Msg } from '../components/HubUi'
import '../components/Cit.css'

/* ---------- Software you need (the admin manages the list) ---------- */
export function SoftwareList({ limit, onAll }: { limit?: number; onAll?: () => void }) {
  const [items, setItems] = useState<Software[] | null>(null)
  const [msg, setMsg] = useState<Note>(null)
  useEffect(() => {
    if (!skillsReady) { setItems([]); return }
    skillsApi.software().then(setItems).catch((e) => { setMsg({ type: 'err', text: errMsg(e) }); setItems([]) })
  }, [])
  const shown = items && (limit ? items.slice(0, limit) : items)
  return (
    <>
      <Msg msg={msg} />
      {!shown ? <Loading /> : shown.length === 0 ? <Empty icon={<Download size={26} />} title="No software listed yet" text="The admin will add the apps you need for the classes here." /> : (
        <div className="cit-sw-grid">
          {shown.map((s) => (
            <article className="cit-sw" key={s.id}>
              <div className="cit-sw-top">
                <span className="cit-sw-icon" aria-hidden>{s.name.trim().charAt(0).toUpperCase()}</span>
                <div><h3>{s.name}</h3><small>{s.platform === 'All' ? 'All devices' : s.platform}</small></div>
                <span className={`cit-tag ${s.price === 'Paid' ? 'paid' : 'free'}`}>{s.price}</span>
              </div>
              <p>{s.description}</p>
              {s.note && <p className="cit-sw-note">{s.note}</p>}
              <a className="sl-primary small cit-sw-btn" href={s.url} target="_blank" rel="noreferrer noopener"><Download size={14} /> Get {s.name.length > 18 ? 'it' : s.name}</a>
            </article>
          ))}
        </div>
      )}
      {onAll && items && limit && items.length > limit && <p style={{ marginTop: 12 }}><button className="sl-mini" onClick={onAll}>See all {items.length} apps <ArrowRight size={13} /></button></p>}
    </>
  )
}

/* ---------- Admin: add, edit, hide and delete software ---------- */
function SoftwareModal({ item, onClose, onDone }: { item?: Software; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState(item?.name ?? '')
  const [description, setDescription] = useState(item?.description ?? '')
  const [url, setUrl] = useState(item?.url ?? '')
  const [platform, setPlatform] = useState(item?.platform ?? 'All')
  const [price, setPrice] = useState<SoftwarePrice>(item?.price ?? 'Free')
  const [note, setNote] = useState(item?.note ?? '')
  const [sort, setSort] = useState(String(item?.sort ?? 100))
  const [status, setStatus] = useState<'live' | 'hidden'>(item?.status ?? 'live')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<Note>(null)
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setMsg(null)
    const input: SoftwareInput = { id: item?.id, name: name.trim(), description: description.trim(), url: url.trim(), platform, price, note: note.trim(), sort: Number(sort) || 100, status }
    try { await skillsApi.admin.saveSoftware(input); onDone(); onClose() } catch (err) { setMsg({ type: 'err', text: errMsg(err) }) } finally { setBusy(false) }
  }
  return (
    <Modal title={item ? 'Edit software' : 'Add software'} onClose={onClose}>
      <form className="sl-form" onSubmit={submit}>
        <label>Name<input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="e.g. Visual Studio Code" /></label>
        <label>Why do students need it?<textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={400} /></label>
        <label>Download or website link<input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" /></label>
        <div className="sl-two">
          <label>Works on<select value={platform} onChange={(e) => setPlatform(e.target.value)}>{SW_PLATFORMS.map((p) => <option key={p} value={p}>{p === 'All' ? 'All devices' : p}</option>)}</select></label>
          <label>Price<select value={price} onChange={(e) => setPrice(e.target.value as SoftwarePrice)}><option>Free</option><option>Free trial</option><option>Paid</option></select></label>
        </div>
        <label>Tip for students (optional)<input value={note} onChange={(e) => setNote(e.target.value)} maxLength={150} placeholder="e.g. Choose the 64-bit installer" /></label>
        <div className="sl-two">
          <label>Order (small number shows first)<input type="number" min={0} max={9999} value={sort} onChange={(e) => setSort(e.target.value)} /></label>
          <label>Visibility<select value={status} onChange={(e) => setStatus(e.target.value as 'live' | 'hidden')}><option value="live">Visible to students</option><option value="hidden">Hidden</option></select></label>
        </div>
        <Msg msg={msg} />
        <button className="sl-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
      </form>
    </Modal>
  )
}

export function AdminSoftware({ tick }: { tick: number }) {
  const [items, setItems] = useState<Software[] | null>(null)
  const [edit, setEdit] = useState<Software | 'new' | null>(null)
  const [msg, setMsg] = useState<Note>(null)
  const load = useCallback(() => skillsApi.admin.software().then(setItems).catch((e) => { setMsg({ type: 'err', text: errMsg(e) }); setItems([]) }), [])
  useEffect(() => { void load() }, [load, tick])
  async function remove(s: Software) {
    if (!window.confirm(`Remove “${s.name}” from the list?`)) return
    try { await skillsApi.admin.deleteSoftware(s.id); await load() } catch (e) { setMsg({ type: 'err', text: errMsg(e) }) }
  }
  return (
    <>
      <div className="hub-sec"><h2>Software students need</h2><button className="sl-primary small" onClick={() => setEdit('new')}><Plus size={15} /> Add software</button></div>
      <p className="sl-sub" style={{ marginTop: 0 }}>Students see these on the Software page. Hide an app to keep it without showing it.</p>
      <Msg msg={msg} />
      {!items ? <Loading /> : items.length === 0 ? <Empty icon={<Download size={26} />} title="No software yet" text="Add the first app students should install." /> : (
        <div className="cit-sw-grid">
          {items.map((s) => (
            <article className={`cit-sw ${s.status === 'hidden' ? 'hidden' : ''}`} key={s.id}>
              <div className="cit-sw-top"><span className="cit-sw-icon" aria-hidden>{s.name.trim().charAt(0).toUpperCase()}</span><div><h3>{s.name}</h3><small>{s.platform === 'All' ? 'All devices' : s.platform} · order {s.sort}</small></div>
                <span className={`cit-tag ${s.price === 'Paid' ? 'paid' : 'free'}`}>{s.status === 'hidden' ? 'Hidden' : s.price}</span></div>
              <p>{s.description}</p>
              <span className="sl-foot-actions"><button className="sl-mini" onClick={() => setEdit(s)}><Pencil size={13} /> Edit</button><button className="sl-mini danger" onClick={() => remove(s)}><Trash2 size={13} /> Delete</button></span>
            </article>
          ))}
        </div>
      )}
      {edit && <SoftwareModal item={edit === 'new' ? undefined : edit} onClose={() => setEdit(null)} onDone={() => void load()} />}
    </>
  )
}

/* ---------- Learn VS Code / Learn Computer paths ---------- */
const store = (id: string) => `cit-path-${id}`
const readDone = (id: string): number[] => { try { return JSON.parse(localStorage.getItem(store(id)) || '[]') as number[] } catch { return [] } }
const ICONS = { vscode: Code2, computer: Laptop }

export function PathCards({ onOpen }: { onOpen: (id: LearnPath['id']) => void }) {
  return (
    <div className="cit-paths">
      {LEARN_PATHS.map((p) => {
        const Icon = ICONS[p.id]
        const done = readDone(p.id).length
        return (
          <button key={p.id} className={`cit-path ${p.id}`} onClick={() => onOpen(p.id)}>
            <span className="cit-path-icon"><Icon size={26} /></span>
            <span className="cit-path-body">
              <b>{p.title}</b>
              <span>{p.tagline}</span>
              <small>{p.steps.length} steps · {p.level}{done ? ` · ${done}/${p.steps.length} done` : ''}</small>
            </span>
            <ArrowRight size={18} />
          </button>
        )
      })}
    </div>
  )
}

export function PathPage({ path, onSeeContent, onSoftware }: { path: LearnPath; onSeeContent: (category: string) => void; onSoftware: () => void }) {
  const [done, setDone] = useState<number[]>(() => readDone(path.id))
  const Icon = ICONS[path.id]
  const toggle = (i: number) => {
    const next = done.includes(i) ? done.filter((x) => x !== i) : [...done, i]
    setDone(next)
    try { localStorage.setItem(store(path.id), JSON.stringify(next)) } catch { /* private mode: progress just is not saved */ }
  }
  const pct = Math.round((done.length / path.steps.length) * 100)
  return (
    <>
      <section className={`sl-hero cit-hero ${path.id}`}>
        <div><span className="sl-kicker">LEARNING PATH · {path.level.toUpperCase()}</span><h1>{path.title}</h1><p>{path.tagline}</p>
          <div className="cit-hero-actions">
            <button className="sl-primary small" onClick={() => onSeeContent(path.category)}>Videos &amp; classes <ArrowRight size={14} /></button>
            <button className="sl-mini cit-light" onClick={onSoftware}><Download size={13} /> Software you need</button>
          </div>
        </div>
        <div className="sl-hero-art"><Icon size={46} /><span>{pct}% done</span></div>
      </section>
      <div className="cit-progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${pct}%` }} /></div>
      <ol className="cit-steps">
        {path.steps.map((s, i) => {
          const on = done.includes(i)
          return (
            <li key={s.title} className={on ? 'done' : ''}>
              <button className="cit-check" onClick={() => toggle(i)} aria-label={on ? `Mark “${s.title}” not done` : `Mark “${s.title}” done`}>{on ? <CheckCircle2 size={24} /> : <Circle size={24} />}</button>
              <div>
                <h3><span>{i + 1}</span> {s.title}</h3>
                <p>{s.text}</p>
                <a className="sl-mini ghost" href={`https://www.youtube.com/results?search_query=${encodeURIComponent(s.search)}`} target="_blank" rel="noreferrer noopener"><Youtube size={13} /> Watch tutorials <ExternalLink size={12} /></a>
              </div>
            </li>
          )
        })}
      </ol>
    </>
  )
}

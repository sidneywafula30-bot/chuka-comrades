import { useState, type FormEvent } from 'react'
import { BookOpen, Check, Copy, ExternalLink, LoaderCircle, Search } from 'lucide-react'
import type { User } from 'firebase/auth'
import { labsApi, type WikiPage } from '../lib/labs'

const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong. Please try again.')

type Props = {
  user: User | null
  onSignIn: () => void
  /** Pre-filled search text, usually the unit name. */
  defaultQuery?: string
  chips?: string[]
}

/** Wikipedia explanations for a unit or topic. Text is CC BY-SA, so every card links back to the article. */
export default function WikiPanel({ user, onSignIn, defaultQuery = '', chips = [] }: Props) {
  const [q, setQ] = useState(defaultQuery)
  const [list, setList] = useState<WikiPage[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [copied, setCopied] = useState(0)

  async function run(text: string) {
    const term = text.trim()
    if (term.length < 2) return setErr('Type at least 2 letters to search.')
    setBusy(true); setErr('')
    try { setList(await labsApi.wikiSearch(term)) } catch (e) { setErr(errMsg(e)); setList(null) } finally { setBusy(false) }
  }
  function submit(e: FormEvent) { e.preventDefault(); void run(q) }
  async function copy(p: WikiPage) {
    try { await navigator.clipboard.writeText(p.url) } catch { window.prompt('Copy this link', p.url) }
    setCopied(p.pageId); setTimeout(() => setCopied(0), 1800)
  }

  if (!user) {
    return (
      <div className="sl-empty">
        <BookOpen size={26} />
        <h3>Look it up on Wikipedia</h3>
        <p>Sign in with Google to search Wikipedia for topics in this unit.</p>
        <button className="sl-primary small" onClick={onSignIn}>Sign in</button>
      </div>
    )
  }

  return (
    <div className="sl-wiki">
      <form className="sl-search" onSubmit={submit}>
        <Search size={18} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search Wikipedia for a topic…" maxLength={80} />
        <button className="sl-primary small" disabled={busy}>{busy ? '…' : 'Search'}</button>
      </form>
      {chips.length > 0 && (
        <div className="sl-chips">
          {chips.map((c) => <button key={c} type="button" className="sl-chip btn" onClick={() => { setQ(c); void run(c) }}>{c}</button>)}
        </div>
      )}
      {err && <p className="sl-alert err">{err}</p>}
      {busy && <div className="sl-empty"><LoaderCircle className="sl-spin" size={22} /><span>Searching Wikipedia…</span></div>}
      {!busy && list && list.length === 0 && <p className="sl-sub">Nothing found. Try different words.</p>}
      {!busy && list && list.length > 0 && (
        <div className="sl-wiki-list">
          {list.map((p) => (
            <article key={p.pageId} className="sl-wiki-card">
              {p.thumbnail && <img src={p.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" />}
              <div>
                <h4>{p.title}</h4>
                <p>{p.extract}</p>
                <div className="sl-foot-actions">
                  <a className="sl-mini" href={p.url} target="_blank" rel="noreferrer noopener"><ExternalLink size={12} /> Read on Wikipedia</a>
                  <button className="sl-mini ghost" onClick={() => void copy(p)}>{copied === p.pageId ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy link</>}</button>
                </div>
              </div>
            </article>
          ))}
          <small className="sl-sub">Text from Wikipedia, available under CC BY-SA.</small>
        </div>
      )}
    </div>
  )
}

import { useCallback, useEffect, useState } from 'react'
import { EyeOff, ExternalLink } from 'lucide-react'
import { ago, oz, type NewsItem, type NewsList } from '../lib/ozone'
import { Err, ShareButton, type OzCtx } from './OzCommon'

function Story({ n, admin, onHide }: { n: NewsItem; admin: boolean; onHide: () => void }) {
  const [bad, setBad] = useState(false)
  return (
    <article className="cpl-card nw-card">
      {n.image && !bad && (
        <a className="nw-img" href={n.url} target="_blank" rel="noopener noreferrer nofollow" aria-label={`Read: ${n.title}`}>
          <img src={n.image} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBad(true)} />
        </a>
      )}
      <div className="nw-body">
        <header className="nw-meta">
          <b>{n.source}</b>
          {n.topic === 'politics' && <span className="oz-pill blue">Politics</span>}
          <small>{ago(n.publishedAt)}</small>
        </header>
        <h3><a href={n.url} target="_blank" rel="noopener noreferrer nofollow">{n.title}</a></h3>
        {n.summary && <p>{n.summary}</p>}
        <div className="oz-actions">
          <a className="tr-open" href={n.url} target="_blank" rel="noopener noreferrer nofollow"><ExternalLink size={13} /> Read at {n.source}</a>
          <ShareButton text={`${n.title} (${n.source})`} url={n.url} />
          {admin && <button type="button" className="oz-ghost" onClick={onHide}><EyeOff size={13} /> Hide</button>}
        </div>
      </div>
    </article>
  )
}

export default function News({ ctx }: { ctx: OzCtx }) {
  const [topic, setTopic] = useState<'' | 'politics'>('')
  const [items, setItems] = useState<NewsItem[]>([])
  const [next, setNext] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [note, setNote] = useState('')
  const [fetchedAt, setFetchedAt] = useState('')

  const load = useCallback(async (offset: number) => {
    setLoading(true)
    try {
      const r = await oz<NewsList>('news_list', { topic: topic || undefined, offset })
      setItems((p) => (offset === 0 ? r.items : [...p, ...r.items.filter((n) => !p.some((x) => x.id === n.id))]))
      setNext(r.next); setNote(r.note); setFetchedAt(r.fetchedAt); setErr('')
    } catch (e) { setErr((e as Error).message) }
    finally { setLoading(false) }
  }, [topic])
  useEffect(() => { setItems([]); void load(0) }, [load])

  async function hide(id: string) {
    try { await oz('admin_news_hide', { id }); setItems((p) => p.filter((n) => n.id !== id)) }
    catch (e) { setErr((e as Error).message) }
  }

  return (
    <div className="oz-wrap">
      <h2>Campus & Kenya news</h2>
      <p className="cpl-sub">Headlines from news sites. We only show the headline and a short snippet; tap a story to read it at the source.</p>
      <nav className="ef-tabs" aria-label="News topics">
        <button type="button" className={topic === '' ? 'on' : ''} onClick={() => setTopic('')}>Latest</button>
        <button type="button" className={topic === 'politics' ? 'on' : ''} onClick={() => setTopic('politics')}>Politics</button>
      </nav>
      <Err msg={err ? `News could not load: ${err}` : ''} />
      <div className="oz-list">
        {items.map((n) => <Story key={n.id} n={n} admin={Boolean(ctx.me?.isAdmin)} onHide={() => void hide(n.id)} />)}
        {!loading && !err && !items.length && <p className="cpl-empty">No stories right now. Check back soon.</p>}
      </div>
      {loading && <p className="cpl-empty">Loading…</p>}
      {!loading && err && <button type="button" className="lp-btn lp-btn-soft oz-more" onClick={() => void load(0)}>Retry</button>}
      {!loading && next !== null && <button type="button" className="lp-btn lp-btn-soft oz-more" onClick={() => void load(next)}>Load more</button>}
      <p className="cpl-note nw-note">{note}{fetchedAt && ` Updated ${ago(fetchedAt)}.`} Stories are shown as published by their sources; O-Zone does not endorse them.</p>
    </div>
  )
}

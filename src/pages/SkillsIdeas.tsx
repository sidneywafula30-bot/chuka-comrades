import { useCallback, useEffect, useState, type FormEvent } from 'react'
import type { User } from 'firebase/auth'
import { ChevronUp, ExternalLink, Lightbulb, MessageCircle, Pin, Plus, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { fmtDate, type Note } from '../lib/hub'
import { Empty, Loading, Modal, Msg } from '../components/HubUi'
import { ChatRoom } from '../components/CitChat'
import { BskyDiscussion, ShareBar } from '../components/Bluesky'
import type { BskyConfig } from '../lib/bluesky'
import '../components/Cit.css'

type Status = 'open' | 'planned' | 'building' | 'done' | 'hidden'
type Idea = { id: string; user_id: string; user_name: string; title: string; body: string; tags: string[]; link: string; status: Status; pinned: boolean; votes: number; created_at: string }
const STATUS: Record<Status, string> = { open: 'New idea', planned: 'Planned', building: 'Building', done: 'Done', hidden: 'Hidden' }

function IdeaModal({ user, onClose, onDone }: { user: User; onClose: () => void; onDone: () => void }) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [tags, setTags] = useState('')
  const [link, setLink] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<Note>(null)
  async function submit(e: FormEvent) {
    e.preventDefault(); if (!supabase) return
    setBusy(true); setMsg(null)
    const list = tags.split(',').map((t) => t.trim().replace(/^#/, '').toLowerCase()).filter(Boolean).slice(0, 5)
    const { error } = await supabase.from('cit_ideas').insert({ title: title.trim(), body: body.trim(), tags: list, link: link.trim(), user_name: user.displayName ?? '' })
    setBusy(false)
    if (error) { setMsg({ type: 'err', text: error.message }); return }
    onDone(); onClose()
  }
  return (
    <Modal title="Share a coding idea" onClose={onClose}>
      <form className="sl-form" onSubmit={submit}>
        <label>Idea title<input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} placeholder="e.g. A fee-balance checker for Chuka students" /></label>
        <label>Describe it: what problem does it solve, and how could we build it?<textarea rows={5} value={body} onChange={(e) => setBody(e.target.value)} maxLength={1500} /></label>
        <label>Tags (comma separated, up to 5)<input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="python, mobile app, ai" /></label>
        <label>Link (optional): GitHub repo, design or demo<input type="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://" /></label>
        <Msg msg={msg} />
        <button className="sl-primary" disabled={busy || title.trim().length < 4 || body.trim().length < 10}>{busy ? 'Posting…' : 'Post idea'}</button>
      </form>
    </Modal>
  )
}

export function IdeasBoard({ user, onSignIn, isAdmin, bsky }: { user: User | null; onSignIn: () => void; isAdmin: boolean; bsky?: BskyConfig }) {
  const [items, setItems] = useState<Idea[] | null>(null)
  const [mine, setMine] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState<'all' | Status>('all')
  const [q, setQ] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [add, setAdd] = useState(false)
  const [msg, setMsg] = useState<Note>(null)
  const load = useCallback(async () => {
    if (!supabase || !user) { setItems([]); return }
    const [a, v] = await Promise.all([
      supabase.from('cit_ideas').select('*').order('pinned', { ascending: false }).order('votes', { ascending: false }).order('created_at', { ascending: false }).limit(150),
      supabase.from('cit_idea_votes').select('idea_id'),
    ])
    if (a.error) { setMsg({ type: 'err', text: a.error.message }); setItems([]); return }
    setItems((a.data ?? []) as Idea[]); setMine(new Set(((v.data ?? []) as { idea_id: string }[]).map((x) => x.idea_id)))
  }, [user])
  useEffect(() => { void load() }, [load])

  async function vote(i: Idea) {
    if (!user) return onSignIn()
    if (!supabase) return
    const has = mine.has(i.id)
    setMine((m) => { const n = new Set(m); if (has) n.delete(i.id); else n.add(i.id); return n })
    setItems((l) => l && l.map((x) => (x.id === i.id ? { ...x, votes: Math.max(0, x.votes + (has ? -1 : 1)) } : x)))
    const { error } = has ? await supabase.from('cit_idea_votes').delete().eq('idea_id', i.id) : await supabase.from('cit_idea_votes').insert({ idea_id: i.id })
    if (error) { setMsg({ type: 'err', text: error.message }); void load() }
  }
  async function patch(i: Idea, change: Partial<Pick<Idea, 'status' | 'pinned'>>) {
    if (!supabase) return
    const { error } = await supabase.from('cit_ideas').update(change).eq('id', i.id)
    if (error) setMsg({ type: 'err', text: error.message }); else void load()
  }
  async function remove(i: Idea) {
    if (!supabase || !window.confirm('Delete this idea?')) return
    const { error } = await supabase.from('cit_ideas').delete().eq('id', i.id)
    if (error) setMsg({ type: 'err', text: error.message }); else void load()
  }

  const needle = q.trim().toLowerCase()
  const shown = items?.filter((i) => (filter === 'all' ? i.status !== 'hidden' || isAdmin || i.user_id === user?.uid : i.status === filter) && (!needle || `${i.title} ${i.body} ${i.tags.join(' ')}`.toLowerCase().includes(needle)))
  return (
    <>
      <section className="sl-hero cit-hero ideas">
        <div><span className="sl-kicker">CODING IDEAS · CIT GROUP</span><h1>Got an idea? <em>Let the community build it.</em></h1>
          <p>Share app, website and AI project ideas. Vote for the best ones, discuss them, and team up. The admin turns top ideas into projects and hackathon themes.</p>
          <div className="cit-hero-actions"><button className="sl-primary small" onClick={() => (user ? setAdd(true) : onSignIn())}><Plus size={15} /> Share an idea</button></div></div>
        <div className="sl-hero-art"><Lightbulb size={46} /><span>Ideas</span></div>
      </section>
      <Msg msg={msg} />
      {!supabase ? <p className="cit-note">The ideas board is not connected yet. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env and run the ideas SQL.</p>
        : !user ? <div className="cit-note">Sign in to see and share ideas. <button className="sl-primary small" onClick={onSignIn}>Sign in</button></div> : (
        <>
          <div className="hub-bar"><div className="sl-search"><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search ideas or tags…" /></div></div>
          <div className="hub-chips">{(['all', 'open', 'planned', 'building', 'done'] as const).map((s) => <button key={s} className={filter === s ? 'on' : ''} onClick={() => setFilter(s)}>{s === 'all' ? 'All' : STATUS[s]}</button>)}</div>
          {!shown ? <Loading /> : shown.length === 0 ? <Empty icon={<Lightbulb size={26} />} title="No ideas here yet" text="Be the first to share one." /> : (
            <div className="cit-ideas">{shown.map((i) => (
              <article key={i.id} className={`cit-idea ${i.pinned ? 'pinned' : ''} ${i.status === 'hidden' ? 'hidden' : ''}`}>
                <button className={`cit-vote ${mine.has(i.id) ? 'on' : ''}`} onClick={() => vote(i)} aria-label={mine.has(i.id) ? 'Remove your vote' : 'Vote for this idea'}><ChevronUp size={20} /><b>{i.votes}</b></button>
                <div className="cit-idea-main">
                  <div className="sl-resource-top">{i.pinned && <span className="hub-pay"><Pin size={11} /> Pinned</span>}<span className={`cit-st ${i.status}`}>{STATUS[i.status]}</span>{i.tags.map((t) => <span className="sl-chip" key={t}>#{t}</span>)}</div>
                  <h3>{i.title}</h3>
                  <p className="cit-pre" style={{ margin: 0 }}>{i.body}</p>
                  <small className="sl-sub">By {i.user_name || 'a comrade'} · {fmtDate(i.created_at)}</small>
                  <div className="sl-foot-actions" style={{ marginTop: 8, flexWrap: 'wrap' }}>
                    <button className="sl-mini" onClick={() => setOpenId(openId === i.id ? null : i.id)}><MessageCircle size={13} /> {openId === i.id ? 'Hide discussion' : 'Discuss'}</button>
                    <ShareBar text={`Coding idea: ${i.title}`} tags={i.tags} />
                    {i.link && <a className="sl-mini ghost" href={i.link} target="_blank" rel="noreferrer noopener"><ExternalLink size={13} /> Link</a>}
                    {isAdmin && (
                      <>
                        <select aria-label="Status" value={i.status} onChange={(e) => void patch(i, { status: e.target.value as Status })} className="cit-sel">{(Object.keys(STATUS) as Status[]).map((s) => <option key={s} value={s}>{STATUS[s]}</option>)}</select>
                        <button className="sl-mini" onClick={() => void patch(i, { pinned: !i.pinned })}><Pin size={13} /> {i.pinned ? 'Unpin' : 'Pin'}</button>
                      </>
                    )}
                    {(isAdmin || i.user_id === user.uid) && <button className="sl-mini danger" onClick={() => void remove(i)}><Trash2 size={13} /></button>}
                  </div>
                  {openId === i.id && <div style={{ marginTop: 10 }}><ChatRoom room={`idea:${i.id}`} user={user} onSignIn={onSignIn} isAdmin={isAdmin} title="Discussion" placeholder="Add your thoughts, offer to help…" /><BskyDiscussion room={`idea:${i.id}`} bsky={bsky} isAdmin={isAdmin} announce={`Coding idea from the CIT community: ${i.title.slice(0, 120)} #coding`} /></div>}
                </div>
              </article>))}</div>
          )}
        </>
      )}
      {add && user && <IdeaModal user={user} onClose={() => setAdd(false)} onDone={() => void load()} />}
    </>
  )
}

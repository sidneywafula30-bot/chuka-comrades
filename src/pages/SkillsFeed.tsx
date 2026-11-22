import { useEffect, useMemo, useState, type FormEvent } from 'react'
import type { User } from 'firebase/auth'
import { ExternalLink, Hash, MessageCircle, Radio, Send, Users } from 'lucide-react'
import { skillsApi, type SkillsConfig } from '../lib/skills'
import { authorFeed, EMPTY_BSKY, listFeed, listMembers, listUri, resolveDid, startLive, type BskyConfig, type BskyPost, type LiveState } from '../lib/bluesky'
import { errMsg, type Note } from '../lib/hub'
import { Empty, Loading, Msg } from '../components/HubUi'
import { BskyCard, BskyDm, BskyThread, bskyHandle } from '../components/Bluesky'
import '../components/Cit.css'

type Src = 'community' | 'ours' | 'live' | 'topics'

/* ---------- tabs shared by Feed, Ideas and Hackathons ---------- */
export function CommunityTabs({ current, go, bsky }: { current: 'feed' | 'ideas' | 'hackathons'; go: (t: 'feed' | 'ideas' | 'hackathons') => void; bsky?: BskyConfig }) {
  return (
    <div className="hub-chips cit-community">
      {([['feed', 'Feed'], ['ideas', 'Coding ideas'], ['hackathons', 'Hackathons']] as const).map(([k, l]) => <button key={k} className={current === k ? 'on' : ''} onClick={() => go(k)}>{l}</button>)}
      <span style={{ marginLeft: 'auto' }}><BskyDm bsky={bsky} /></span>
    </div>
  )
}

/* ---------- a list of posts with inline replies ---------- */
function PostList({ posts, hidden, isAdmin, onHide, emptyText }: { posts: BskyPost[]; hidden: string[]; isAdmin: boolean; onHide: (p: BskyPost) => void; emptyText: string }) {
  const [open, setOpen] = useState<string | null>(null)
  const shown = posts.filter((p) => !hidden.includes(p.uri))
  if (shown.length === 0) return <Empty icon={<MessageCircle size={26} />} title="Nothing here yet" text={emptyText} />
  return (
    <div className="cit-bfeed">
      {shown.map((p) => (
        <div key={p.uri}>
          <BskyCard post={p} admin={isAdmin} onHide={onHide}>
            <button className="sl-mini" onClick={() => setOpen(open === p.uri ? null : p.uri)}><MessageCircle size={12} /> {open === p.uri ? 'Hide replies' : 'Replies'}</button>
          </BskyCard>
          {open === p.uri && <div className="cit-bsub"><BskyThread url={p.url} hidden={hidden} showRoot={false} /></div>}
        </div>))}
    </div>
  )
}

const merge = (old: BskyPost[], add: BskyPost[]) => {
  const map = new Map<string, BskyPost>()
  for (const p of [...add, ...old]) if (!map.has(p.uri)) map.set(p.uri, p)
  return [...map.values()].sort((a, b) => (a.when < b.when ? 1 : -1)).slice(0, 40)
}

/* ---------- live ---------- */
function LivePanel({ bsky, hidden, isAdmin, onHide }: { bsky: BskyConfig; hidden: string[]; isAdmin: boolean; onHide: (p: BskyPost) => void }) {
  const handle = bskyHandle(bsky)
  const [on, setOn] = useState(false)
  const [state, setState] = useState<LiveState>('off')
  const [posts, setPosts] = useState<BskyPost[]>([])
  const [msg, setMsg] = useState<Note>(null)
  useEffect(() => {
    if (!on) return
    let closed = false
    const h: { live: ReturnType<typeof startLive> | null } = { live: null }
    void (async () => {
      try {
        setState('connecting'); setMsg(null)
        const uri = bsky.list ? await listUri(bsky.list) : ''
        const members = uri ? await listMembers(uri) : []
        if (handle && !members.some((m) => m.handle === handle)) {
          try { members.push({ did: await resolveDid(handle), handle, name: handle, avatar: '' }) } catch { /* handle not found: carry on without it */ }
        }
        const poll = () => (uri ? listFeed(uri, 20) : handle ? authorFeed(handle, 20) : Promise.resolve([] as BskyPost[]))
        const first = await poll().catch(() => [] as BskyPost[])
        if (closed) return
        setPosts(first)
        h.live = startLive({ members, poll, onPosts: (p) => setPosts((old) => merge(old, p)), onState: setState })
      } catch (e) { if (!closed) { setMsg({ type: 'err', text: errMsg(e) }); setOn(false); setState('off') } }
    })()
    return () => { closed = true; h.live?.close(); setState('off') }
  }, [on, bsky.list, handle])
  const label = state === 'live' ? 'Live now: new posts appear as they are written' : state === 'polling' ? 'Updating every 30 seconds' : state === 'connecting' ? 'Connecting…' : 'Paused'
  return (
    <>
      <div className="cit-livebar">
        <span className={`cit-livedot ${state}`}><Radio size={14} /> {label}</span>
        <button className={on ? 'sl-mini danger' : 'sl-primary small'} onClick={() => setOn(!on)}>{on ? 'Pause' : 'Start live feed'}</button>
      </div>
      <Msg msg={msg} />
      {!bsky.list && !handle ? <p className="cit-note">The live feed needs a Bluesky account or list. The admin sets it in Admin &gt; Bluesky.</p>
        : !on && posts.length === 0 ? <p className="sl-sub">Tap “Start live feed” to watch posts from our community arrive in real time. It only runs while this tab is open.</p>
        : <PostList posts={posts} hidden={hidden} isAdmin={isAdmin} onHide={onHide} emptyText="Waiting for the next post…" />}
    </>
  )
}

/* ---------- topics (hashtags, through the server) ---------- */
function Topics({ bsky, user, onSignIn, hidden, isAdmin, onHide }: { bsky: BskyConfig; user: User | null; onSignIn: () => void; hidden: string[]; isAdmin: boolean; onHide: (p: BskyPost) => void }) {
  const [tag, setTag] = useState(bsky.tags[0] ?? '')
  const [typed, setTyped] = useState('')
  const [posts, setPosts] = useState<BskyPost[] | null>(null)
  const [msg, setMsg] = useState<Note>(null)
  useEffect(() => {
    if (!tag || !user) { setPosts(null); return }
    let live = true
    setPosts(null); setMsg(null)
    skillsApi.bskyTag(tag).then((r) => { if (!live) return; setPosts(r.items); if (r.error) setMsg({ type: 'err', text: r.error }) }).catch((e) => { if (live) { setMsg({ type: 'err', text: errMsg(e) }); setPosts([]) } })
    return () => { live = false }
  }, [tag, user])
  function go(e: FormEvent) { e.preventDefault(); const t = typed.trim().replace(/^#/, ''); if (t) { setTag(t); setTyped('') } }
  if (!user) return <div className="cit-note">Sign in to browse topics like #python. <button className="sl-primary small" onClick={onSignIn}>Sign in</button></div>
  return (
    <>
      <div className="hub-chips">
        {bsky.tags.map((t) => <button key={t} className={tag === t ? 'on' : ''} onClick={() => setTag(t)}>#{t}</button>)}
        <form onSubmit={go} className="cit-tagform"><Hash size={14} /><input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Another topic" maxLength={30} /></form>
      </div>
      <Msg msg={msg} />
      {!tag ? <p className="sl-sub">Pick a topic or type one, for example python or hackathon.</p>
        : !posts ? <Loading /> : <PostList posts={posts} hidden={hidden} isAdmin={isAdmin} onHide={onHide} emptyText={`No recent posts for #${tag}.`} />}
    </>
  )
}

/* ---------- the Feed page ---------- */
export function Feed({ config, user, onSignIn, isAdmin, onChanged }: { config: SkillsConfig; user: User | null; onSignIn: () => void; isAdmin: boolean; onChanged: () => void }) {
  const bsky = config.bsky ?? EMPTY_BSKY
  const handle = bskyHandle(bsky)
  const [src, setSrc] = useState<Src>(bsky.list ? 'community' : 'ours')
  const [posts, setPosts] = useState<Record<string, BskyPost[]>>({})
  const [hiddenNow, setHiddenNow] = useState<string[]>(bsky.hidden)
  const [msg, setMsg] = useState<Note>(null)
  useEffect(() => { setHiddenNow(bsky.hidden) }, [bsky.hidden])
  useEffect(() => {
    if (src !== 'ours' && src !== 'community') return
    const key = src
    if (posts[key]) return
    if (key === 'ours' && !handle) { setPosts((p) => ({ ...p, ours: [] })); return }
    if (key === 'community' && !bsky.list) { setPosts((p) => ({ ...p, community: [] })); return }
    let live = true
    const job = key === 'ours' ? authorFeed(handle, 25) : listUri(bsky.list).then((u) => listFeed(u, 30))
    job.then((l) => { if (live) setPosts((p) => ({ ...p, [key]: l })) }).catch((e) => { if (live) { setMsg({ type: 'err', text: errMsg(e) }); setPosts((p) => ({ ...p, [key]: [] })) } })
    return () => { live = false }
  }, [src, handle, bsky.list, posts])
  async function hide(p: BskyPost) {
    if (!window.confirm('Hide this post for everyone?')) return
    try { const r = await skillsApi.admin.bskyHide(p.uri, true); setHiddenNow(r.hidden); onChanged() } catch (e) { setMsg({ type: 'err', text: errMsg(e) }) }
  }
  const tabs = useMemo(() => [['community', 'Community', Users], ['ours', 'Our posts', MessageCircle], ['live', 'Live', Radio], ['topics', 'Topics', Hash]] as const, [])
  return (
    <>
      <section className="sl-hero cit-hero">
        <div><span className="sl-kicker">COMMUNITY · CIT GROUP</span><h1>What the community is <em>saying right now.</em></h1>
          <p>Posts from our Bluesky account and the developers we follow. Open the replies here, then join in on Bluesky.</p>
          <div className="cit-hero-actions">
            {handle && <a className="sl-primary small" href={`https://bsky.app/profile/${handle}`} target="_blank" rel="noreferrer noopener"><ExternalLink size={14} /> Follow @{handle}</a>}
            <BskyDm bsky={bsky} className="sl-mini cit-light" />
          </div></div>
        <div className="sl-hero-art"><Send size={46} /><span>Bluesky</span></div>
      </section>
      <div className="hub-chips">{tabs.map(([k, l, Icon]) => <button key={k} className={src === k ? 'on' : ''} onClick={() => setSrc(k)}><Icon size={13} style={{ verticalAlign: -2 }} /> {l}</button>)}</div>
      <Msg msg={msg} />
      {src === 'live' ? <LivePanel bsky={{ ...bsky, hidden: hiddenNow }} hidden={hiddenNow} isAdmin={isAdmin} onHide={hide} />
        : src === 'topics' ? <Topics bsky={bsky} user={user} onSignIn={onSignIn} hidden={hiddenNow} isAdmin={isAdmin} onHide={hide} />
        : !handle && !bsky.list ? <p className="cit-note">{isAdmin ? 'Set the Bluesky handle and list in Admin > Bluesky to fill this feed.' : 'The community feed is coming soon.'}</p>
        : !posts[src] ? <Loading />
        : <PostList posts={posts[src]} hidden={hiddenNow} isAdmin={isAdmin} onHide={hide} emptyText={src === 'community' && !bsky.list ? 'The admin has not added a community list yet.' : 'No posts to show right now.'} />}
    </>
  )
}

/* ---------- admin ---------- */
export function AdminBsky({ config, onChanged }: { config: SkillsConfig; onChanged: () => void }) {
  const bsky = config.bsky ?? EMPTY_BSKY
  const [handle, setHandle] = useState(bsky.handle)
  const [list, setList] = useState(bsky.list)
  const [tags, setTags] = useState(bsky.tags.join(', '))
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<Note>(null)
  async function save(e: FormEvent) {
    e.preventDefault(); setBusy(true); setMsg(null)
    try {
      await skillsApi.admin.bskySave({ handle: handle.trim(), list: list.trim(), tags: tags.split(',').map((t) => t.trim().replace(/^#/, '')).filter(Boolean) })
      setMsg({ type: 'ok', text: 'Saved.' }); onChanged()
    } catch (x) { setMsg({ type: 'err', text: errMsg(x) }) } finally { setBusy(false) }
  }
  async function post() {
    setBusy(true); setMsg(null)
    try { const r = await skillsApi.admin.bskyPost(text); setText(''); setMsg({ type: 'ok', text: `Posted: ${r.url}` }) } catch (x) { setMsg({ type: 'err', text: errMsg(x) }) } finally { setBusy(false) }
  }
  async function unhide(uri: string) {
    try { await skillsApi.admin.bskyHide(uri, false); onChanged() } catch (x) { setMsg({ type: 'err', text: errMsg(x) }) }
  }
  return (
    <>
      <p className="sl-sub" style={{ marginTop: 0 }}>Everything the community sees from Bluesky is set here. Changes show without a rebuild.</p>
      <form className="sl-form" onSubmit={save}>
        <label>Our Bluesky handle<input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="chukaai.bsky.social" /></label>
        <label>Community list link (a Bluesky list of Chuka and Kenyan developers)<input value={list} onChange={(e) => setList(e.target.value)} placeholder="https://bsky.app/profile/…/lists/…" /></label>
        <label>Topics for the Topics tab (comma separated, up to 8)<input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="python, hackathon, kenya" /></label>
        <button className="sl-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
      </form>
      <Msg msg={msg} />
      <div className="hub-sec"><h2>Posting and topics</h2></div>
      {bsky.posting ? <p className="sl-sub">Connected: you can post announcements below, and the Topics tab works.</p>
        : <p className="cit-note">Not connected. In Apps Script open Project Settings &gt; Script properties and add <b>BSKY_HANDLE</b> (the account that will post) and <b>BSKY_APP_PASSWORD</b> (create one in Bluesky &gt; Settings &gt; Privacy and security &gt; App passwords). Then deploy a new version. Without it, the feed, replies and live feed still work; only posting and topics are off.</p>}
      {bsky.posting && (
        <div className="sl-form">
          <label>Post to Bluesky from the CIT account ({[...text].length}/300)<textarea rows={4} maxLength={300} value={text} onChange={(e) => setText(e.target.value)} placeholder="Hackathon registration is open! https://…  #hackathon" /></label>
          <button className="sl-primary small" disabled={busy || !text.trim()} onClick={() => void post()}><Send size={14} /> Post now</button>
        </div>)}
      <div className="hub-sec"><h2>Hidden posts ({bsky.hidden.length})</h2></div>
      {bsky.hidden.length === 0 ? <p className="sl-sub">Nothing hidden. Use the Hide button on any post in the Feed.</p> : (
        <ul className="cit-hidden">{bsky.hidden.map((u) => <li key={u}><code>{u.replace('at://', '').slice(0, 60)}</code><button className="sl-mini" onClick={() => void unhide(u)}>Show again</button></li>)}</ul>)}
    </>
  )
}

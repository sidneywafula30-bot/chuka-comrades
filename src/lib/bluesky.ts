// Bluesky helpers. Reads use the public, read-only endpoint (no key, no login).
// Writing and topic search go through the Apps Script server (see Skills.gs).

// Two hostnames for the same public, read-only API. If one fails DNS, the other is tried.
const HOSTS = ['https://public.api.bsky.app/xrpc', 'https://api.bsky.app/xrpc']

/** "chukaaicommunity" -> "chukaaicommunity.bsky.social". Leaves DIDs and full handles alone. */
export function fixActor(actor: string): string {
  const a = actor.trim().replace(/^@/, '').toLowerCase()
  if (!a || a.startsWith('did:') || a.includes('.')) return a
  return `${a}.bsky.social`
}

export type BskyPost = {
  uri: string; url: string; did: string; handle: string; name: string; avatar: string
  text: string; when: string; image: string; likes: number; replies: number; reposts: number
}
export type BskyNode = { post: BskyPost; replies: BskyNode[] }
export type BskyMember = { did: string; handle: string; name: string; avatar: string }
export type BskyConfig = { handle: string; list: string; tags: string[]; hidden: string[]; links: Record<string, string>; posting: boolean }
export const EMPTY_BSKY: BskyConfig = { handle: '', list: '', tags: [], hidden: [], links: {}, posting: false }

type Img = { thumb?: string }
type Embed = { images?: Img[]; external?: { thumb?: string }; media?: { images?: Img[]; external?: { thumb?: string } } }
type Author = { did: string; handle: string; displayName?: string; avatar?: string }
type PostView = {
  uri: string; author: Author; record?: { text?: string; createdAt?: string; reply?: unknown }; embed?: Embed; indexedAt?: string
  likeCount?: number; replyCount?: number; repostCount?: number
}

async function get<T>(method: string, params: Record<string, string | number>): Promise<T> {
  const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString()
  const name = method.split('.').pop()
  let networkFailed = false
  for (const host of HOSTS) {
    let r: Response
    try {
      r = await fetch(`${host}/${method}?${qs}`)
    } catch {
      networkFailed = true // DNS / offline / blocked: try the next host
      continue
    }
    if (!r.ok) {
      let why = ''
      try { const j = (await r.json()) as { message?: string; error?: string }; why = j.message || j.error || '' } catch { /* no details */ }
      throw new Error(why ? `Bluesky says: ${why} (${name})` : `Bluesky said ${r.status} (${name})`)
    }
    return (await r.json()) as T
  }
  throw new Error(networkFailed
    ? 'Cannot reach Bluesky from this network. Check your connection or try a different DNS (1.1.1.1 or 8.8.8.8).'
    : 'Bluesky request failed.')
}

const rkeyOf = (uri: string) => uri.split('/').pop() ?? ''
export const postUrl = (actor: string, uri: string) => `https://bsky.app/profile/${actor}/post/${rkeyOf(uri)}`

export function toPost(p: PostView): BskyPost {
  const e = p.embed
  const image = e?.images?.[0]?.thumb ?? e?.external?.thumb ?? e?.media?.images?.[0]?.thumb ?? e?.media?.external?.thumb ?? ''
  return {
    uri: p.uri, url: postUrl(p.author.handle || p.author.did, p.uri), did: p.author.did, handle: p.author.handle, name: p.author.displayName || p.author.handle,
    avatar: p.author.avatar ?? '', text: p.record?.text ?? '', when: p.record?.createdAt ?? p.indexedAt ?? '', image,
    likes: p.likeCount ?? 0, replies: p.replyCount ?? 0, reposts: p.repostCount ?? 0,
  }
}
const isReply = (p: PostView) => !!p.record?.reply

const didCache = new Map<string, string>()
export async function resolveDid(actor: string): Promise<string> {
  const a = fixActor(actor)
  if (a.startsWith('did:')) return a
  const hit = didCache.get(a); if (hit) return hit
  const j = await get<{ did: string }>('com.atproto.identity.resolveHandle', { handle: a })
  didCache.set(a, j.did); return j.did
}

/** Accepts a bsky.app list link or an at:// list address and returns the at:// address. */
export async function listUri(input: string): Promise<string> {
  const s = input.trim()
  if (s.startsWith('at://')) return s
  const m = s.match(/^https:\/\/bsky\.app\/profile\/([^/]+)\/lists\/([A-Za-z0-9]+)/)
  if (!m) throw new Error('That is not a Bluesky list link.')
  return `at://${await resolveDid(m[1])}/app.bsky.graph.list/${m[2]}`
}

export async function authorFeed(actor: string, limit = 12): Promise<BskyPost[]> {
  const d = await get<{ feed?: { reason?: unknown; post: PostView }[] }>('app.bsky.feed.getAuthorFeed', { actor: fixActor(actor), limit, filter: 'posts_no_replies' })
  return (d.feed ?? []).filter((f) => !f.reason).map((f) => toPost(f.post))
}

export async function listFeed(list: string, limit = 30): Promise<BskyPost[]> {
  const d = await get<{ feed?: { reason?: unknown; post: PostView }[] }>('app.bsky.feed.getListFeed', { list, limit })
  return (d.feed ?? []).filter((f) => !f.reason && !isReply(f.post)).map((f) => toPost(f.post))
}

export async function listMembers(list: string): Promise<BskyMember[]> {
  const d = await get<{ items?: { subject: Author }[] }>('app.bsky.graph.getList', { list, limit: 100 })
  return (d.items ?? []).map((i) => ({ did: i.subject.did, handle: i.subject.handle, name: i.subject.displayName || i.subject.handle, avatar: i.subject.avatar ?? '' }))
}

type ThreadView = { $type?: string; post?: PostView; replies?: ThreadView[] }
function node(t: ThreadView): BskyNode | null {
  if (!t.post || (t.$type && !t.$type.endsWith('threadViewPost'))) return null
  const replies = (t.replies ?? []).map(node).filter((n): n is BskyNode => !!n)
  return { post: toPost(t.post), replies }
}

/** The replies under one Bluesky post, from a bsky.app post link. */
export async function postThread(link: string): Promise<BskyNode | null> {
  const m = link.trim().match(/^https:\/\/bsky\.app\/profile\/([^/]+)\/post\/([A-Za-z0-9]+)/)
  if (!m) throw new Error('That is not a Bluesky post link.')
  const uri = `at://${await resolveDid(m[1])}/app.bsky.feed.post/${m[2]}`
  const d = await get<{ thread?: ThreadView }>('app.bsky.feed.getPostThread', { uri, depth: 6, parentHeight: 0 })
  return d.thread ? node(d.thread) : null
}

export const ago = (iso: string) => {
  if (!iso) return ''
  const s = Math.max(1, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 3600) return `${Math.round(s / 60)}m`
  if (s < 86400) return `${Math.round(s / 3600)}h`
  if (s < 86400 * 30) return `${Math.round(s / 86400)}d`
  return new Date(iso).toLocaleDateString('en-KE', { dateStyle: 'medium' })
}

/* ---------------- live stream (Jetstream) with polling fallback ---------------- */
export type LiveState = 'off' | 'connecting' | 'live' | 'polling'
type Live = { close: () => void }

type JetEvent = { did?: string; kind?: string; operation?: string; collection?: string; rkey?: string; record?: { text?: string; createdAt?: string; reply?: unknown }; commit?: { operation?: string; collection?: string; rkey?: string; record?: { text?: string; createdAt?: string; reply?: unknown } } }

/** Reads both the new (v2) and old (v1) Jetstream message shapes. */
function readEvent(raw: string, who: Map<string, BskyMember>): BskyPost | null {
  let msg: { payload?: JetEvent } & JetEvent
  try { msg = JSON.parse(raw) as typeof msg } catch { return null }
  const e = msg.payload ?? msg
  const c = e.commit ?? e
  if ((e.kind && e.kind !== 'commit') || c.operation !== 'create' || c.collection !== 'app.bsky.feed.post' || !e.did || !c.rkey || !c.record) return null
  if (c.record.reply || !c.record.text) return null
  const m = who.get(e.did)
  const handle = m?.handle || e.did
  const uri = `at://${e.did}/app.bsky.feed.post/${c.rkey}`
  return { uri, url: `https://bsky.app/profile/${handle}/post/${c.rkey}`, did: e.did, handle, name: m?.name || handle, avatar: m?.avatar ?? '', text: c.record.text, when: c.record.createdAt ?? new Date().toISOString(), image: '', likes: 0, replies: 0, reposts: 0 }
}

export function startLive(opts: { members: BskyMember[]; poll: () => Promise<BskyPost[]>; onPosts: (p: BskyPost[]) => void; onState: (s: LiveState) => void }): Live {
  const who = new Map(opts.members.map((m) => [m.did, m]))
  const dids = opts.members.slice(0, 100).map((m) => m.did)
  let ws: WebSocket | null = null, timer: number | undefined, poller: number | undefined, closed = false, step = 0, opened = false
  const urls: { url: string; protocols?: string[] }[] = [
    { url: 'wss://jetstream.us-east.bsky.network/xrpc/network.bsky.jetstream.subscribeEvents?collections=app.bsky.feed.post&kinds=commit&' + dids.map((d) => `dids=${encodeURIComponent(d)}`).join('&'), protocols: ['xrpc.v1.json'] },
    { url: 'wss://jetstream2.us-east.bsky.network/subscribe?wantedCollections=app.bsky.feed.post&' + dids.map((d) => `wantedDids=${encodeURIComponent(d)}`).join('&') },
  ]
  function polling() {
    if (closed || poller) return
    opts.onState('polling')
    const tick = () => { opts.poll().then((p) => { if (!closed) opts.onPosts(p) }).catch(() => {}) }
    tick(); poller = window.setInterval(tick, 30000)
  }
  function connect() {
    if (closed) return
    if (dids.length === 0 || step >= urls.length) { polling(); return }
    opts.onState('connecting'); opened = false
    const target = urls[step]
    try { ws = target.protocols ? new WebSocket(target.url, target.protocols) : new WebSocket(target.url) } catch { step++; connect(); return }
    timer = window.setTimeout(() => { if (!opened) { ws?.close() } }, 8000)
    ws.onopen = () => { opened = true; opts.onState('live') }
    ws.onmessage = (ev) => { const p = typeof ev.data === 'string' ? readEvent(ev.data, who) : null; if (p) opts.onPosts([p]) }
    ws.onerror = () => { /* onclose follows */ }
    ws.onclose = () => {
      window.clearTimeout(timer)
      if (closed) return
      if (opened) { opened = false; window.setTimeout(connect, 3000); return } // dropped after working: try the same address again
      step++; connect() // never opened: try the next address, then polling
    }
  }
  connect()
  return { close: () => { closed = true; window.clearTimeout(timer); window.clearInterval(poller); ws?.close(); opts.onState('off') } }
}

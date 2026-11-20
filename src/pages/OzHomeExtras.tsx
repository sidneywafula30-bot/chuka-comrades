import { ArrowRight, Clapperboard, Megaphone, Newspaper, Mail, TrendingUp, Vote, Play, ThumbsUp } from 'lucide-react'
import { WhatsAppLogo } from '../components/BrandLogos'
import { ADMIN_NAME, AdminAvatar, OZONE_ADMIN_WA, adminWaUrl } from '../components/AdminChat'
import { ago, oz, snip, type Issue, type NewsList, type Page, type Poll, type Post, type TrendList } from '../lib/ozone'
import { useLoad, type OzCtx } from './OzCommon'
import { Bubble } from './OzConfessions'

/** Admin contact (name, photo and number live in components/AdminChat). Email comes from VITE_OZONE_ADMIN_EMAIL. */
export { OZONE_ADMIN_WA, adminWaUrl }
const ADMIN_EMAIL = (import.meta.env.VITE_OZONE_ADMIN_EMAIL as string | undefined) || ''

export function AdminCard() {
  return (
    <section className="oz-admin" aria-label="Contact the O-Zone admin">
      <div className="oz-admin-who">
        <AdminAvatar />
        <div>
          <span className="oz-admin-tag">Your admin</span>
          <strong>{ADMIN_NAME}</strong>
          <small>Runs Chuka O-Zone &amp; Chuka Soko</small>
        </div>
      </div>
      <p className="oz-admin-msg">Got a tip, a problem, an advert, or need help? Message me directly.</p>
      <div className="oz-admin-btns">
        <a className="oz-btn-wa" href={adminWaUrl()} target="_blank" rel="noopener noreferrer"><WhatsAppLogo size={20} /> Chat {ADMIN_NAME} on WhatsApp</a>
        {ADMIN_EMAIL && <a className="oz-btn-mail" href={`mailto:${ADMIN_EMAIL}?subject=${encodeURIComponent('Chuka O-Zone')}`}><Mail size={18} /> Email</a>}
      </div>
      <small className="oz-admin-num">+254 707 245 180</small>
    </section>
  )
}

function Block({ icon, title, href, children }: { icon: React.ReactNode; title: string; href: string; children: React.ReactNode }) {
  return (
    <section className="oz-tr-block">
      <header><span className="oz-tr-ic">{icon}</span><h3>{title}</h3><a href={href}>See all <ArrowRight size={14} /></a></header>
      {children}
    </section>
  )
}
const Skel = () => <div className="oz-tr-skel"><i /><i /><i /></div>

/** Same NGL-style panel and cards as the Confessions page (real <Bubble> cards). */
function Confessions({ ctx }: { ctx: OzCtx }) {
  const { data, loading, err } = useLoad(() => oz<Page<Post>>('feed', {}), [])
  if (err || (!loading && !data?.items.length)) return null
  const top = data ? [...data.items].sort((a, b) => b.replies - a.replies || b.number - a.number).slice(0, 3) : []
  return (
    <div className="ng-wrap oz-tr-conf">
      <h3 className="ng-sec">🔥 trending confessions</h3>
      {loading ? <p className="ng-empty">Loading…</p> : <div className="ng-list">{top.map((p) => <Bubble key={p.number} p={p} ctx={ctx} />)}</div>}
      <a className="ng-more oz-tr-conf-all" href="#/ozone/confessions">See all confessions <ArrowRight size={15} /></a>
    </div>
  )
}

function Issues() {
  const { data, loading, err } = useLoad(() => oz<Page<Issue>>('issues_list', {}), [])
  if (err || (!loading && !data?.items.length)) return null
  const top = data ? [...data.items].sort((a, b) => b.meToo - a.meToo).slice(0, 3) : []
  return (
    <Block icon={<Megaphone size={18} />} title="Sauti ya Comrades" href="#/ozone/sauti">
      {loading ? <Skel /> : top.map((i) => (
        <a key={i.id} className="oz-tr-row" href={`#/ozone/issue/${i.id}`}>
          <span className="oz-tr-main"><em>{i.facultyCode} · {i.categoryLabel}</em>{snip(i.title, 100)}</span>
          <span className="oz-tr-stat"><ThumbsUp size={13} /> {i.meToo}</span>
        </a>
      ))}
    </Block>
  )
}

function Videos() {
  const { data, loading, err } = useLoad(() => oz<TrendList>('trends_list', { offset: 0 }), [])
  const list = data ? [...(data.live ? [{ ...data.live, key: 'live', live: true }] : []), ...data.items].slice(0, 4) : []
  if (err || (!loading && !list.length)) return null
  return (
    <Block icon={<Clapperboard size={18} />} title="Trending videos" href="#/ozone/trends">
      {loading ? <Skel /> : (
        <div className="oz-tr-vids">
          {list.map((v) => (
            <a key={v.key} className="oz-tr-vid" href="#/ozone/trends">
              {v.thumb ? <img src={v.thumb} alt="" loading="lazy" /> : <span className="oz-tr-vfb" />}
              <span className="oz-tr-play"><Play size={16} /></span>
              {v.live && <b className="oz-tr-live">LIVE</b>}
              <span className="oz-tr-vt">{snip(v.title, 48)}</span>
            </a>
          ))}
        </div>
      )}
    </Block>
  )
}

function News() {
  const { data, loading, err } = useLoad(() => oz<NewsList>('news_list', { offset: 0 }), [])
  if (err || (!loading && !data?.items.length)) return null
  return (
    <Block icon={<Newspaper size={18} />} title="Top headlines" href="#/ozone/news">
      {loading ? <Skel /> : data?.items.slice(0, 3).map((n) => (
        <a key={n.id} className="oz-tr-row" href={n.url} target="_blank" rel="noopener noreferrer">
          <span className="oz-tr-main"><em>{n.source}{n.publishedAt ? ` · ${ago(n.publishedAt)}` : ''}</em>{snip(n.title, 110)}</span>
          <ArrowRight size={14} className="oz-tr-go" />
        </a>
      ))}
    </Block>
  )
}

function Polls() {
  const { data, loading, err } = useLoad(() => oz<Poll[]>('polls_list'), [])
  const open = data?.filter((p) => p.open).slice(0, 2) || []
  if (err || (!loading && !open.length)) return null
  return (
    <Block icon={<Vote size={18} />} title="Live polls" href="#/ozone/polls">
      {loading ? <Skel /> : open.map((p) => (
        <a key={p.id} className="oz-tr-row" href={`#/ozone/poll/${p.id}`}>
          <span className="oz-tr-main"><em>{p.total != null ? `${p.total} votes` : 'Open now'}</em>{snip(p.question, 110)}</span>
          <span className="oz-tr-stat">Vote</span>
        </a>
      ))}
    </Block>
  )
}

/** "What's trending" on the O-Zone landing page: a taste of every public section. */
export function TrendingNow({ ctx }: { ctx: OzCtx }) {
  return (
    <div className="oz-trending">
      <div className="oz-tr-head"><TrendingUp size={20} /><div><h2>Trending on O-Zone</h2><small>The latest from every section</small></div></div>
      <Confessions ctx={ctx} />
      <div className="oz-tr-grid">
        <Issues /><Videos /><News /><Polls />
      </div>
    </div>
  )
}

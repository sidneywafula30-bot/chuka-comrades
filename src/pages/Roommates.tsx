import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import type { User } from 'firebase/auth'
import { Check, Clock, EyeOff, Eye, Flag, Heart, Loader2, Pencil, Search, Trash2, UserRound, X } from 'lucide-react'
import {
  DEFAULT_LIFESTYLE, LIFESTYLE_QUESTIONS, budgetsOverlap, lifestyleLabel, matchScore, normalizePhone, rememberGender, rememberedGender,
  roommateApi, roommateReady, shareLink, type Gender, type Lifestyle, type PostInput, type ReceivedInterest, type RoommatePost, type SentInterest,
} from '../lib/roommate'
import { ROOM_TYPE_SUGGESTIONS, kes, showPhone, timeAgo, waLink } from '../lib/hostel'
import { WhatsAppLogo } from '../components/BrandLogos'
import GoogleSignInButton from '../components/GoogleSignInButton'

type Sub = 'find' | 'mine' | 'requests'
type Props = { user: User | null; onSignIn: () => void; authBusy: boolean }

export default function Roommates({ user, onSignIn, authBusy }: Props) {
  const [sub, setSub] = useState<Sub>('find')
  const [mine, setMine] = useState<{ post: RoommatePost; whatsapp: string } | null | undefined>(undefined)
  const [gender, setGender] = useState<Gender | ''>(rememberedGender())
  const [error, setError] = useState('')
  const [pendingCount, setPendingCount] = useState(0)

  const uid = user?.uid
  const loadMine = useCallback(async () => {
    if (!uid) { setMine(undefined); return }
    try { setMine(await roommateApi.myPost(uid)) } catch (e) { setError((e as Error).message); setMine(null) }
  }, [uid])
  useEffect(() => { void loadMine() }, [loadMine])

  // If the student already has a post, their gender is the one on the post.
  useEffect(() => { if (mine?.post.gender) { setGender(mine.post.gender); rememberGender(mine.post.gender) } }, [mine])

  const refreshCount = useCallback(async () => {
    if (!uid) { setPendingCount(0); return }
    try { setPendingCount((await roommateApi.received()).filter((r) => r.status === 'pending').length) } catch { /* shown on the Requests tab */ }
  }, [uid])
  useEffect(() => { void refreshCount() }, [refreshCount])

  if (!roommateReady) return <p className="hs-note">Dev note: Supabase keys are not set, so the roommate finder cannot load.</p>

  if (!user) {
    return (
      <section className="hs-panel rm-gate">
        <span className="hs-kicker dark">ROOMMATE FINDER</span>
        <h2>Find a roommate you will actually get along with</h2>
        <p>Post what you are looking for, get approved by the admin, then see students of the same gender with a match score. Phone numbers stay private until both of you agree to connect.</p>
        <div><GoogleSignInButton onClick={onSignIn} disabled={authBusy} label="Sign in to continue" /></div>
      </section>
    )
  }

  return (
    <div className="rm">
      <div className="rm-sub" role="tablist">
        <button className={sub === 'find' ? 'on' : ''} onClick={() => setSub('find')}>Find roommates</button>
        <button className={sub === 'mine' ? 'on' : ''} onClick={() => setSub('mine')}>My post{mine?.post.status === 'pending' ? ' · pending' : ''}</button>
        <button className={sub === 'requests' ? 'on' : ''} onClick={() => setSub('requests')}>Requests{pendingCount > 0 && <span className="rm-dot">{pendingCount}</span>}</button>
      </div>
      {error && <p className="hs-error" role="alert">{error}</p>}

      {sub === 'find' && <Browse user={user} mine={mine} gender={gender} setGender={(g) => { setGender(g); rememberGender(g) }} goPost={() => setSub('mine')} />}
      {sub === 'mine' && <MyPost user={user} mine={mine} onChange={(m) => { setMine(m) }} />}
      {sub === 'requests' && <Requests onChanged={() => void refreshCount()} />}
    </div>
  )
}

/* ------------------------------ Browse ------------------------------ */

function Browse({ user, mine, gender, setGender, goPost }: {
  user: User; mine: { post: RoommatePost; whatsapp: string } | null | undefined
  gender: Gender | ''; setGender: (g: Gender) => void; goPost: () => void
}) {
  const [posts, setPosts] = useState<RoommatePost[] | null>(null)
  const [err, setErr] = useState('')
  const [area, setArea] = useState('')
  const [roomFilter, setRoomFilter] = useState<'all' | 'has' | 'needs'>('all')
  const [sameBudget, setSameBudget] = useState(false)
  const [q, setQ] = useState('')

  const load = useCallback(async () => {
    if (!gender) return
    setErr(''); setPosts(null)
    try { setPosts(await roommateApi.browse(gender)) } catch (e) { setErr((e as Error).message); setPosts([]) }
  }, [gender])
  useEffect(() => { void load() }, [load])

  const myPost = mine?.post
  const areas = useMemo(() => Array.from(new Set((posts ?? []).map((p) => p.area))).sort(), [posts])
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase()
    return (posts ?? [])
      .filter((p) => (!area || p.area === area)
        && (roomFilter === 'all' || (roomFilter === 'has') === p.hasRoom)
        && (!sameBudget || !myPost || budgetsOverlap(p, myPost))
        && (!t || [p.firstName, p.course, p.area, p.hostelName, p.roomType, p.bio].join(' ').toLowerCase().includes(t)))
      .map((p) => ({ p, score: myPost ? matchScore(myPost.lifestyle, p.lifestyle) : null }))
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
  }, [posts, area, roomFilter, sameBudget, q, myPost])

  if (!gender) {
    return (
      <section className="hs-panel">
        <h2>First, tell us who you are</h2>
        <p>You only see roommates of the same gender. This is saved on this device.</p>
        <div className="rm-pick">
          <button className="hs-btn hs-btn-green" onClick={() => setGender('male')}>I am male</button>
          <button className="hs-btn hs-btn-green" onClick={() => setGender('female')}>I am female</button>
        </div>
      </section>
    )
  }

  return (
    <>
      {!myPost && mine !== undefined && (
        <aside className="hs-soon rm-cta"><UserRound size={18} /><span><strong>You have no roommate post yet.</strong> Posting gets you match scores and lets others find you.</span><button className="hs-btn hs-btn-green" onClick={goPost}>Create post</button></aside>
      )}
      {myPost && myPost.status !== 'approved' && (
        <aside className="hs-soon rm-cta"><Clock size={18} /><span>Your post is <strong>{myPost.status}</strong>, so others cannot see you yet.</span><button className="hs-btn hs-btn-soft" onClick={goPost}>View</button></aside>
      )}
      <div className="hs-filters rm-filters">
        <label className="hs-search"><Search size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, course, area or hostel…" aria-label="Search roommates" /></label>
        <select value={area} onChange={(e) => setArea(e.target.value)} aria-label="Filter by area"><option value="">All areas</option>{areas.map((a) => <option key={a}>{a}</option>)}</select>
        <select value={roomFilter} onChange={(e) => setRoomFilter(e.target.value as 'all' | 'has' | 'needs')} aria-label="Room status">
          <option value="all">Has a room or not</option><option value="has">Already has a room</option><option value="needs">Needs a room too</option>
        </select>
      </div>
      <div className="hs-chips">
        {myPost && <button className={sameBudget ? 'on' : ''} onClick={() => setSameBudget(!sameBudget)}>Budget overlaps mine</button>}
        <button onClick={() => void load()}>Refresh</button>
      </div>
      {err && <p className="hs-error" role="alert">{err}</p>}
      {posts === null ? <p className="hs-empty">Loading…</p>
        : shown.length === 0 ? <p className="hs-empty">{posts.length === 0 ? 'No approved posts yet. Be the first, create yours.' : 'No one matches these filters.'}</p>
        : <div className="rm-grid">{shown.map(({ p, score }) => <PostCard key={p.id} p={p} score={score} user={user} gender={gender} defaultName={myPost?.firstName ?? ''} defaultPhone={mine?.whatsapp ?? ''} onSent={(id) => setPosts((cur) => cur?.map((x) => (x.id === id ? { ...x, interested: true } : x)) ?? cur)} />)}</div>}
    </>
  )
}

function ShareButton({ post }: { post: RoommatePost }) {
  return (
    <a className="hs-btn hs-btn-soft rm-share" href={shareLink(post)} target="_blank" rel="noopener noreferrer" aria-label={`Share ${post.firstName}'s post on WhatsApp`}>
      <WhatsAppLogo size={16} /> Share
    </a>
  )
}

function PostCard({ p, score, user, gender, defaultName, defaultPhone, onSent }: {
  p: RoommatePost; score: number | null; user: User; gender: Gender; defaultName: string; defaultPhone: string; onSent: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(defaultName || (user.displayName ?? '').split(' ')[0])
  const [phone, setPhone] = useState(defaultPhone)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null)

  async function send(e: FormEvent) {
    e.preventDefault()
    const wa = normalizePhone(phone)
    if (!name.trim()) { setMsg({ text: 'Enter your first name.', bad: true }); return }
    if (!wa) { setMsg({ text: 'Enter a valid Kenyan number, e.g. 0712 345 678.', bad: true }); return }
    setBusy(true); setMsg(null)
    try { await roommateApi.showInterest(p.id, name.trim(), gender, wa, note.trim()); onSent(p.id); setOpen(false) }
    catch (er) { setMsg({ text: (er as Error).message, bad: true }) }
    finally { setBusy(false) }
  }
  async function report() {
    const reason = window.prompt('What is wrong with this post? (visible only to the admin)')
    if (!reason) return
    try { await roommateApi.report(p.id, reason); window.alert('Thanks. The admin will review this post.') }
    catch (er) { window.alert((er as Error).message) }
  }

  const chips = LIFESTYLE_QUESTIONS.map((q) => lifestyleLabel(q.key, p.lifestyle[q.key])).filter(Boolean)
  return (
    <article className="rm-card">
      <header>
        <span className="rm-avatar" aria-hidden="true">{p.firstName.slice(0, 1).toUpperCase()}</span>
        <div><h3>{p.firstName}</h3><p>{p.course} · Year {p.year}</p></div>
        {score !== null && <span className={`rm-score${score >= 75 ? ' high' : score < 50 ? ' low' : ''}`}>{score}%<small>match</small></span>}
      </header>
      <ul className="rm-facts">
        <li><strong>Budget</strong>{kes(p.budgetMin)} – {kes(p.budgetMax)}</li>
        <li><strong>Area</strong>{p.area}</li>
        {p.roomType && <li><strong>Room type</strong>{p.roomType}</li>}
        <li><strong>Room</strong>{p.hasRoom ? `Has a room at ${p.hostelName}` : 'Looking for a room too'}</li>
      </ul>
      <div className="hs-pchips">{chips.map((c) => <span key={c} className="hs-pchip included">{c}</span>)}</div>
      {p.bio && <p className="hs-desc">{p.bio}</p>}
      <p className="hs-updated">Posted {timeAgo(p.updatedAt)}</p>
      {p.interested
        ? (
          <>
            <p className="hs-ok"><Check size={16} /> Request sent. You will see their number under Requests if they accept.</p>
            <div className="hs-admin-actions"><ShareButton post={p} /></div>
          </>
        )
        : open
          ? (
            <form className="hs-form rm-interest" onSubmit={send}>
              <div className="hs-fgrid">
                <label>Your first name<input value={name} onChange={(e) => setName(e.target.value)} maxLength={30} /></label>
                <label>Your WhatsApp<input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="0712 345 678" /></label>
                <label className="wide">Short note (optional)<input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="Hi, we seem to have similar habits…" /></label>
              </div>
              <small className="rm-fine">Your number is shared with {p.firstName} only if they accept.</small>
              {msg && <p className={msg.bad ? 'hs-error' : 'hs-ok'}>{msg.text}</p>}
              <div className="hs-admin-actions">
                <button className="hs-btn hs-btn-green" disabled={busy}>{busy ? <Loader2 size={15} className="hs-spin" /> : <Heart size={15} />} Send request</button>
                <button type="button" className="hs-btn hs-btn-soft" onClick={() => setOpen(false)}>Cancel</button>
              </div>
            </form>
          )
          : (
            <div className="hs-admin-actions">
              <button className="hs-btn hs-btn-green" onClick={() => setOpen(true)}><Heart size={15} /> I&apos;m interested</button>
              <ShareButton post={p} />
              <button className="hs-btn hs-btn-soft" onClick={() => void report()}><Flag size={14} /> Report</button>
            </div>
          )}
    </article>
  )
}

/* ------------------------------ My post ------------------------------ */

function MyPost({ user, mine, onChange }: { user: User; mine: { post: RoommatePost; whatsapp: string } | null | undefined; onChange: (m: { post: RoommatePost; whatsapp: string } | null) => void }) {
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  if (mine === undefined) return <p className="hs-empty">Loading…</p>
  if (!mine || editing) {
    return (
      <PostForm
        user={user} initial={mine}
        onCancel={mine ? () => setEditing(false) : undefined}
        onSaved={(m) => { onChange(m); setEditing(false) }}
      />
    )
  }
  const { post } = mine
  async function toggleHidden() {
    setBusy(true); setErr('')
    try { onChange({ ...mine!, post: await roommateApi.setHidden(post.id, !post.hidden) }) } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  async function remove() {
    if (!window.confirm('Delete your roommate post and all requests on it?')) return
    setBusy(true); setErr('')
    try { await roommateApi.deletePost(post.id); onChange(null) } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  return (
    <section className="hs-panel">
      <div className={`rm-status ${post.status}`}>
        {post.status === 'pending' && <><Clock size={18} /><span><strong>Waiting for admin approval.</strong> Nobody can see your post until it is approved.</span></>}
        {post.status === 'approved' && <><Check size={18} /><span><strong>Approved.</strong> {post.hidden ? 'You have hidden it, so others cannot see it.' : 'Students of the same gender can see it.'}</span></>}
        {post.status === 'rejected' && <><X size={18} /><span><strong>Not approved.</strong> {post.rejectReason || 'Please edit it and it will be reviewed again.'}</span></>}
      </div>
      {err && <p className="hs-error" role="alert">{err}</p>}
      <PostCardPreview post={post} phone={mine.whatsapp} />
      <div className="hs-admin-actions">
        <button className="hs-btn hs-btn-green" onClick={() => setEditing(true)}><Pencil size={14} /> Edit</button>
        {post.status === 'approved' && !post.hidden && <ShareButton post={post} />}
        {post.status === 'approved' && <button className="hs-btn hs-btn-soft" disabled={busy} onClick={() => void toggleHidden()}>{post.hidden ? <><Eye size={14} /> Show again</> : <><EyeOff size={14} /> Hide</>}</button>}
        <button className="hs-btn hs-btn-danger" disabled={busy} onClick={() => void remove()}><Trash2 size={14} /> Delete</button>
      </div>
      <small className="rm-fine">Editing your post sends it back to the admin for approval.</small>
    </section>
  )
}

function PostCardPreview({ post, phone }: { post: RoommatePost; phone: string }) {
  return (
    <div className="rm-preview">
      <h3>{post.firstName} <small>{post.gender === 'female' ? 'Female' : 'Male'} · {post.course} · Year {post.year}</small></h3>
      <p><strong>Budget:</strong> {kes(post.budgetMin)} – {kes(post.budgetMax)} · <strong>Area:</strong> {post.area}{post.roomType ? ` · ${post.roomType}` : ''}</p>
      <p>{post.hasRoom ? `Has a room at ${post.hostelName}` : 'Looking for a room too'}</p>
      <div className="hs-pchips">{LIFESTYLE_QUESTIONS.map((q) => <span key={q.key} className="hs-pchip included">{lifestyleLabel(q.key, post.lifestyle[q.key])}</span>)}</div>
      {post.bio && <p className="hs-desc">{post.bio}</p>}
      <p className="hs-updated">Your number ({showPhone(phone)}) is private.</p>
    </div>
  )
}

function PostForm({ user, initial, onSaved, onCancel }: {
  user: User; initial: { post: RoommatePost; whatsapp: string } | null; onSaved: (m: { post: RoommatePost; whatsapp: string }) => void; onCancel?: () => void
}) {
  const p = initial?.post
  const [firstName, setFirstName] = useState(p?.firstName ?? (user.displayName ?? '').split(' ')[0])
  const [gender, setGender] = useState<Gender | ''>(p?.gender ?? rememberedGender())
  const [course, setCourse] = useState(p?.course ?? '')
  const [year, setYear] = useState(String(p?.year ?? 1))
  const [budgetMin, setBudgetMin] = useState(String(p?.budgetMin ?? ''))
  const [budgetMax, setBudgetMax] = useState(String(p?.budgetMax ?? ''))
  const [roomType, setRoomType] = useState(p?.roomType ?? '')
  const [area, setArea] = useState(p?.area ?? '')
  const [hasRoom, setHasRoom] = useState(p?.hasRoom ?? false)
  const [hostelName, setHostelName] = useState(p?.hostelName ?? '')
  const [lifestyle, setLifestyle] = useState<Lifestyle>(p?.lifestyle ?? DEFAULT_LIFESTYLE)
  const [bio, setBio] = useState(p?.bio ?? '')
  const [phone, setPhone] = useState(initial?.whatsapp ?? '')
  const [agree, setAgree] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault(); setErr('')
    const wa = normalizePhone(phone)
    const lo = Number(budgetMin), hi = Number(budgetMax)
    if (!gender) return setErr('Choose your gender.')
    if (!firstName.trim() || !course.trim() || !area.trim()) return setErr('Fill in your name, course and area.')
    if (!Number.isFinite(lo) || !Number.isFinite(hi) || budgetMin === '' || budgetMax === '' || lo < 0 || hi < lo) return setErr('Enter a budget range, with the maximum at least the minimum.')
    if (hasRoom && !hostelName.trim()) return setErr('Say which hostel your room is in.')
    if (!wa) return setErr('Enter a valid Kenyan WhatsApp number, e.g. 0712 345 678.')
    if (!agree) return setErr('Please tick the consent box.')
    const input: PostInput = {
      firstName: firstName.trim(), gender, course: course.trim(), year: Number(year), budgetMin: lo, budgetMax: hi,
      roomType: roomType.trim(), area: area.trim(), hasRoom, hostelName: hasRoom ? hostelName.trim() : '', lifestyle, bio: bio.trim(),
    }
    setBusy(true)
    try {
      const post = await roommateApi.savePost(user.uid, p?.id ?? null, input, wa)
      rememberGender(gender)
      onSaved({ post, whatsapp: wa })
    } catch (e2) { setErr((e2 as Error).message) } finally { setBusy(false) }
  }

  return (
    <form className="hs-panel hs-form" onSubmit={submit}>
      <h2>{p ? 'Edit your roommate post' : 'Create your roommate post'}</h2>
      <p>The admin reviews every post before it appears. Only your first name, course and answers below are shown, never your number.</p>
      <fieldset>
        <legend>About you</legend>
        <div className="hs-fgrid">
          <label>First name<input value={firstName} onChange={(e) => setFirstName(e.target.value)} maxLength={30} /></label>
          <label>Gender
            <select value={gender} onChange={(e) => setGender(e.target.value as Gender)} disabled={Boolean(p)}>
              <option value="">Select…</option><option value="male">Male</option><option value="female">Female</option>
            </select>
          </label>
          <label>Course<input value={course} onChange={(e) => setCourse(e.target.value)} maxLength={60} placeholder="e.g. BSc Computer Science" /></label>
          <label>Year of study<select value={year} onChange={(e) => setYear(e.target.value)}>{[1, 2, 3, 4, 5, 6].map((y) => <option key={y} value={y}>Year {y}</option>)}</select></label>
        </div>
      </fieldset>
      <fieldset>
        <legend>What you are looking for</legend>
        <div className="hs-fgrid">
          <label>Budget from (KSh)<input type="number" min={0} value={budgetMin} onChange={(e) => setBudgetMin(e.target.value)} inputMode="numeric" /></label>
          <label>Budget up to (KSh)<input type="number" min={0} value={budgetMax} onChange={(e) => setBudgetMax(e.target.value)} inputMode="numeric" /></label>
          <label>Preferred area<input value={area} onChange={(e) => setArea(e.target.value)} maxLength={80} placeholder="e.g. Gate B" /></label>
          <label>Room type<input list="rm-room-types" value={roomType} onChange={(e) => setRoomType(e.target.value)} maxLength={40} placeholder="e.g. Double sharing" /></label>
        </div>
        <datalist id="rm-room-types">{ROOM_TYPE_SUGGESTIONS.map((t) => <option key={t} value={t} />)}</datalist>
        <label className="hs-check"><input type="checkbox" checked={hasRoom} onChange={(e) => setHasRoom(e.target.checked)} /> I already have a room and need someone to share it</label>
        {hasRoom && <label>Hostel name<input value={hostelName} onChange={(e) => setHostelName(e.target.value)} maxLength={120} /></label>}
      </fieldset>
      <fieldset>
        <legend>Your lifestyle (used for the match score)</legend>
        {LIFESTYLE_QUESTIONS.map((q) => (
          <div key={q.key} className="rm-q">
            <span>{q.label}</span>
            <div className="hs-chips">{q.options.map((o) => <button type="button" key={o.value} className={lifestyle[q.key] === o.value ? 'on' : ''} onClick={() => setLifestyle({ ...lifestyle, [q.key]: o.value })}>{o.label}</button>)}</div>
          </div>
        ))}
        <label>About you (optional)<textarea rows={3} value={bio} onChange={(e) => setBio(e.target.value)} maxLength={400} placeholder="Hobbies, what you want in a roommate…" /></label>
      </fieldset>
      <fieldset>
        <legend>Private contact</legend>
        <label>WhatsApp number<small>Shared only with students you accept, never shown publicly.</small><input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="0712 345 678" /></label>
        <label className="hs-check"><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} /> I agree that my details above (not my number) are shown to students of the same gender once the admin approves.</label>
      </fieldset>
      {err && <p className="hs-error" role="alert">{err}</p>}
      <div className="hs-admin-actions">
        <button className="hs-btn hs-btn-green" disabled={busy}>{busy ? <Loader2 size={15} className="hs-spin" /> : <Check size={15} />} {p ? 'Save and resubmit' : 'Submit for approval'}</button>
        {onCancel && <button type="button" className="hs-btn hs-btn-soft" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  )
}

/* ------------------------------ Requests ------------------------------ */

function Requests({ onChanged }: { onChanged: () => void }) {
  const [received, setReceived] = useState<ReceivedInterest[] | null>(null)
  const [sent, setSent] = useState<SentInterest[] | null>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState('')

  const load = useCallback(async () => {
    setErr('')
    try { const [r, s] = await Promise.all([roommateApi.received(), roommateApi.sent()]); setReceived(r); setSent(s) }
    catch (e) { setErr((e as Error).message); setReceived([]); setSent([]) }
  }, [])
  useEffect(() => { void load() }, [load])

  async function act(id: string, fn: () => Promise<void>) {
    setBusy(id); setErr('')
    try { await fn(); await load(); onChanged() } catch (e) { setErr((e as Error).message) } finally { setBusy('') }
  }

  return (
    <div className="rm-req">
      {err && <p className="hs-error" role="alert">{err}</p>}
      <section className="hs-panel">
        <h2>People interested in you</h2>
        {received === null ? <p className="hs-empty">Loading…</p> : received.length === 0 ? <p>No requests yet. Once your post is approved, they appear here.</p> : (
          <ul className="rm-list">
            {received.map((r) => (
              <li key={r.id}>
                <div><strong>{r.fromName}</strong><small>{timeAgo(r.createdAt)}</small>{r.note && <p>“{r.note}”</p>}</div>
                {r.status === 'pending' && (
                  <div className="hs-admin-actions">
                    <button className="hs-btn hs-btn-green" disabled={busy === r.id} onClick={() => void act(r.id, () => roommateApi.respond(r.id, true))}><Check size={14} /> Accept</button>
                    <button className="hs-btn hs-btn-soft" disabled={busy === r.id} onClick={() => void act(r.id, () => roommateApi.respond(r.id, false))}>Decline</button>
                  </div>
                )}
                {r.status === 'accepted' && r.whatsapp && <ContactLink phone={r.whatsapp} name={r.fromName} />}
                {r.status === 'declined' && <span className="rm-tag out">Declined</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="hs-panel">
        <h2>Requests you sent</h2>
        {sent === null ? <p className="hs-empty">Loading…</p> : sent.length === 0 ? <p>You have not contacted anyone yet.</p> : (
          <ul className="rm-list">
            {sent.map((s) => (
              <li key={s.id}>
                <div><strong>{s.firstName}</strong><small>{s.area} · {timeAgo(s.createdAt)}</small></div>
                {s.status === 'pending' && <><span className="rm-tag">Waiting for reply</span><button className="hs-btn hs-btn-soft" disabled={busy === s.id} onClick={() => void act(s.id, () => roommateApi.withdraw(s.id))}>Withdraw</button></>}
                {s.status === 'accepted' && s.whatsapp && <ContactLink phone={s.whatsapp} name={s.firstName} />}
                {s.status === 'declined' && <span className="rm-tag out">Not interested</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function ContactLink({ phone, name }: { phone: string; name: string }) {
  return (
    <div className="hs-actions rm-contact">
      <span><strong>{showPhone(phone)}</strong><small>Connected</small></span>
      <a href={waLink(phone, `Hi ${name}, we matched as roommates on Chuka Comrades.`)} target="_blank" rel="noopener noreferrer"><WhatsAppLogo size={16} /> WhatsApp</a>
    </div>
  )
}

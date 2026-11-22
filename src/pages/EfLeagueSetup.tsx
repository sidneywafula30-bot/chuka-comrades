import { useEffect, useState } from 'react'
import { Crown, Flag, LogOut, Plus, Users } from 'lucide-react'
import DriveImage from '../components/DriveImage'
import EfInvite from '../components/EfInvite'
import GoogleSignInButton from '../components/GoogleSignInButton'
import ImagePicker from '../components/ImagePicker'
import { usePayCfg } from '../components/EfPay'
import { driveImg, ef, leagueInviteLink, leagueLogoData, type LeagueInfo, type Me } from '../lib/efootball'
import type { InviteSpec } from '../lib/efCard'

type Msg = { ok: boolean; text: string } | null
const Note = ({ m }: { m: Msg }) => (m ? <p className={`cpl-msg${m.ok ? '' : ' bad'}`} role="status" style={{ marginTop: 10 }}>{m.text}</p> : null)

/** League logo, or the first letters of the name on a green tile. */
export function LeagueMark({ l, size = 56 }: { l: { name: string; logoId: string }; size?: number }) {
  const init = l.name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase()
  return (
    <span className="ef-lmark" style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {l.logoId ? <DriveImage id={l.logoId} w={Math.min(400, size * 3)} fallback={<b>{init}</b>} /> : <b>{init}</b>}
    </span>
  )
}

/** The league conditions. The creator and every joiner must tick the box; the server checks the version too. */
export function TermsAgree({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  const cfg = usePayCfg()
  return (
    <fieldset className="ef-terms">
      <legend>League conditions</legend>
      <ol>{cfg.terms.map((t) => <li key={t}>{t}</li>)}</ol>
      <label className="cpl-file"><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /> I have read and agree to these conditions</label>
    </fieldset>
  )
}

/** Invite card for a league: the logo is fetched as a data URL so the canvas picture can be saved and shared. */
export function LeagueInviteCard({ league }: { league: Pick<LeagueInfo, 'id' | 'name' | 'founder' | 'members' | 'code' | 'logoId'> }) {
  const [logo, setLogo] = useState<string | null>(league.logoId ? null : '')
  useEffect(() => { let dead = false; if (league.logoId) void leagueLogoData(league.id).then((d) => { if (!dead) setLogo(d) }); return () => { dead = true } }, [league.id, league.logoId])
  const cfg = usePayCfg()
  if (logo === null) return <p className="cpl-empty">Drawing the card…</p>
  const spec: InviteSpec = {
    kind: 'league', title: league.name, subtitle: league.founder ? `Set up by ${league.founder}` : 'Chuka eFootball league', logo,
    facts: [{ value: String(league.members), label: league.members === 1 ? 'Member' : 'Members' }, { value: 'Free', label: `First ${cfg.trialMatches} matches` }, { value: `${cfg.closeHour % 12 || 12} pm`, label: 'Results due' }],
    rules: `Fixtures at 00:00 · ${cfg.fixtureDays.join(', ')}`, link: leagueInviteLink(league.code), cta: 'Scan or tap to join',
  }
  return <EfInvite spec={spec} filename={`${league.name.replace(/\W+/g, '-').toLowerCase()}-invite.png`} message={`Join ${league.name} in the Chuka eFootball league. Daily fixtures, results by ${cfg.closeHour % 12 || 12} pm.`} />
}

/** Sign in / register gates shared by the create and join screens. Returns null when the person can go ahead. */
function Gate({ me, signedIn, onSignIn, what }: { me: Me | null; signedIn: boolean; onSignIn: () => void; what: string }) {
  if (!signedIn) return <><p className="cpl-sub" style={{ margin: '0 0 12px' }}>Sign in with Google to {what}.</p><GoogleSignInButton onClick={onSignIn} label="Sign in" /></>
  if (!me) return <p className="cpl-empty">Loading your account…</p>
  if (!me.profile) return <><p className="cpl-sub" style={{ margin: '0 0 12px' }}>Register your player profile first. It is free and takes a minute.</p><a className="lp-btn" href="#/efootball/profile">Register as a player</a></>
  return null
}

/* ---------------- create a league ---------------- */
export function CreateLeague({ me, signedIn, onSignIn, reload }: { me: Me | null; signedIn: boolean; onSignIn: () => void; reload: () => Promise<void> }) {
  const cfg = usePayCfg()
  const [name, setName] = useState('')
  const [about, setAbout] = useState('')
  const [logo, setLogo] = useState('')
  const [pub, setPub] = useState(false)
  const [agree, setAgree] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<Msg>(null)
  const [made, setMade] = useState<{ id: string; code: string; name: string } | null>(null)
  const p = me?.profile ?? null

  async function create() {
    setBusy(true); setMsg(null)
    try {
      const r = await ef<{ id: string; code: string; name: string }>('createLeague', { name, about, logo: logo || undefined, isPublic: pub, agree: true, terms: cfg.termsV })
      setMade(r); await reload()
    } catch (x) { setMsg({ ok: false, text: (x as Error).message }) }
    finally { setBusy(false) }
  }

  if (made) return (
    <div className="cpl-page">
      <h2>{made.name} is live</h2>
      <p className="cpl-sub">You are its first member. Share this card in your WhatsApp group so friends can join. Fixtures start at the next fixture day once two of you are in.</p>
      <section className="cpl-card"><LeagueInviteCard league={{ id: made.id, name: made.name, founder: p?.username ?? '', members: 1, code: made.code, logoId: logo ? 'pending' : '' }} /></section>
      <div className="ef-actions"><a className="lp-btn" href="#/efootball/league">Go to my league</a></div>
    </div>
  )
  const gate = <Gate me={me} signedIn={signedIn} onSignIn={onSignIn} what="start a league" />
  return (
    <div className="cpl-page">
      <a className="cpl-link" href="#/efootball/league">Back to leagues</a>
      <h2>Start a league</h2>
      <p className="cpl-sub">A league is a closed group: you only play, and are ranked against, the people inside it. Hostel, friends, year group, club. It is free and goes live at once.</p>
      {gate ? <section className="cpl-card">{gate}</section> : p?.league ? (
        <section className="cpl-card"><p className="cpl-sub" style={{ margin: '0 0 12px' }}>You are already in <strong>{p.league.name}</strong>. Leave it first (League, Invite &amp; settings), then start a new one.</p><a className="lp-btn" href="#/efootball/league">Open my league</a></section>
      ) : (
        <form className="cpl-card cpl-form cpl-wide" onSubmit={(e) => { e.preventDefault(); void create() }}>
          <label>League name<input type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="e.g. Hostel B Legends" required /></label>
          <label>About (optional)<input type="text" value={about} onChange={(e) => setAbout(e.target.value)} maxLength={140} placeholder="One line about who this league is for" /></label>
          <fieldset className="cpl-fs">
            <legend>Logo (optional)</legend>
            <ImagePicker current="" fallback={<Users size={26} />} label="league logo" max={400} onChange={(v) => setLogo(v.data)} />
          </fieldset>
          <label className="cpl-file"><input type="checkbox" checked={pub} onChange={(e) => setPub(e.target.checked)} /> Public: show this league in the list so anyone can find and join it. Leave off for invite-only.</label>
          <TermsAgree checked={agree} onChange={setAgree} />
          <button className="lp-btn" disabled={busy || !agree || name.trim().length < 3}>{busy ? 'Creating…' : 'Create league'}</button>
          <Note m={msg} />
        </form>
      )}
    </div>
  )
}

/* ---------------- the invite page: who the league is, the conditions, Join ---------------- */
export function InvitePage({ code, me, signedIn, onSignIn, reload }: { code: string; me: Me | null; signedIn: boolean; onSignIn: () => void; reload: () => Promise<void> }) {
  const cfg = usePayCfg()
  const [info, setInfo] = useState<LeagueInfo | null | undefined>(undefined)
  const [agree, setAgree] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<Msg>(null)
  const [done, setDone] = useState(false)
  useEffect(() => { try { sessionStorage.setItem('ef-invite', code) } catch { /* private mode */ } ef<LeagueInfo>('leagueInfo', { code }).then(setInfo).catch(() => setInfo(null)) }, [code])
  const p = me?.profile ?? null

  async function join() {
    setBusy(true); setMsg(null)
    try { await ef('joinLeague', { code, agree: true, terms: cfg.termsV }); await reload(); setDone(true); try { sessionStorage.removeItem('ef-invite') } catch { /* ignore */ } }
    catch (x) { setMsg({ ok: false, text: (x as Error).message }) }
    finally { setBusy(false) }
  }

  if (info === undefined) return <p className="cpl-empty">Opening the invite…</p>
  if (!info) return (
    <div className="cpl-page">
      <h2>This invite has moved</h2>
      <p className="cpl-sub">The link is no longer valid. The league may have been reset or closed. Ask your friend for a new invite card.</p>
      <div className="ef-actions"><a className="lp-btn" href="#/efootball/league">Browse leagues</a><a className="lp-btn ef-soft" href="#/efootball/league/new">Start your own</a></div>
    </div>
  )
  const mine = p?.league?.id === info.id
  const gate = <Gate me={me} signedIn={signedIn} onSignIn={onSignIn} what={`join ${info.name}`} />
  return (
    <div className="cpl-page">
      <section className="ef-invitehead">
        <LeagueMark l={info} size={84} />
        <div>
          <span className="ef-eyebrow">You are invited</span>
          <h2>{info.name}</h2>
          <p>{info.about || 'A Chuka eFootball league.'}</p>
          <p className="ef-invitemeta"><Users size={14} /> {info.members} {info.members === 1 ? 'member' : 'members'}{info.founder ? <> · <Crown size={14} /> {info.founder}</> : null}</p>
        </div>
      </section>
      <section className="cpl-card">
        {done || mine ? (
          <>
            <p className="cpl-msg">{done ? 'You are in.' : 'You are already in this league.'} Your first fixture comes at the next fixture day (00:00 on {cfg.fixtureDays.join(', ')}).</p>
            <div className="ef-actions"><a className="lp-btn" href="#/efootball/league">Open my league</a></div>
          </>
        ) : gate ?? (p?.league ? (
          <p className="cpl-sub" style={{ margin: 0 }}>You are already in <strong>{p.league.name}</strong>. A player can be in one league at a time. Leave it first, then open this invite again.</p>
        ) : (
          <>
            <TermsAgree checked={agree} onChange={setAgree} />
            <div className="ef-actions"><button className="lp-btn" disabled={busy || !agree} onClick={join}>{busy ? 'Joining…' : `Join ${info.name}`}</button></div>
            <p className="cpl-note" style={{ textAlign: 'left' }}>Your first {cfg.trialMatches} matches are free.</p>
            <Note m={msg} />
          </>
        ))}
      </section>
    </div>
  )
}

/* ---------------- no league yet: join with a code, browse public leagues, or start one ---------------- */
export function Discover({ signedIn }: { signedIn: boolean }) {
  const [list, setList] = useState<LeagueInfo[] | null>(null)
  const [err, setErr] = useState('')
  const [code, setCode] = useState('')
  useEffect(() => { ef<LeagueInfo[]>('leagues').then(setList).catch((e) => setErr((e as Error).message)) }, [])
  const clean = code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)
  return (
    <div className="cpl-page">
      <h2>Leagues</h2>
      <p className="cpl-sub">Every league is a closed group. Fixtures are made only between its members, and every league has its own table. Join one with a code from a friend, pick a public one, or start your own.</p>
      <div className="ef-lgrid2">
        <section className="cpl-card ef-startcard">
          <h3><Plus size={15} /> Start a league</h3>
          <p className="cpl-sub" style={{ margin: '0 0 12px' }}>Free and instant. Hostel, friends, year group or club.</p>
          <a className="lp-btn" href="#/efootball/league/new">Create a league</a>
        </section>
        <section className="cpl-card">
          <h3>Have an invite code?</h3>
          <form className="cpl-inline" onSubmit={(e) => { e.preventDefault(); if (clean.length >= 4) window.location.hash = `#/efootball/league/join/${clean}` }}>
            <input className="ef-sel ef-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. K7M2QX" aria-label="League invite code" maxLength={10} autoCapitalize="characters" />
            <button className="lp-btn" disabled={clean.length < 4}>Open</button>
          </form>
        </section>
      </div>
      {!signedIn && <p className="cpl-note" style={{ textAlign: 'left' }}>You can look around now. Sign in and register when you are ready to join.</p>}
      <h3 className="ef-h3">Public leagues</h3>
      {err && <p className="cpl-err" role="alert">{err}</p>}
      {!list && !err && <p className="cpl-empty">Loading…</p>}
      {list && !list.length && <p className="cpl-empty">No public leagues yet. Start the first one.</p>}
      <div className="ef-lgrid">
        {list?.map((l) => (
          <article className="ef-lcard" key={l.id}>
            <LeagueMark l={l} size={52} />
            <div>
              <strong>{l.name}</strong>
              <small>{l.members} {l.members === 1 ? 'member' : 'members'}{l.founder ? ` · by ${l.founder}` : ''}</small>
              {l.about && <small className="about">{l.about}</small>}
            </div>
            <span className="ef-lact"><a className="lp-btn" href={`#/efootball/league/join/${l.code}`}>Join</a><a className="cpl-link" href={`#/efootball/league/view/${l.id}`}>Table</a></span>
          </article>
        ))}
      </div>
    </div>
  )
}

/* ---------------- founder tools + everyone's leave / report ---------------- */
export function LeagueSettings({ league, isFounder, members, reload, onChanged }: {
  league: LeagueInfo; isFounder: boolean; members: { uid: string; username: string }[]; reload: () => Promise<void>; onChanged: () => void
}) {
  const [name, setName] = useState(league.name)
  const [about, setAbout] = useState(league.about)
  const [pub, setPub] = useState(league.isPublic)
  const [logo, setLogo] = useState<{ data: string; removed: boolean } | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<Msg>(null)
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true); setMsg(null)
    try { await fn(); await reload(); onChanged(); setMsg({ ok: true, text: ok }) }
    catch (x) { setMsg({ ok: false, text: (x as Error).message }) }
    finally { setBusy(false) }
  }
  return (
    <>
      {isFounder && (
        <section className="cpl-card cpl-form cpl-wide">
          <h3><Crown size={15} /> Founder settings</h3>
          <label>League name<input type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} /></label>
          <label>About<input type="text" value={about} onChange={(e) => setAbout(e.target.value)} maxLength={140} /></label>
          <fieldset className="cpl-fs">
            <legend>Logo</legend>
            <ImagePicker current={driveImg(league.logoId, 300)} fallback={<Users size={26} />} label="league logo" max={400} onChange={setLogo} />
          </fieldset>
          <label className="cpl-file"><input type="checkbox" checked={pub} onChange={(e) => setPub(e.target.checked)} /> Public: listed so anyone can find and join it</label>
          <button className="lp-btn" type="button" disabled={busy || name.trim().length < 3} onClick={() => run(() => ef('setLeagueInfo', { name, about, isPublic: pub, ...(logo ? (logo.removed ? { removeLogo: true } : { logo: logo.data }) : {}) }), 'League updated.')}>{busy ? 'Saving…' : 'Save changes'}</button>
          <div className="ef-resetbox">
            <p className="cpl-note" style={{ textAlign: 'left', margin: 0 }}>If the invite leaks into the wrong group, make a new code. Cards and links with the old code stop working.</p>
            <button className="lp-btn cpl-danger" type="button" disabled={busy} onClick={() => confirm('Make a new invite code? Old cards and links stop working.') && run(() => ef('resetLeagueCode'), 'New invite code made. Share the new card.')}>Reset invite link</button>
          </div>
          <Note m={msg} />
        </section>
      )}
      {isFounder && (
        <section className="cpl-card">
          <h3>Members</h3>
          {members.map((m) => (
            <div className="cpl-row" key={m.uid}>
              <div><strong>{m.username}</strong></div>
              {m.uid !== league.founderUid && <button className="lp-btn cpl-danger" disabled={busy} onClick={() => confirm(`Remove ${m.username} from the league?`) && run(() => ef('removeMember', { uid: m.uid }), `${m.username} was removed.`)}>Remove</button>}
            </div>
          ))}
        </section>
      )}
      <section className="cpl-card">
        <h3>Your membership</h3>
        <div className="ef-actions" style={{ marginTop: 0 }}>
          <button className="lp-btn cpl-danger" disabled={busy} onClick={() => confirm('Leave this league?') && run(() => ef('leaveLeague'), 'You left the league.')}><LogOut size={14} /> Leave league</button>
          {!isFounder && <button className="lp-btn ef-soft" disabled={busy} onClick={() => run(() => ef('reportLeague', { id: league.id }), 'Reported. The admin will look at it.')}><Flag size={14} /> Report this league</button>}
        </div>
        {isFounder && <p className="cpl-note" style={{ textAlign: 'left' }}>If you leave, the league passes to its longest-standing member.</p>}
        {!isFounder && <Note m={msg} />}
      </section>
    </>
  )
}

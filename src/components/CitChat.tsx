import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import type { User } from 'firebase/auth'
import { MessageCircle, Send } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { errMsg } from '../lib/hub'
import './Cit.css'

export type CitMsg = { id: number; room: string; user_id: string; user_name: string; is_staff: boolean; body: string; created_at: string }
type Props = { room: string; user: User | null; onSignIn: () => void; isAdmin?: boolean; title?: string; sub?: string; placeholder?: string }

const when = (s: string) => new Date(s).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })

/** One realtime chat room. Used for the live chat, the discussion under a class, and the private student-to-admin thread. */
export function ChatRoom({ room, user, onSignIn, isAdmin = false, title = 'Chat', sub, placeholder = 'Write a message…' }: Props) {
  const [msgs, setMsgs] = useState<CitMsg[]>([])
  const [text, setText] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const uid = user?.uid ?? ''

  // load the latest messages, then listen for new and deleted ones
  useEffect(() => {
    if (!supabase || !user) return
    let alive = true
    setMsgs([])
    void supabase.from('cit_messages').select('*').eq('room', room).order('id', { ascending: false }).limit(60).then(({ data, error }) => {
      if (!alive) return
      if (error) setErr(error.message)
      else setMsgs(((data ?? []) as CitMsg[]).reverse())
    })
    const ch = supabase.channel(`cit:${room}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'cit_messages', filter: `room=eq.${room}` }, (p) => {
        const m = p.new as CitMsg
        setMsgs((cur) => (cur.some((x) => x.id === m.id) ? cur : [...cur, m].slice(-200)))
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'cit_messages' }, (p) => {
        const id = (p.old as { id?: number }).id
        if (id) setMsgs((cur) => cur.filter((x) => x.id !== id))
      })
      .subscribe()
    return () => { alive = false; void supabase?.removeChannel(ch) }
  }, [room, user])

  useEffect(() => { box.current?.scrollTo({ top: box.current.scrollHeight }) }, [msgs])

  async function send(e: FormEvent) {
    e.preventDefault()
    const body = text.trim()
    if (!body || !supabase) return
    setBusy(true); setErr('')
    const { data, error } = await supabase.from('cit_messages').insert({ room, body, user_name: user?.displayName ?? '' }).select().single()
    setBusy(false)
    if (error) { setErr(error.message); return }
    setText('')
    const m = data as CitMsg
    setMsgs((cur) => (cur.some((x) => x.id === m.id) ? cur : [...cur, m]))
  }
  async function remove(id: number) {
    if (!supabase) return
    const { error } = await supabase.from('cit_messages').delete().eq('id', id)
    if (error) setErr(error.message); else setMsgs((cur) => cur.filter((x) => x.id !== id))
  }
  async function mute(m: CitMsg) {
    if (!supabase || !window.confirm(`Mute ${m.user_name || 'this person'}? They will not be able to post.`)) return
    const { error } = await supabase.rpc('cit_mute', { target: m.user_id, why: 'Muted from chat' })
    setErr(error ? error.message : `${m.user_name || 'User'} is muted.`)
  }

  return (
    <div className="cit-chat">
      <div className="cit-chat-head"><strong><MessageCircle size={15} style={{ verticalAlign: -2 }} /> {title}</strong>{sub && <small>{sub}</small>}</div>
      {!supabase ? <p className="cit-note">Chat is not connected yet. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env and run the chat SQL.</p>
        : !user ? <div className="cit-note">Sign in to read and join the chat. <button className="sl-primary small" onClick={onSignIn}>Sign in</button></div>
        : (
          <>
            <div className="cit-msgs" ref={box}>
              {msgs.length === 0 && <div className="cit-empty">No messages yet. Say hello 👋</div>}
              {msgs.map((m) => (
                <div key={m.id} className={`cit-msg ${m.user_id === uid ? 'mine' : ''} ${m.is_staff ? 'staff' : ''}`}>
                  <b>{m.user_id === uid ? 'You' : m.user_name || 'Student'}{m.is_staff && <span className="cit-badge">Admin</span>}
                    {isAdmin && !m.is_staff && <span className="cit-tools"><button onClick={() => void remove(m.id)}>Delete</button><button onClick={() => void mute(m)}>Mute</button></span>}
                    {isAdmin && m.is_staff && <span className="cit-tools"><button onClick={() => void remove(m.id)}>Delete</button></span>}
                  </b>
                  {m.body}<small>{when(m.created_at)}</small>
                </div>
              ))}
            </div>
            {err && <p className="cit-note" style={{ color: '#b3261e', paddingTop: 0 }}>{err}</p>}
            <form className="cit-send" onSubmit={send}>
              <input value={text} onChange={(e) => setText(e.target.value)} maxLength={500} placeholder={placeholder} aria-label="Message" />
              <button className="sl-primary small" disabled={busy || !text.trim()} aria-label="Send"><Send size={15} /></button>
            </form>
          </>
        )}
    </div>
  )
}

/** The student's private thread with the admin, with WhatsApp as a backup. */
export function StudentChat({ user, onSignIn, whatsapp }: { user: User | null; onSignIn: () => void; whatsapp: string }) {
  const wa = `https://wa.me/${whatsapp}?text=${encodeURIComponent('Hello CIT admin, ')}`
  return (
    <>
      <div className="sl-page-head"><div><span className="sl-kicker">ASK THE ADMIN</span><h1>Chat with the admin</h1></div></div>
      <p className="sl-sub" style={{ marginBottom: 12 }}>Ask about classes, payments or access. Only you and the admin can see this chat. Not getting a reply? <a className="sl-link" href={wa} target="_blank" rel="noreferrer noopener">Message on WhatsApp</a>.</p>
      <ChatRoom room={user ? `dm:${user.uid}` : 'live'} user={user} onSignIn={onSignIn} title="CIT admin" sub="Private" placeholder="Type your question…" />
    </>
  )
}

type InboxRow = { room: string; user_id: string; user_name: string; last_body: string; last_at: string; from_staff: boolean }

/** Admin view: every student thread, newest first, opening one shows the conversation. */
export function AdminInbox({ user, onSignIn }: { user: User | null; onSignIn: () => void }) {
  const [rows, setRows] = useState<InboxRow[] | null>(null)
  const [open, setOpen] = useState('')
  const [err, setErr] = useState('')
  const load = useCallback(async () => {
    if (!supabase) return
    const { data, error } = await supabase.rpc('cit_inbox')
    if (error) { setErr(errMsg(error)); setRows([]); return }
    setRows(((data ?? []) as InboxRow[]).sort((a, b) => (a.last_at < b.last_at ? 1 : -1)))
  }, [])
  useEffect(() => {
    void load()
    if (!supabase) return
    const ch = supabase.channel('cit:inbox')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'cit_messages' }, (p) => { if (String((p.new as CitMsg).room).startsWith('dm:')) void load() })
      .subscribe()
    return () => { void supabase?.removeChannel(ch) }
  }, [load])
  return (
    <>
      {err && <p className="sl-alert err">{err}</p>}
      {!rows ? <p className="sl-sub">Loading…</p> : rows.length === 0 ? <p className="sl-sub">No student messages yet.</p> : (
        <div className="cit-inbox">{rows.map((r) => (
          <button key={r.room} className={open === r.room ? 'on' : ''} onClick={() => setOpen(r.room)}>
            <b>{r.user_name}{!r.from_staff && ' · needs reply'}</b><span>{r.from_staff ? 'You: ' : ''}{r.last_body}</span>
          </button>))}
        </div>
      )}
      {open && <ChatRoom key={open} room={open} user={user} onSignIn={onSignIn} isAdmin title={rows?.find((r) => r.room === open)?.user_name ?? 'Student'} sub="Private" placeholder="Reply…" />}
    </>
  )
}

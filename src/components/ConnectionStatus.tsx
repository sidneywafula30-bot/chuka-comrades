import type { User } from 'firebase/auth'
import { firebaseReady } from '../lib/firebase'
import { supabaseReady } from '../lib/supabase'
import type { SyncResult } from '../lib/profile'
import './ConnectionStatus.css'

/** Developer-only badge (hidden in production builds). */
export default function ConnectionStatus({ user, sync }: { user: User | null; sync: SyncResult | null }) {
  if (!import.meta.env.DEV) return null

  const syncing = user && (!sync || sync.uid !== user.uid)
  const rows: [string, 'ok' | 'bad' | 'wait', string][] = [
    ['Firebase keys', firebaseReady ? 'ok' : 'bad', firebaseReady ? 'set' : 'missing'],
    ['Supabase keys', supabaseReady ? 'ok' : 'bad', supabaseReady ? 'set' : 'missing'],
    ['Signed in', user ? 'ok' : 'wait', user ? (user.email ?? user.uid) : 'no'],
    [
      'Supabase profile',
      !user ? 'wait' : syncing ? 'wait' : sync?.ok ? 'ok' : 'bad',
      !user ? '—' : syncing ? 'syncing…' : sync?.ok ? 'saved' : (sync?.error ?? 'failed'),
    ],
  ]

  return (
    <aside className="conn-status" aria-label="Developer connection status">
      <strong>Dev status</strong>
      {rows.map(([label, state, text]) => (
        <div key={label} className="conn-row">
          <span className={`conn-dot ${state}`} />
          <span>{label}</span>
          <em title={text}>{text}</em>
        </div>
      ))}
    </aside>
  )
}

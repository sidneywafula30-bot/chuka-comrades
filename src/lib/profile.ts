import type { User } from 'firebase/auth'
import { supabase } from './supabase'

export type SyncResult = { uid: string; ok: boolean; error?: string }

/** Creates/updates the signed-in Firebase user's row in Supabase `profiles`. */
export async function syncProfile(user: User): Promise<SyncResult> {
  if (!supabase) return { uid: user.uid, ok: false, error: 'Supabase keys not set' }

  const { error } = await supabase.from('profiles').upsert(
    {
      id: user.uid, // Firebase UID
      email: user.email,
      display_name: user.displayName,
      photo_url: user.photoURL,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  )

  return error ? { uid: user.uid, ok: false, error: error.message } : { uid: user.uid, ok: true }
}

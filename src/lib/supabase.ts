import { createClient } from '@supabase/supabase-js'
import { auth } from './firebase'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabaseReady = Boolean(url && anonKey)

/**
 * Supabase client that uses Firebase as the login system.
 *
 * `accessToken` hands Supabase the signed-in user's Firebase ID token on every
 * request (Supabase "Third-Party Auth" -> Firebase). When nobody is signed in
 * it returns null and the client falls back to the public anon key.
 *
 * Note: with `accessToken`, supabase.auth.* is disabled on purpose; Firebase
 * owns sign-in/sign-out.
 *
 * Safe in the browser only because Row Level Security is enabled on tables.
 */
export const supabase =
  url && anonKey
    ? createClient(url, anonKey, {
        accessToken: async () => (await auth?.currentUser?.getIdToken(false)) ?? null,
      })
    : null

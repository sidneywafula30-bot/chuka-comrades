import { initializeApp, type FirebaseApp } from 'firebase/app'
import {
  GoogleAuthProvider,
  browserLocalPersistence,
  browserPopupRedirectResolver,
  browserSessionPersistence,
  indexedDBLocalPersistence,
  initializeAuth,
  type Auth,
} from 'firebase/auth'

const apiKey = import.meta.env.VITE_FIREBASE_API_KEY as string | undefined

// If .env is not filled in yet, the app still runs (sign-in is just disabled).
export const firebaseReady = Boolean(apiKey)

let app: FirebaseApp | null = null
export let auth: Auth | null = null

if (firebaseReady) {
  app = initializeApp({
    apiKey,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  })
  // Keep people signed in: try IndexedDB first, then localStorage, then sessionStorage.
  // Firebase uses the first one the browser actually allows, so a phone that blocks
  // IndexedDB no longer ends up with a session that vanishes on every visit.
  auth = initializeAuth(app, {
    persistence: [indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence],
    popupRedirectResolver: browserPopupRedirectResolver, // needed for signInWithPopup
  })

  // Ask the browser not to evict this site's saved data (login included) when storage is low.
  try { void navigator.storage?.persist?.() } catch { /* not supported */ }
}

export const googleProvider = new GoogleAuthProvider()
// Always show the account chooser so people with several Google accounts pick the right one.
googleProvider.setCustomParameters({ prompt: 'select_account' })

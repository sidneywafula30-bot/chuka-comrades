import { useCallback, useEffect, useState } from 'react'
import { Bell, RefreshCw } from 'lucide-react'
import { ago, oz, type OzNotification } from '../lib/ozone'
import './OzNotifications.css'

export default function Notifications() {
  const [items, setItems] = useState<OzNotification[]>([])
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setBusy(true)
    try {
      setItems(await oz<OzNotification[]>('notifications_list'))
      setError('')
    } catch (e) {
      setError((e as Error).message || 'Could not load updates.')
    } finally {
      setBusy(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  return (
    <section className="cpl-home oz-notifications">
      <div className="oz-notifications-head">
        <div>
          <span className="oz-notifications-kicker"><Bell size={14} /> CAMPUS BULLETIN</span>
          <h1>O-Zone Updates</h1>
          <p>Announcements officially published by the Chuka O-Zone admin team.</p>
        </div>
        <button type="button" className="cpl-link oz-notifications-refresh" onClick={() => void load()} disabled={busy} aria-label="Refresh updates">
          <RefreshCw size={16} className={busy ? 'oz-spin' : ''} /> Refresh
        </button>
      </div>

      {error && <p className="cpl-err" role="alert">{error}</p>}
      {busy && !items.length && <p className="cpl-empty">Loading announcements…</p>}
      {!busy && !error && !items.length && (
        <div className="oz-notification-empty"><Bell size={28} /><strong>No announcements yet</strong><span>New official O-Zone updates will appear here when published.</span></div>
      )}
      <div className="oz-notification-list">
        {items.map((item) => (
          <article className="oz-notification" key={item.id}>
            <span className="oz-notification-icon"><Bell size={17} /></span>
            <div className="oz-notification-copy">
              <div className="oz-notification-meta"><span>O-ZONE ANNOUNCEMENT</span><time dateTime={item.publishedAt}>{ago(item.publishedAt)}</time></div>
              <h2>{item.title}</h2>
              <p>{item.body}</p>
            </div>
          </article>
        ))}
      </div>
      <p className="cpl-note">Only announcements successfully published by an admin are shown here. Private submissions and pending moderation items are never displayed.</p>
    </section>
  )
}

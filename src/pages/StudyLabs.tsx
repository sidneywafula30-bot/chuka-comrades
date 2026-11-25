import type { User } from 'firebase/auth'
import { ArrowLeft, BookOpen } from 'lucide-react'
import './StudyLabs.css'

type Props = { user: User | null; onSignIn: () => void; onBack: () => void }

export default function StudyLabs({ onBack }: Props) {
  return (
    <div className="sl-shell">
      <div className="sl-topbar">
        <button className="sl-back" onClick={onBack}><ArrowLeft size={18} /> Back</button>
      </div>
      <div className="sl-empty" style={{ padding: '120px 20px' }}>
        <BookOpen size={44} />
        <h1 style={{ margin: '8px 0 0', fontSize: 36 }}>Study Labs</h1>
        <h3>Coming soon</h3>
        <p>Notes, past papers and study partners are on the way. Check back soon!</p>
      </div>
    </div>
  )
}

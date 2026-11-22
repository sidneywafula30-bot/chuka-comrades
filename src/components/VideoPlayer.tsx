import { ExternalLink } from 'lucide-react'
import { Modal } from './HubUi'
import './Cit.css'

export type PlayVideo = { videoId: string; title: string }

/** Plays a YouTube video inside the app (privacy-friendly embed). */
export default function VideoModal({ video, onClose }: { video: PlayVideo; onClose: () => void }) {
  return (
    <Modal title={video.title} onClose={onClose}>
      <div className="cit-vid">
        <iframe src={`https://www.youtube-nocookie.com/embed/${video.videoId}?autoplay=1&rel=0`} title={video.title}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen />
      </div>
      <p style={{ marginTop: 10 }}><a className="sl-mini ghost" href={`https://www.youtube.com/watch?v=${video.videoId}`} target="_blank" rel="noreferrer noopener">Open on YouTube <ExternalLink size={12} /></a></p>
    </Modal>
  )
}

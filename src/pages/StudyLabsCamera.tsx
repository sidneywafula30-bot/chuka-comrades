import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, Check, LoaderCircle, RefreshCw, X, Zap, ZapOff } from 'lucide-react'

type Props = {
  /** Number of pages already taken, and the most allowed. */
  count: number
  max: number
  /** Called with each captured page (a JPEG file). The camera stays open for the next page. */
  onCapture: (file: File) => void
  /** Called when the student taps Done, or the camera cannot be used. */
  onClose: () => void
}

type TorchCaps = MediaTrackCapabilities & { torch?: boolean }

/** Live viewfinder: take page after page without leaving the camera. Falls back with a clear message if the camera is blocked. */
export default function LiveCamera({ count, max, onCapture, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [facing, setFacing] = useState<'environment' | 'user'>('environment')
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [torchOk, setTorchOk] = useState(false)
  const [torchOn, setTorchOn] = useState(false)
  const [flash, setFlash] = useState(false)
  const [busy, setBusy] = useState(false)

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  useEffect(() => {
    let live = true
    setReady(false); setError(''); setTorchOk(false); setTorchOn(false)
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('This browser cannot open the camera here. Use "Choose photos" instead.')
      return
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1440 } }, audio: false })
      .then(async (stream) => {
        if (!live) { stream.getTracks().forEach((t) => t.stop()); return }
        stop()
        streamRef.current = stream
        const v = videoRef.current
        if (v) { v.srcObject = stream; await v.play().catch(() => {}) }
        const track = stream.getVideoTracks()[0]
        const caps = (track?.getCapabilities?.() ?? {}) as TorchCaps
        setTorchOk(Boolean(caps.torch))
        setReady(true)
      })
      .catch((e: unknown) => {
        if (!live) return
        const name = e instanceof DOMException ? e.name : ''
        setError(
          name === 'NotAllowedError' || name === 'SecurityError'
            ? 'Camera permission was blocked. Allow the camera for this site in your browser settings, or use "Choose photos".'
            : name === 'NotFoundError'
              ? 'No camera was found on this device. Use "Choose photos" instead.'
              : 'Could not start the camera. Close other apps that use it, or use "Choose photos".',
        )
      })
    return () => { live = false; stop() }
  }, [facing, stop])

  async function toggleTorch() {
    const track = streamRef.current?.getVideoTracks()[0]
    if (!track) return
    const next = !torchOn
    try {
      await track.applyConstraints({ advanced: [{ torch: next } as unknown as MediaTrackConstraintSet] })
      setTorchOn(next)
    } catch { setTorchOk(false) }
  }

  function snap() {
    const v = videoRef.current
    if (!v || !ready || busy || count >= max || !v.videoWidth) return
    setBusy(true)
    const c = document.createElement('canvas')
    c.width = v.videoWidth; c.height = v.videoHeight
    c.getContext('2d')?.drawImage(v, 0, 0, c.width, c.height)
    c.toBlob((blob) => {
      setBusy(false)
      if (!blob) return
      setFlash(true); setTimeout(() => setFlash(false), 140)
      onCapture(new File([blob], `page-${count + 1}.jpg`, { type: 'image/jpeg' }))
    }, 'image/jpeg', 0.92)
  }

  const full = count >= max

  if (error) {
    return (
      <div className="sl-cam-error">
        <Camera size={28} />
        <p>{error}</p>
        <button className="sl-primary" onClick={onClose}>Back</button>
      </div>
    )
  }

  return (
    <div className="sl-cam">
      <div className="sl-cam-view">
        <video ref={videoRef} playsInline muted autoPlay />
        <div className="sl-cam-guide" aria-hidden="true" />
        {flash && <div className="sl-cam-flash" />}
        {!ready && <div className="sl-cam-wait"><LoaderCircle className="sl-spin" size={24} /><span>Starting camera…</span></div>}
        <span className="sl-cam-count">{count} / {max} pages</span>
        <div className="sl-cam-tools">
          {torchOk && <button type="button" className="sl-cam-round" onClick={() => void toggleTorch()} aria-label={torchOn ? 'Turn light off' : 'Turn light on'}>{torchOn ? <Zap size={18} /> : <ZapOff size={18} />}</button>}
          <button type="button" className="sl-cam-round" onClick={() => setFacing(facing === 'environment' ? 'user' : 'environment')} aria-label="Switch camera"><RefreshCw size={18} /></button>
        </div>
      </div>
      <p className="sl-sub sl-cam-tip">{full ? 'You have taken the most pages allowed. Tap Done.' : 'Fit the whole page inside the frame, keep it flat and well lit, then tap the button. Take every page in order.'}</p>
      <div className="sl-cam-bar">
        <button type="button" className="sl-ghost" onClick={onClose}><X size={14} /> {count ? 'Done' : 'Cancel'}</button>
        <button type="button" className="sl-cam-shutter" onClick={snap} disabled={!ready || busy || full} aria-label="Take photo"><span /></button>
        <button type="button" className="sl-primary small" onClick={onClose} disabled={!count}><Check size={14} /> Use {count || ''} page{count === 1 ? '' : 's'}</button>
      </div>
    </div>
  )
}

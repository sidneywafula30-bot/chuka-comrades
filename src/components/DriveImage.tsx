import { useEffect, useMemo, useState, type ReactNode } from 'react'

/**
 * Shows a Google Drive image by file id. Tries the thumbnail URL first, then two other public Drive URL forms,
 * and only then shows the placeholder. (Google sometimes refuses one form for a file or when many load at once.)
 */
export default function DriveImage({ id, w = 400, alt = '', fallback }: { id: string; w?: number; alt?: string; fallback?: ReactNode }) {
  const list = useMemo(() => {
    if (!id) return []
    const e = encodeURIComponent(id)
    return [`https://drive.google.com/thumbnail?id=${e}&sz=w${w}`, `https://lh3.googleusercontent.com/d/${e}=w${w}`, `https://drive.google.com/uc?export=view&id=${e}`]
  }, [id, w])
  const [i, setI] = useState(0)
  useEffect(() => setI(0), [id])
  if (!list.length || i >= list.length) return <>{fallback ?? null}</>
  return <img src={list[i]} alt={alt} loading="lazy" referrerPolicy="no-referrer" onError={() => setI((n) => n + 1)} />
}

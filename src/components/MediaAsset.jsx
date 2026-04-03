import { useEffect, useRef, useState } from 'react'

export default function MediaAsset({
  src,
  alt,
  mediaType = 'photo',
  className = '',
  controls = true,
  autoPlayInView = false,
  muted = autoPlayInView,
  loop = autoPlayInView,
}) {
  const [failed, setFailed] = useState(false)
  const placeholderText = className.includes('avatar') ? '' : 'Sem midia'
  const videoRef = useRef(null)

  useEffect(() => {
    if (mediaType !== 'video' || !autoPlayInView || !videoRef.current) return undefined

    const element = videoRef.current
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!element) return

        if (entry.isIntersecting) {
          element.play().catch(() => {})
        } else {
          element.pause()
        }
      },
      {
        threshold: 0.65,
      },
    )

    observer.observe(element)

    return () => observer.disconnect()
  }, [autoPlayInView, mediaType, src])

  if (!src || failed) {
    return <div className={`${className} placeholder-cover`.trim()}>{placeholderText}</div>
  }

  if (mediaType === 'video') {
    return (
      <video
        ref={videoRef}
        className={className}
        src={src}
        controls={controls}
        playsInline
        autoPlay={autoPlayInView}
        muted={muted}
        loop={loop}
        preload="metadata"
        onError={() => setFailed(true)}
      />
    )
  }

  return <img className={className} src={src} alt={alt} onError={() => setFailed(true)} />
}

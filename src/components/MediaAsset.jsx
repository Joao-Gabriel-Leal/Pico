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
  expandable = false,
}) {
  const [failed, setFailed] = useState(false)
  const [expanded, setExpanded] = useState(false)
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

  const asset =
    mediaType === 'video' ? (
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
    ) : (
      <img className={className} src={src} alt={alt} onError={() => setFailed(true)} />
    )

  return (
    <>
      {expandable ? (
        <button
          className="media-expand-button"
          type="button"
          onClick={() => setExpanded(true)}
          aria-label="Expandir midia"
        >
          {asset}
        </button>
      ) : (
        asset
      )}

      {expandable && expanded ? (
        <div className="media-lightbox" role="dialog" aria-modal="true" onClick={() => setExpanded(false)}>
          <button
            className="media-lightbox-close"
            type="button"
            onClick={() => setExpanded(false)}
            aria-label="Fechar midia"
          >
            Fechar
          </button>
          <div className="media-lightbox-stage" onClick={(event) => event.stopPropagation()}>
            {mediaType === 'video' ? (
              <video className="media-lightbox-asset" src={src} controls autoPlay playsInline />
            ) : (
              <img className="media-lightbox-asset" src={src} alt={alt} />
            )}
          </div>
        </div>
      ) : null}
    </>
  )
}

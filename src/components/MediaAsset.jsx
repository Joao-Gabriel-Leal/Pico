import { useState } from 'react'

export default function MediaAsset({
  src,
  alt,
  mediaType = 'photo',
  className = '',
  controls = true,
}) {
  const [failed, setFailed] = useState(false)
  const placeholderText = className.includes('avatar') ? '' : 'Sem midia'

  if (!src || failed) {
    return <div className={`${className} placeholder-cover`.trim()}>{placeholderText}</div>
  }

  if (mediaType === 'video') {
    return (
      <video
        className={className}
        src={src}
        controls={controls}
        playsInline
        preload="metadata"
        onError={() => setFailed(true)}
      />
    )
  }

  return <img className={className} src={src} alt={alt} onError={() => setFailed(true)} />
}

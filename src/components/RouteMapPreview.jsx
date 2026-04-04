function normalizePoints(points, width, height, padding) {
  if (!Array.isArray(points) || !points.length) return []

  const latitudes = points.map((point) => point.latitude)
  const longitudes = points.map((point) => point.longitude)
  const minLatitude = Math.min(...latitudes)
  const maxLatitude = Math.max(...latitudes)
  const minLongitude = Math.min(...longitudes)
  const maxLongitude = Math.max(...longitudes)
  const latitudeRange = maxLatitude - minLatitude || 0.001
  const longitudeRange = maxLongitude - minLongitude || 0.001
  const drawableWidth = width - padding * 2
  const drawableHeight = height - padding * 2

  return points.map((point) => {
    const x = padding + ((point.longitude - minLongitude) / longitudeRange) * drawableWidth
    const y = height - padding - ((point.latitude - minLatitude) / latitudeRange) * drawableHeight
    return [x.toFixed(2), y.toFixed(2)]
  })
}

export default function RouteMapPreview({
  points,
  color = '#8b5cf6',
  className = '',
  showBadge = true,
}) {
  const width = 360
  const height = 216
  const normalized = normalizePoints(points, width, height, 24)
  const polyline = normalized.map((point) => point.join(',')).join(' ')
  const start = normalized[0]
  const end = normalized[normalized.length - 1]

  return (
    <div className={`route-map-preview ${className}`.trim()}>
      <svg
        className="route-map-preview-svg"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Preview do percurso"
      >
        <defs>
          <linearGradient id="route-grid-glow" x1="0%" x2="100%" y1="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(139, 92, 246, 0.12)" />
            <stop offset="100%" stopColor="rgba(59, 130, 246, 0.08)" />
          </linearGradient>
        </defs>

        <rect className="route-map-preview-bg" height={height} rx="28" width={width} x="0" y="0" />

        {Array.from({ length: 8 }).map((_, index) => (
          <line
            key={`v-${index}`}
            className="route-map-grid-line"
            x1={index * 48}
            x2={index * 48}
            y1="0"
            y2={height}
          />
        ))}
        {Array.from({ length: 6 }).map((_, index) => (
          <line
            key={`h-${index}`}
            className="route-map-grid-line"
            x1="0"
            x2={width}
            y1={index * 44}
            y2={index * 44}
          />
        ))}

        {polyline ? (
          <>
            <polyline
              className="route-map-shadow-line"
              points={polyline}
              style={{ stroke: color }}
            />
            <polyline className="route-map-main-line" points={polyline} style={{ stroke: color }} />
          </>
        ) : null}

        {start ? <circle className="route-map-start-dot" cx={start[0]} cy={start[1]} r="6" /> : null}
        {end ? <circle className="route-map-end-dot" cx={end[0]} cy={end[1]} r="6" /> : null}
      </svg>

      {showBadge ? <span className="route-map-preview-badge">Rota</span> : null}
    </div>
  )
}

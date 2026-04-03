function normalizeApiOrigin(value) {
  return String(value || '')
    .trim()
    .replace(/\/api\/?$/i, '')
    .replace(/\/+$/, '')
}

const apiOrigin = normalizeApiOrigin(process.env.KOYEB_API_ORIGIN || process.env.VITE_API_BASE_URL)
const rewrites = []

if (apiOrigin) {
  rewrites.push({
    source: '/api/:path*',
    destination: `${apiOrigin}/api/:path*`,
  })
}

rewrites.push({
  source: '/(.*)',
  destination: '/index.html',
})

export default {
  framework: 'vite',
  buildCommand: 'npm run build',
  outputDirectory: 'dist',
  rewrites,
}

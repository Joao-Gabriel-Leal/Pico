export function getDisplayName(value, fallback = 'PicoHunter') {
  const text = String(value || '').trim()
  return text || fallback
}

export function getInitial(value, fallback = 'P') {
  return getDisplayName(value, fallback).slice(0, 1).toUpperCase()
}

const endpoint = (import.meta.env.VITE_MODAL_ENDPOINT || '').trim().replace(/\/$/, '')

if (!endpoint) {
  console.warn('VITE_MODAL_ENDPOINT is not set. API calls will fail until configured.')
}

export function apiUrl(pathname) {
  if (!endpoint) return pathname
  if (!pathname.startsWith('/')) return `${endpoint}/${pathname}`
  return `${endpoint}${pathname}`
}

export async function fetchJson(pathname, init) {
  const response = await fetch(apiUrl(pathname), init)
  const isJson = response.headers.get('content-type')?.includes('application/json')
  const payload = isJson ? await response.json() : null

  if (!response.ok) {
    const detail = payload && typeof payload.detail === 'string' ? payload.detail : `Request failed (${response.status})`
    throw new Error(detail)
  }

  return payload
}

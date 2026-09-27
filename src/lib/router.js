import { useSyncExternalStore } from 'react'

// Маршруты в хеше: приложение открывается и с диска, и с любого хостинга без настройки сервера.
const subscribe = (l) => { window.addEventListener('hashchange', l); return () => window.removeEventListener('hashchange', l) }
const read = () => window.location.hash.replace(/^#/, '') || '/'

export function useRoute() {
  const raw = useSyncExternalStore(subscribe, read)
  const [path, query = ''] = raw.split('?')
  const parts = path.split('/').filter(Boolean)
  return { path, parts, params: Object.fromEntries(new URLSearchParams(query)) }
}

export const href = (path, params) => {
  const q = params ? new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString() : ''
  return `#${path}${q ? `?${q}` : ''}`
}
export const go = (path, params) => { window.location.hash = href(path, params).slice(1) }

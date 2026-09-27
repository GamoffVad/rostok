import { useSyncExternalStore } from 'react'

// Выбор группы, среза и раздела запоминается между экранами и сеансами.
const KEY = 'rostok.ui.v1'
let ui = (() => { try { return JSON.parse(localStorage.getItem(KEY)) || {} } catch { return {} } })()
const listeners = new Set()
const subscribe = (l) => { listeners.add(l); return () => listeners.delete(l) }

export function setUi(patch) {
  ui = { ...ui, ...patch }
  try { localStorage.setItem(KEY, JSON.stringify(ui)) } catch { /* без сохранения выбора */ }
  listeners.forEach((l) => l())
}

export const useUi = () => useSyncExternalStore(subscribe, () => ui)

// Текущие группа и срез с запасным вариантом, если сохранённый выбор удалён.
export function useSelection(db) {
  const state = useUi()
  const group = db.groups.find((g) => g.id === state.groupId) || db.groups[0] || null
  const period = db.periods.find((p) => p.id === state.periodId) || db.periods[0] || null
  return { group, period, sectionId: state.sectionId }
}

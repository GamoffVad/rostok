import { useSyncExternalStore } from 'react'
import { EXAMPLE_LIBRARY } from '../data/exercises'
import { applyDicts } from './dicts'
export { POINT_NAMES } from '../data/dictionaries'

// Данные хранятся только в браузере (localStorage): сведения о детях не покидают компьютер специалиста.
const KEY = 'rostok.db.v1'

// library отсутствует → показываются образцы упражнений; пустой объект — специалист очистил библиотеку.
const emptyDb = () => ({ version: 1, groups: [], children: [], periods: [], scores: {}, notes: {}, programs: {}, dicts: {} })

function load() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return emptyDb()
    return { ...emptyDb(), ...JSON.parse(raw) }
  } catch {
    return emptyDb()
  }
}

let db = load()
applyDicts(db.dicts)
let saveError = false
const listeners = new Set()

function commit(next) {
  if (next.dicts !== db.dicts) applyDicts(next.dicts)
  db = next
  try {
    localStorage.setItem(KEY, JSON.stringify(db))
    saveError = false
  } catch {
    saveError = true
  }
  listeners.forEach((l) => l())
}

const subscribe = (l) => { listeners.add(l); return () => listeners.delete(l) }
export const useDb = () => useSyncExternalStore(subscribe, () => db)
export const getDb = () => db
export const hasSaveError = () => saveError

export const uid = () => Math.random().toString(36).slice(2, 10)

export function currentAcademicYear(now = new Date()) {
  const y = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1
  return `${y}–${y + 1}`
}

export const periodLabel = (p) => (p ? `${p.year} · ${p.point}` : '')
// Короткая подпись среза для графиков и шапок таблиц: «НГ 25/26».
export const periodShort = (p) => (p ? `${p.point} ${p.year.slice(2, 4)}/${p.year.slice(-2)}` : '')

export const actions = {
  addGroup(name) {
    const group = { id: uid(), name: name.trim() }
    let periods = db.periods
    if (!periods.length) periods = yearPeriods(currentAcademicYear())
    commit({ ...db, groups: [...db.groups, group], periods })
    return group
  },
  renameGroup(id, name) {
    commit({ ...db, groups: db.groups.map((g) => (g.id === id ? { ...g, name: name.trim() } : g)) })
  },
  removeGroup(id) {
    const ids = new Set(db.children.filter((c) => c.groupId === id).map((c) => c.id))
    commit({
      ...db,
      groups: db.groups.filter((g) => g.id !== id),
      children: db.children.filter((c) => !ids.has(c.id)),
      scores: omit(db.scores, ids),
      notes: omit(db.notes, ids),
      programs: omit(db.programs, ids),
    })
  },
  addChild(child) {
    const c = { id: uid(), name: '', birthDate: '', note: '', tpmpk: '', relatives: [], ...child }
    commit({ ...db, children: [...db.children, c] })
    return c
  },
  addChildren(groupId, names) {
    const list = names.map((name) => ({ id: uid(), groupId, name, birthDate: '', note: '', tpmpk: '', relatives: [] }))
    commit({ ...db, children: [...db.children, ...list] })
  },
  updateChild(id, patch) {
    commit({ ...db, children: db.children.map((c) => (c.id === id ? { ...c, ...patch } : c)) })
  },
  removeChild(id) {
    const ids = new Set([id])
    commit({ ...db, children: db.children.filter((c) => c.id !== id), scores: omit(db.scores, ids), notes: omit(db.notes, ids), programs: omit(db.programs, ids) })
  },
  addYear(year) {
    if (db.periods.some((p) => p.year === year)) return
    commit({ ...db, periods: [...db.periods, ...yearPeriods(year)] })
  },
  removeYear(year) {
    const gone = new Set(db.periods.filter((p) => p.year === year).map((p) => p.id))
    const strip = (byChild) => Object.fromEntries(Object.entries(byChild).map(([cid, per]) => [cid, omit(per, gone)]))
    commit({ ...db, periods: db.periods.filter((p) => p.year !== year), scores: strip(db.scores), notes: strip(db.notes), programs: strip(db.programs) })
  },
  setScore(childId, periodId, itemId, value) {
    const child = db.scores[childId] || {}
    const period = { ...(child[periodId] || {}) }
    if (value === null || value === undefined) delete period[itemId]
    else period[itemId] = value
    commit({ ...db, scores: { ...db.scores, [childId]: { ...child, [periodId]: period } } })
  },
  setMany(childId, periodId, patch) {
    const child = db.scores[childId] || {}
    const period = { ...(child[periodId] || {}), ...patch }
    for (const k of Object.keys(period)) if (period[k] === null) delete period[k]
    commit({ ...db, scores: { ...db.scores, [childId]: { ...child, [periodId]: period } } })
  },
  setNote(childId, periodId, text) {
    const child = db.notes[childId] || {}
    commit({ ...db, notes: { ...db.notes, [childId]: { ...child, [periodId]: text } } })
  },
  setProgram(childId, periodId, patch) {
    const child = db.programs[childId] || {}
    const cur = child[periodId] || {}
    commit({ ...db, programs: { ...db.programs, [childId]: { ...child, [periodId]: { ...cur, ...patch } } } })
  },
  setExercise(itemId, text) {
    commit({ ...db, library: { ...libraryOf(db), [itemId]: text } })
  },
  // Правка словаря: значение, совпавшее с умолчанием, не хранится.
  setDictValue(dictId, row, field, value, def) {
    const dict = { ...(db.dicts?.[dictId] || {}) }
    const fields = { ...(dict[row] || {}) }
    if (value === def) delete fields[field]
    else fields[field] = value
    if (Object.keys(fields).length) dict[row] = fields
    else delete dict[row]
    const dicts = { ...db.dicts, [dictId]: dict }
    if (!Object.keys(dict).length) delete dicts[dictId]
    commit({ ...db, dicts })
  },
  setDictList(dictId, list) {
    commit({ ...db, dicts: { ...db.dicts, [dictId]: list } })
  },
  resetDict(dictId) {
    const dicts = { ...db.dicts }
    delete dicts[dictId]
    commit({ ...db, dicts })
  },
  setLibrary(library) {
    commit({ ...db, library })
  },
  replaceAll(next) {
    commit({ ...emptyDb(), ...next })
  },
  merge(part) {
    commit({
      ...db,
      groups: [...db.groups, ...part.groups],
      children: [...db.children, ...part.children],
      periods: [...db.periods, ...part.periods.filter((p) => !db.periods.some((q) => q.id === p.id))],
      scores: { ...db.scores, ...part.scores },
      notes: { ...db.notes, ...(part.notes || {}) },
      programs: { ...db.programs, ...(part.programs || {}) },
    })
  },
  clear() {
    commit(emptyDb())
  },
}

export function yearPeriods(year) {
  const key = year.replace(/\D+/g, '-')
  return [
    { id: `${key}:ng`, year, point: 'НГ' },
    { id: `${key}:kg`, year, point: 'КГ' },
  ]
}

function omit(obj, keys) {
  return Object.fromEntries(Object.entries(obj).filter(([k]) => !keys.has(k)))
}

export const libraryOf = (data) => data.library ?? EXAMPLE_LIBRARY
export const programOf = (data, childId, periodId) => data.programs?.[childId]?.[periodId] || {}
export const scoresOf = (data, childId, periodId) => data.scores[childId]?.[periodId] || {}
export const childrenOf = (data, groupId) =>
  data.children.filter((c) => c.groupId === groupId).sort((a, b) => a.name.localeCompare(b.name, 'ru'))

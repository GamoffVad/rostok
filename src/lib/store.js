import { useSyncExternalStore } from 'react'
import { EXAMPLE_LIBRARY } from '../data/exercises'
import { applyDicts } from './dicts'
import * as local from './localdb'
export { POINT_NAMES } from '../data/dictionaries'

// Данные живут в локальной базе браузера (IndexedDB, lib/localdb.js) и никуда не отправляются.
// Здесь — снимок базы в памяти: экраны читают его синхронно, правки уходят в базу пачкой через 250 мс.

const emptyDb = local.emptyDb
const AUTOLOCK_DEFAULT = 15 // минут без действий до блокировки, если включена защита паролем

let db = emptyDb()
let saved = db // что уже записано в базу
let storage = { status: 'loading', encrypted: false, error: '', saveError: false, lastBackupAt: null, migrated: false, autoLockMin: AUTOLOCK_DEFAULT }
const listeners = new Set()
const notify = () => listeners.forEach((l) => l())
const setStorage = (patch) => { storage = { ...storage, ...patch }; notify() }

function ready(data, extra = {}) {
  db = data
  saved = data
  applyDicts(db.dicts)
  storage = { ...storage, status: 'ready', error: '', ...extra }
  notify()
}

async function boot() {
  try {
    const res = await local.init()
    const sec = await local.security()
    const lastBackupAt = (await local.getMeta('lastBackupAt')) || null
    const autoLockMin = (await local.getMeta('autoLockMin')) ?? AUTOLOCK_DEFAULT
    if (res.state === 'locked') { setStorage({ status: 'locked', encrypted: true, lastBackupAt, autoLockMin }); return }
    ready(res.db, { encrypted: Boolean(sec.encrypted), lastBackupAt, autoLockMin, migrated: Boolean(res.migrated) })
    if (res.db.children.length) local.requestPersist()
  } catch (e) {
    setStorage({ status: 'error', error: e.message || String(e) })
  }
}
boot()

// ── Запись в базу
let timer = null
let writing = null
export async function flush() {
  clearTimeout(timer)
  if (writing) await writing
  if (saved === db || storage.status !== 'ready') return
  const next = db
  writing = local.save(saved, next)
    .then(() => { saved = next; if (storage.saveError) setStorage({ saveError: false }) })
    .catch(() => setStorage({ saveError: true }))
    .finally(() => { writing = null })
  await writing
}
const schedule = () => { clearTimeout(timer); timer = setTimeout(flush, 250) }
window.addEventListener('pagehide', () => { flush() })
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush() })

// Точка восстановления раз в день — состояние до первой правки дня
let snapshotDay = null
async function dailySnapshot(prev) {
  const day = new Date().toISOString().slice(0, 10)
  if (snapshotDay === day) return
  // пустую базу не сохраняем и день не отмечаем: точка будет при первой правке непустых данных
  if (!prev.children.length && !prev.groups.length) return
  snapshotDay = day
  if ((await local.getMeta('lastSnapshotDay')) === day) return
  await local.snapshot(prev, 'daily')
  await local.setMeta('lastSnapshotDay', day)
}

function commit(next) {
  if (storage.status !== 'ready') return
  const prev = db
  if (next.dicts !== db.dicts) applyDicts(next.dicts)
  db = next
  notify()
  dailySnapshot(prev).catch(() => {})
  schedule()
}

const subscribe = (l) => { listeners.add(l); return () => listeners.delete(l) }
export const useDb = () => useSyncExternalStore(subscribe, () => db)
export const useStorage = () => useSyncExternalStore(subscribe, () => storage)
export const getDb = () => db
export const hasSaveError = () => storage.saveError

// ── Действия с самой базой: пароль, копии, точки восстановления
export const storageActions = {
  async unlock(password) {
    const data = await local.unlock(password)
    ready(data, { encrypted: true, lastBackupAt: (await local.getMeta('lastBackupAt')) || null })
  },
  async lock() {
    await flush()
    local.lock()
    db = emptyDb()
    saved = db
    setStorage({ status: 'locked' })
  },
  async enableProtection(password) { await flush(); await local.enableProtection(password, db); setStorage({ encrypted: true }) },
  async changePassword(oldPassword, newPassword) { await flush(); await local.changePassword(oldPassword, newPassword, db) },
  async disableProtection(password) { await flush(); await local.disableProtection(password, db); setStorage({ encrypted: false }) },
  async setAutoLock(min) { await local.setMeta('autoLockMin', min); setStorage({ autoLockMin: min }) },
  async exportBackup() {
    await flush()
    const text = await local.exportBackup(db)
    setStorage({ lastBackupAt: Date.now() })
    return text
  },
  // Восстановление (из файла или точки): перед ним — точка восстановления текущего состояния
  async restore(data) {
    await flush()
    const kept = Boolean(db.children.length || db.groups.length)
    if (kept) await local.snapshot(db, 'before-restore')
    commit({ ...emptyDb(), ...data })
    await flush()
    return kept // true — прежнее состояние сохранено точкой восстановления
  },
  listSnapshots: () => local.listSnapshots(),
  async restoreSnapshot(id) {
    const data = await local.loadSnapshot(id)
    if (!data) throw new Error('Точка восстановления не найдена')
    await storageActions.restore(data)
  },
  async snapshotNow() { await flush(); await local.snapshot(db, 'manual') },
  async wipe() { await flush(); await local.wipe(); ready(emptyDb(), { lastBackupAt: storage.lastBackupAt }) },
  async destroy() { clearTimeout(timer); await local.destroy(); ready(emptyDb(), { encrypted: false, lastBackupAt: null }) },
  info: () => local.storageInfo(),
  persist: () => local.requestPersist(),
  cryptoAvailable: () => local.cryptoAvailable(),
  isEncryptedBackup: local.isEncryptedBackup,
  readEncryptedBackup: local.readEncryptedBackup,
}

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
  merge(part) {
    // загрузка Excel или примера — перед ней точка восстановления
    if (db.children.length) local.snapshot(db, 'before-import').catch(() => {})
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

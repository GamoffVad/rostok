import { idbBatch, idbClear, idbDelete, idbEntries, idbGet, idbPut } from './idb'
import { ITERATIONS, cryptoAvailable, deriveKey, isSealed, randomSalt, seal, sealToFile, unseal, unsealFile } from './crypto'

export { cryptoAvailable }

// Локальная база «Ростка» в IndexedDB браузера.
// Данные разложены по записям: коллекции (groups, children, periods, notes, programs, library, dicts)
// и отдельная запись отметок на каждого ребёнка (scores:<id>) — при правке балла пишется одна небольшая запись.
// Если включена защита паролем, каждая запись зашифрована (AES-GCM); без пароля данные не прочитать.
// Этот модуль — единственное место, которое знает, где лежат данные: позже его заменит сервер.

const COLLECTIONS = ['groups', 'children', 'periods', 'notes', 'programs', 'library', 'dicts']
const LEGACY_KEY = 'rostok.db.v1' // прежнее хранение в localStorage (до версии 1.5)
const CHECK = 'rostok-check'
const SNAPSHOTS_KEEP = 14

let key = null // ключ шифрования — только в памяти

export const emptyDb = () => ({ version: 1, groups: [], children: [], periods: [], scores: {}, notes: {}, programs: {}, dicts: {} })

function split(db) {
  const out = new Map()
  for (const c of COLLECTIONS) if (db[c] !== undefined) out.set(c, db[c])
  for (const [childId, per] of Object.entries(db.scores || {})) out.set(`scores:${childId}`, per)
  return out
}

function join(entries) {
  const db = emptyDb()
  for (const [k, v] of entries) {
    if (k.startsWith('scores:')) db.scores[k.slice(7)] = v
    else db[k] = v
  }
  return db
}

const pack = async (v) => (key ? seal(key, v) : v)
const unpack = async (v) => (isSealed(v) ? unseal(key, v) : v)

export async function security() {
  return (await idbGet('meta', 'security')) || { encrypted: false }
}

export const getMeta = (name) => idbGet('meta', name)
export const setMeta = (name, value) => idbPut('meta', name, value)

// Первое открытие: 'ready' с данными, 'locked' — нужен пароль.
// Данные из прежнего localStorage переносятся в базу один раз и оттуда удаляются.
export async function init() {
  const sec = await security()
  if (sec.encrypted) return { state: 'locked' }
  const entries = await idbEntries('records')
  if (!entries.length) {
    let legacy = null
    try { legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) || 'null') } catch { legacy = null }
    if (legacy) {
      const db = { ...emptyDb(), ...legacy }
      await save(emptyDb(), db, true)
      try { localStorage.removeItem(LEGACY_KEY) } catch { /* уже перенесено */ }
      return { state: 'ready', db, migrated: true }
    }
    return { state: 'ready', db: emptyDb() }
  }
  return { state: 'ready', db: join(entries) }
}

export async function unlock(password) {
  const sec = await security()
  const k = await deriveKey(password, sec.salt, sec.iterations)
  try {
    const check = await unseal(k, sec.check)
    if (check !== CHECK) throw new Error('bad')
  } catch {
    throw new Error('Неверный пароль')
  }
  key = k
  const entries = await idbEntries('records')
  const plain = await Promise.all(entries.map(async ([name, v]) => [name, await unpack(v)]))
  return join(plain)
}

export function lock() { key = null }

// Сохранить разницу между двумя состояниями: изменённые записи (по ссылке) и удалённые отметки.
export async function save(prev, next, all = false) {
  const a = split(prev)
  const b = split(next)
  const puts = []
  for (const [k, v] of b) if (all || a.get(k) !== v) puts.push([k, await pack(v)])
  const deletes = [...a.keys()].filter((k) => !b.has(k))
  if (puts.length || deletes.length) await idbBatch('records', puts, deletes)
}

// Переписать все записи текущим ключом (точки восстановления перешифровывают вызывающие функции)
async function rewriteAll(db) {
  await idbClear('records')
  await save(emptyDb(), db, true)
}

export async function enableProtection(password, db) {
  const salt = randomSalt()
  const snaps = await readSnapshotsPlain()
  key = await deriveKey(password, salt)
  await setMeta('security', { encrypted: true, salt, iterations: ITERATIONS, check: await seal(key, CHECK), since: Date.now() })
  await rewriteAll(db)
  await restoreSnapshotsPlain(snaps)
}

export async function changePassword(oldPassword, newPassword, db) {
  await unlock(oldPassword)
  const snaps = await readSnapshotsPlain()
  const salt = randomSalt()
  key = await deriveKey(newPassword, salt)
  const sec = await security()
  await setMeta('security', { ...sec, salt, iterations: ITERATIONS, check: await seal(key, CHECK) })
  await rewriteAll(db)
  await restoreSnapshotsPlain(snaps)
}

export async function disableProtection(password, db) {
  await unlock(password)
  const snaps = await readSnapshotsPlain()
  key = null
  await setMeta('security', { encrypted: false })
  await rewriteAll(db)
  await restoreSnapshotsPlain(snaps)
}

// ── Точки восстановления: копия базы внутри браузера (одна на день + перед опасными действиями)
async function readSnapshotsPlain() {
  const snaps = await idbEntries('snapshots')
  return Promise.all(snaps.map(async ([id, s]) => [id, { ...s, data: await unpack(s.data) }]))
}
async function restoreSnapshotsPlain(list) {
  await idbClear('snapshots')
  for (const [id, s] of list) await idbPut('snapshots', id, { ...s, data: await pack(s.data) })
}

export async function snapshot(db, reason) {
  const at = Date.now()
  const day = new Date(at).toISOString().slice(0, 10)
  const id = reason === 'daily' ? `daily:${day}` : `${reason}:${at}`
  await idbPut('snapshots', id, { at, reason, children: db.children.length, groups: db.groups.length, data: await pack(db) })
  const all = (await idbEntries('snapshots')).sort((x, y) => y[1].at - x[1].at)
  for (const [old] of all.slice(SNAPSHOTS_KEEP)) await idbDelete('snapshots', old)
  return id
}

export async function listSnapshots() {
  return (await idbEntries('snapshots')).map(([id, s]) => ({ id, at: s.at, reason: s.reason, children: s.children, groups: s.groups }))
    .sort((a, b) => b.at - a.at)
}

export async function loadSnapshot(id) {
  const s = await idbGet('snapshots', id)
  return s ? { ...emptyDb(), ...(await unpack(s.data)) } : null
}

// ── Резервная копия в файл: с защитой — зашифрована тем же паролем
export async function exportBackup(db) {
  const sec = await security()
  const body = sec.encrypted && key ? await sealToFile(key, sec.salt, db, sec.iterations) : db
  await setMeta('lastBackupAt', Date.now())
  return JSON.stringify(body)
}

export const isEncryptedBackup = (obj) => obj && obj.format === 'rostok-encrypted'
export const readEncryptedBackup = (obj, password) => unsealFile(obj, password)

// Полная очистка: данные и точки восстановления (настройки защиты остаются)
export async function wipe() {
  await idbClear('records')
  await idbClear('snapshots')
}

export async function storageInfo() {
  const est = navigator.storage?.estimate ? await navigator.storage.estimate() : null
  const persisted = navigator.storage?.persisted ? await navigator.storage.persisted() : false
  return { usage: est?.usage ?? null, quota: est?.quota ?? null, persisted }
}

// Просим браузер не очищать базу при нехватке места
export async function requestPersist() {
  if (!navigator.storage?.persist) return false
  return navigator.storage.persist()
}

// Забытый пароль: база стирается целиком вместе с настройками защиты (восстановление — из файла копии)
export async function destroy() {
  key = null
  await idbClear('records')
  await idbClear('snapshots')
  await idbClear('meta')
}

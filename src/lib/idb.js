// Тонкая обёртка над IndexedDB — встроенной базой данных браузера.
// Хранилища: records — данные по коллекциям, snapshots — точки восстановления, meta — служебные сведения.

const NAME = 'rostok'
const VERSION = 1
export const STORES = ['records', 'snapshots', 'meta']

let opening = null

export function openIdb() {
  if (opening) return opening
  opening = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) { reject(new Error('Браузер не поддерживает IndexedDB')); return }
    const req = indexedDB.open(NAME, VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      for (const s of STORES) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
    req.onblocked = () => reject(new Error('База открыта в другой вкладке старой версии — закройте её'))
  })
  return opening
}

function run(store, mode, fn) {
  return openIdb().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode)
    const result = fn(tx.objectStore(store))
    tx.oncomplete = () => resolve(result && 'result' in result ? result.result : undefined)
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error || new Error('Запись в базу прервана'))
  }))
}

export const idbGet = (store, key) => run(store, 'readonly', (s) => s.get(key))
export const idbPut = (store, key, value) => run(store, 'readwrite', (s) => { s.put(value, key) })
export const idbDelete = (store, key) => run(store, 'readwrite', (s) => { s.delete(key) })
export const idbClear = (store) => run(store, 'readwrite', (s) => { s.clear() })

// Все записи хранилища: [[ключ, значение], …]
export function idbEntries(store) {
  return openIdb().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly')
    const s = tx.objectStore(store)
    const keys = s.getAllKeys()
    const values = s.getAll()
    tx.oncomplete = () => resolve(keys.result.map((k, i) => [k, values.result[i]]))
    tx.onerror = () => reject(tx.error)
  }))
}

// Несколько изменений одной транзакцией: либо все, либо ни одного.
export function idbBatch(store, puts = [], deletes = []) {
  return run(store, 'readwrite', (s) => {
    for (const [k, v] of puts) s.put(v, k)
    for (const k of deletes) s.delete(k)
  })
}

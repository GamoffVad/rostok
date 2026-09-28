// Шифрование данных паролем: ключ AES-GCM 256 бит выводится из пароля (PBKDF2, SHA-256).
// Пароль нигде не сохраняется; ключ живёт только в памяти открытой вкладки.

const enc = new TextEncoder()
const dec = new TextDecoder()
export const ITERATIONS = 310000

// Шифрование браузера доступно только на защищённом адресе: https:// или localhost
export const cryptoAvailable = () => Boolean(window.isSecureContext && globalThis.crypto?.subtle)
const need = () => { if (!cryptoAvailable()) throw new Error('Шифрование доступно только при открытии приложения по защищённому адресу (https://)') }

export const randomSalt = () => crypto.getRandomValues(new Uint8Array(16))

export async function deriveKey(password, salt, iterations = ITERATIONS) {
  need()
  const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

// Запечатать значение: { iv, data } — так оно и ложится в IndexedDB.
export async function seal(key, value) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(value)))
  return { sealed: true, iv, data: new Uint8Array(data) }
}

export async function unseal(key, box) {
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: box.iv }, key, box.data)
  return JSON.parse(dec.decode(plain))
}

export const isSealed = (v) => Boolean(v && v.sealed && v.iv && v.data)

// Для файла резервной копии — base64
export const toB64 = (bytes) => btoa(String.fromCharCode(...bytes))
export const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

export async function sealToFile(key, salt, value, iterations = ITERATIONS) {
  const box = await seal(key, value)
  // большие копии кодируем кусками, чтобы не упереться в лимит аргументов
  let b64 = ''
  for (let i = 0; i < box.data.length; i += 0x8000) b64 += String.fromCharCode(...box.data.subarray(i, i + 0x8000))
  return { format: 'rostok-encrypted', version: 1, kdf: 'PBKDF2-SHA256', iterations, salt: toB64(salt), iv: toB64(box.iv), data: btoa(b64) }
}

export async function unsealFile(file, password) {
  const key = await deriveKey(password, fromB64(file.salt), file.iterations)
  return unseal(key, { iv: fromB64(file.iv), data: fromB64(file.data) })
}

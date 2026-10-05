// Where the probe keeps what must survive a reload. Sealed cards (and the fallback's key) go in
// IndexedDB, which is what the card cache would use; row results and the credential id go in
// localStorage, because they are small and read synchronously at load.

const DB_NAME = 'device-probe'
const STORE = 'kv'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'))
  })
}

async function run<T>(mode: IDBTransactionMode, act: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb()
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode)
      const request = act(tx.objectStore(STORE))
      tx.oncomplete = () => resolve(request.result)
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'))
      tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'))
    })
  } finally {
    db.close()
  }
}

export async function idbGet<T>(key: string): Promise<T | undefined> {
  return (await run('readonly', (store) => store.get(key))) as T | undefined
}

export async function idbPut(key: string, value: unknown): Promise<void> {
  await run('readwrite', (store) => store.put(value, key))
}

export function idbDelete(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error ?? new Error('IndexedDB delete failed'))
    // Another tab holding the database open blocks the delete; say so rather than hang.
    request.onblocked = () => reject(new Error('close the probe in other tabs, then clear again'))
  })
}

// localStorage can throw (a private window, storage blocked); the probe still runs without it and
// only loses what it would have remembered across a reload.
export function readLocal(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export function writeLocal(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    // Nothing to do: see readLocal.
  }
}

export function toBase64Url(buffer: ArrayBuffer): string {
  let binary = ''
  for (const byte of new Uint8Array(buffer)) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

export function fromBase64Url(text: string): ArrayBuffer {
  const binary = atob(text.replaceAll('-', '+').replaceAll('_', '/'))
  return Uint8Array.from(binary, (c) => c.charCodeAt(0)).buffer
}

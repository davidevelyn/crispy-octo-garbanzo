import { DB_NAME, DB_VERSION, upgrade, type StoreName } from './schema'

/** Thin typed promise wrapper over IndexedDB. The whole persistence surface. */

let dbPromise: Promise<IDBDatabase> | null = null

export function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = (e) => upgrade(req.result, e.oldVersion)
    req.onsuccess = () => {
      const db = req.result
      // Another tab/install is upgrading: close so it can proceed.
      db.onversionchange = () => {
        db.close()
        dbPromise = null
      }
      resolve(db)
    }
    req.onerror = () => reject(req.error)
    req.onblocked = () => reject(new Error('Database blocked by another open tab'))
  })
  return dbPromise
}

/** Test hook: reset the memoized connection. */
export function _resetDb(): void {
  dbPromise = null
}

function requestToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function withStore<T>(
  store: StoreName,
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb()
  return requestToPromise(fn(db.transaction(store, mode).objectStore(store)))
}

export function get<T>(store: StoreName, id: string): Promise<T | undefined> {
  return withStore<T | undefined>(store, 'readonly', (s) => s.get(id) as IDBRequest<T | undefined>)
}

export function getAll<T>(store: StoreName): Promise<T[]> {
  return withStore<T[]>(store, 'readonly', (s) => s.getAll() as IDBRequest<T[]>)
}

export function put<T>(store: StoreName, value: T): Promise<IDBValidKey> {
  return withStore(store, 'readwrite', (s) => s.put(value))
}

export async function bulkPut<T>(store: StoreName, values: T[]): Promise<void> {
  if (values.length === 0) return
  const db = await openDb()
  const tx = db.transaction(store, 'readwrite')
  const s = tx.objectStore(store)
  for (const v of values) s.put(v)
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

export function del(store: StoreName, id: string): Promise<undefined> {
  return withStore(store, 'readwrite', (s) => s.delete(id))
}

export function byIndex<T>(store: StoreName, index: string, query: IDBKeyRange | IDBValidKey): Promise<T[]> {
  return withStore<T[]>(store, 'readonly', (s) => s.index(index).getAll(query) as IDBRequest<T[]>)
}

export async function clearStore(store: StoreName): Promise<void> {
  await withStore(store, 'readwrite', (s) => s.clear())
}

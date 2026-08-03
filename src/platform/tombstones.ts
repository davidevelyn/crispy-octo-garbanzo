import { del, getAll, put } from './db'
import { nowIso } from './ids'
import type { StoreName } from './schema'
import type { BaseRecord } from './types'

const PURGE_AFTER_DAYS = 30

/** Soft-delete: mark + bump updatedAt so the deletion wins sync merges. */
export async function softDelete<T extends BaseRecord>(store: StoreName, record: T): Promise<void> {
  await put(store, { ...record, deleted: true, updatedAt: nowIso() })
}

export function notDeleted<T extends BaseRecord>(records: T[]): T[] {
  return records.filter((r) => !r.deleted)
}

/** Hard-delete tombstones old enough that every device has long since synced them. */
export async function purgeTombstones(stores: StoreName[]): Promise<number> {
  const cutoff = new Date(Date.now() - PURGE_AFTER_DAYS * 24 * 60 * 60 * 1000).toISOString()
  let purged = 0
  for (const store of stores) {
    const all = await getAll<BaseRecord>(store)
    for (const rec of all) {
      if (rec.deleted && rec.updatedAt < cutoff) {
        await del(store, rec.id)
        purged++
      }
    }
  }
  return purged
}

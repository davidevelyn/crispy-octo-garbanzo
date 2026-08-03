// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest'
import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { _resetDb, get, getAll, put } from '../db'
import { STORES } from '../schema'
import { registerModules } from '../registry'
import { mergeRecords } from '../exportImport'
import { connectSync, syncNow, syncQuietly, getSyncSettings, type GistTransport, SYNC_FILENAME } from '../sync'
import { softDelete, notDeleted, purgeTombstones } from '../tombstones'
import type { BaseRecord, ModuleDefinition } from '../types'

interface Item extends BaseRecord {
  name: string
}

function item(id: string, name: string, updatedAt = new Date().toISOString()): Item {
  return { id, profileId: 'shared', createdAt: '2026-01-01T00:00:00Z', updatedAt, name }
}

/** Minimal module over the grocery store so export/import runs without the React tree. */
const testModule: ModuleDefinition = {
  id: 'grocery',
  title: 'Grocery',
  basePath: '/grocery',
  routes: [],
  HomeCard: () => null,
  stores: [STORES.grocery],
  async exportData() {
    return { items: await getAll<Item>(STORES.grocery) }
  },
  async importData(section, mode) {
    const s = (section ?? {}) as { items?: Item[] }
    return mergeRecords(STORES.grocery, s.items ?? [], mode)
  },
}

/** In-memory gist server shared across "devices". */
function memoryGist(): { transport: GistTransport; store: Map<string, string> } {
  const store = new Map<string, string>()
  let counter = 0
  const transport: GistTransport = {
    async create(_t, filename, content) {
      const id = `gist-${++counter}`
      store.set(`${id}:${filename}`, content)
      return id
    },
    async read(_t, gistId, filename) {
      return store.get(`${gistId}:${filename}`) ?? null
    },
    async update(_t, gistId, filename, content) {
      store.set(`${gistId}:${filename}`, content)
    },
    async find(_t, filename) {
      for (const key of store.keys()) {
        if (key.endsWith(`:${filename}`)) return key.split(':')[0]
      }
      return null
    },
  }
  return { transport, store }
}

/** Each device is its own IndexedDB universe; switching re-points the global. */
function device(factory: IDBFactory): void {
  globalThis.indexedDB = factory
  _resetDb()
}

beforeEach(() => {
  registerModules([testModule])
})

describe('gist sync', () => {
  it('two devices converge, including deletions', async () => {
    const { transport } = memoryGist()
    const deviceA = new IDBFactory()
    const deviceB = new IDBFactory()

    // Device A: has Milk, sets up sync (creates the gist seeded with its data).
    device(deviceA)
    await put(STORES.grocery, item('milk', 'Milk', '2026-08-01T10:00:00Z'))
    await connectSync('token-a', transport)
    await syncNow(transport)

    // Device B: connects (finds the existing gist), pulls Milk.
    device(deviceB)
    await connectSync('token-b', transport)
    let result = await syncNow(transport)
    expect(result.pulled).toBeGreaterThan(0)
    const bItems = await getAll<Item>(STORES.grocery)
    expect(bItems.map((i) => i.name)).toContain('Milk')

    // Device B: adds Eggs, soft-deletes Milk, pushes.
    await put(STORES.grocery, item('eggs', 'Eggs', '2026-08-02T10:00:00Z'))
    const milk = (await get<Item>(STORES.grocery, 'milk'))!
    await softDelete(STORES.grocery, milk)
    await syncNow(transport)

    // Device A: syncs — gains Eggs, Milk becomes a tombstone (not resurrected).
    device(deviceA)
    await syncNow(transport)
    const aItems = await getAll<Item>(STORES.grocery)
    expect(aItems.find((i) => i.id === 'eggs')?.name).toBe('Eggs')
    expect(aItems.find((i) => i.id === 'milk')?.deleted).toBe(true)
    expect(notDeleted(aItems).map((i) => i.id)).toEqual(['eggs'])

    // And device A's push means B stays converged after its next pull.
    device(deviceB)
    result = await syncNow(transport)
    const bFinal = notDeleted(await getAll<Item>(STORES.grocery))
    expect(bFinal.map((i) => i.id)).toEqual(['eggs'])
  })

  it('newer local edit survives an older remote copy', async () => {
    const { transport } = memoryGist()
    const deviceA = new IDBFactory()
    const deviceB = new IDBFactory()

    device(deviceA)
    await put(STORES.grocery, item('milk', 'Milk', '2026-08-01T10:00:00Z'))
    await connectSync('t', transport)
    await syncNow(transport)

    device(deviceB)
    await connectSync('t', transport)
    await syncNow(transport)
    await put(STORES.grocery, item('milk', 'Oat milk', '2026-08-03T10:00:00Z'))
    await syncNow(transport)

    device(deviceA)
    await syncNow(transport)
    expect((await get<Item>(STORES.grocery, 'milk'))?.name).toBe('Oat milk')
  })

  it('the sync token never appears in what gets pushed', async () => {
    const { transport, store } = memoryGist()
    device(new IDBFactory())
    await put(STORES.grocery, item('milk', 'Milk'))
    await connectSync('super-secret-token', transport)
    await syncNow(transport)
    for (const content of store.values()) {
      expect(content).not.toContain('super-secret-token')
    }
  })

  it('syncNow without setup throws; syncQuietly returns null', async () => {
    const { transport } = memoryGist()
    device(new IDBFactory())
    await expect(syncNow(transport)).rejects.toThrow(/not set up/)
    expect(await syncQuietly(transport)).toBeNull()
  })

  it('corrupt gist content fails the pull without wrecking local data', async () => {
    const { transport, store } = memoryGist()
    device(new IDBFactory())
    await put(STORES.grocery, item('milk', 'Milk'))
    const settings = await connectSync('t', transport)
    store.set(`${settings.gistId}:${SYNC_FILENAME}`, '{not json')
    await expect(syncNow(transport)).rejects.toThrow(/not valid JSON/)
    expect((await getAll<Item>(STORES.grocery)).length).toBe(1)
  })

  it('records sync status after success', async () => {
    const { transport } = memoryGist()
    device(new IDBFactory())
    await connectSync('t', transport)
    await syncNow(transport)
    const settings = await getSyncSettings()
    expect(settings?.lastSyncAt).toBeTruthy()
    expect(settings?.lastSummary).toBeTruthy()
  })
})

describe('tombstones', () => {
  it('purge removes only old tombstones', async () => {
    device(new IDBFactory())
    const old = new Date(Date.now() - 40 * 24 * 3600 * 1000).toISOString()
    const recent = new Date().toISOString()
    await put(STORES.grocery, { ...item('a', 'Old ghost', old), deleted: true })
    await put(STORES.grocery, { ...item('b', 'Fresh ghost', recent), deleted: true })
    await put(STORES.grocery, item('c', 'Alive', recent))
    const purged = await purgeTombstones([STORES.grocery])
    expect(purged).toBe(1)
    const remaining = await getAll<Item>(STORES.grocery)
    expect(remaining.map((r) => r.id).sort()).toEqual(['b', 'c'])
  })
})

// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest'
import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { _resetDb, byIndex, get, getAll, put } from '../db'
import { STORES } from '../schema'
import { mergeRecords } from '../exportImport'
import type { BaseRecord } from '../types'

interface TestRec extends BaseRecord {
  name: string
}

function rec(id: string, updatedAt: string, name: string): TestRec {
  return { id, profileId: 'shared', createdAt: '2026-01-01T00:00:00Z', updatedAt, name }
}

beforeEach(() => {
  // fresh database per test
  globalThis.indexedDB = new IDBFactory()
  _resetDb()
})

describe('db wrapper', () => {
  it('put/get round-trips a record', async () => {
    await put(STORES.grocery, rec('a', '2026-01-02T00:00:00Z', 'Milk'))
    const out = await get<TestRec>(STORES.grocery, 'a')
    expect(out?.name).toBe('Milk')
  })

  it('getAll returns everything in a store', async () => {
    await put(STORES.grocery, rec('a', '2026-01-02T00:00:00Z', 'Milk'))
    await put(STORES.grocery, rec('b', '2026-01-02T00:00:00Z', 'Eggs'))
    expect((await getAll<TestRec>(STORES.grocery)).length).toBe(2)
  })

  it('compound index range query scopes by profile', async () => {
    await put(STORES.sessions, { ...rec('s1', '2026-01-02T00:00:00Z', 'x'), profileId: 'david', startedAt: '2026-01-02T00:00:00Z', status: 'finished' })
    await put(STORES.sessions, { ...rec('s2', '2026-01-02T00:00:00Z', 'x'), profileId: 'margs', startedAt: '2026-01-03T00:00:00Z', status: 'finished' })
    const davids = await byIndex(STORES.sessions, 'byProfileStart', IDBKeyRange.bound(['david', ''], ['david', '￿']))
    expect(davids).toHaveLength(1)
  })
})

describe('mergeRecords', () => {
  it('adds new records and reports them', async () => {
    const report = await mergeRecords(STORES.grocery, [rec('a', '2026-01-02T00:00:00Z', 'Milk')])
    expect(report).toEqual({ added: 1, updated: 0, skippedOlder: 0, errors: [] })
  })

  it('newer incoming wins, older is skipped', async () => {
    await put(STORES.grocery, rec('a', '2026-01-05T00:00:00Z', 'Current'))
    const report = await mergeRecords(STORES.grocery, [
      rec('a', '2026-01-09T00:00:00Z', 'Newer'),
    ])
    expect(report.updated).toBe(1)
    expect((await get<TestRec>(STORES.grocery, 'a'))?.name).toBe('Newer')

    const report2 = await mergeRecords(STORES.grocery, [rec('a', '2026-01-01T00:00:00Z', 'Ancient')])
    expect(report2.skippedOlder).toBe(1)
    expect((await get<TestRec>(STORES.grocery, 'a'))?.name).toBe('Newer')
  })

  it('replace mode overwrites regardless of updatedAt', async () => {
    await put(STORES.grocery, rec('a', '2026-01-05T00:00:00Z', 'Current'))
    await mergeRecords(STORES.grocery, [rec('a', '2026-01-01T00:00:00Z', 'Old')], 'replace')
    expect((await get<TestRec>(STORES.grocery, 'a'))?.name).toBe('Old')
  })

  it('tolerates malformed records', async () => {
    const report = await mergeRecords(STORES.grocery, [{ nope: true } as never])
    expect(report.errors).toHaveLength(1)
    expect(report.added).toBe(0)
  })
})

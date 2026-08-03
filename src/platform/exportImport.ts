import { getAll, bulkPut } from './db'
import { STORES, type StoreName } from './schema'
import { nowIso } from './ids'
import { getModules } from './registry'
import { SCHEMA_VERSION, type BaseRecord, type ExportDoc, type ImportReport, type Profile } from './types'

/**
 * Export/import: one clean JSON document containing everything. This doc is
 * the contract external agents read; format documented in docs/data-schema.md.
 */

export async function buildExportDoc(): Promise<ExportDoc> {
  const profiles = await getAll<Profile>(STORES.profiles)
  const modules: Record<string, unknown> = {}
  for (const mod of getModules()) {
    modules[mod.id] = await mod.exportData()
  }
  return {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: nowIso(),
    app: 'life-os',
    profiles,
    modules,
  }
}

export interface FullImportReport {
  profiles: ImportReport
  modules: Record<string, ImportReport>
}

export async function importDoc(doc: ExportDoc, mode: 'merge' | 'replace' = 'merge'): Promise<FullImportReport> {
  if (doc.app !== 'life-os') throw new Error('Not a Life OS export')
  if (typeof doc.schemaVersion !== 'number' || doc.schemaVersion > SCHEMA_VERSION) {
    throw new Error(`Export schema v${doc.schemaVersion} is newer than this app (v${SCHEMA_VERSION})`)
  }
  const profiles = await mergeRecords(STORES.profiles, (doc.profiles ?? []) as Profile[], mode)
  const modules: Record<string, ImportReport> = {}
  for (const mod of getModules()) {
    const section = doc.modules?.[mod.id]
    if (section !== undefined) {
      modules[mod.id] = await mod.importData(section, mode)
    }
  }
  return { profiles, modules }
}

/**
 * Merge incoming records into a store keyed by id.
 * 'merge': keep whichever side has the newer updatedAt.
 * 'replace': incoming always wins.
 */
export async function mergeRecords<T extends BaseRecord>(
  store: StoreName,
  incoming: T[],
  mode: 'merge' | 'replace' = 'merge',
): Promise<ImportReport> {
  const report: ImportReport = { added: 0, updated: 0, skippedOlder: 0, errors: [] }
  if (!Array.isArray(incoming)) {
    report.errors.push(`expected array for ${store}`)
    return report
  }
  const existing = await getAll<T>(store)
  const byId = new Map(existing.map((r) => [r.id, r]))
  const toWrite: T[] = []
  for (const rec of incoming) {
    if (!rec || typeof rec.id !== 'string') {
      report.errors.push(`record without id in ${store}`)
      continue
    }
    const current = byId.get(rec.id)
    if (!current) {
      toWrite.push(rec)
      report.added++
    } else if (mode === 'replace' || (rec.updatedAt ?? '') > (current.updatedAt ?? '')) {
      toWrite.push(rec)
      report.updated++
    } else {
      report.skippedOlder++
    }
  }
  await bulkPut(store, toWrite)
  return report
}

export function downloadJson(doc: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

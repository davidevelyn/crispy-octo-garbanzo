import { get, put } from './db'
import { STORES } from './schema'
import { nowIso } from './ids'
import { buildExportDoc, importDoc } from './exportImport'
import type { ExportDoc } from './types'

/**
 * Device sync over a secret GitHub Gist. The gist holds one file in the
 * ExportDoc format; sync = pull → record-level merge (by updatedAt) → push
 * the merged union. Tombstones (BaseRecord.deleted) make deletions stick.
 *
 * The token is a fine-grained PAT with ONLY the Gist permission. It lives in
 * the meta store on this device and is never part of an export.
 */

export const SYNC_FILENAME = 'life-os-sync.json'
const SETTINGS_KEY = 'syncSettings'

export interface SyncSettings {
  token: string
  gistId: string
  autoSync: boolean
  lastSyncAt?: string
  lastSummary?: string
}

export interface SyncResult {
  pulled: number
  pushed: boolean
  at: string
}

/** Transport seam — the real one talks to api.github.com; tests swap it. */
export interface GistTransport {
  create(token: string, filename: string, content: string): Promise<string>
  read(token: string, gistId: string, filename: string): Promise<string | null>
  update(token: string, gistId: string, filename: string, content: string): Promise<void>
  find(token: string, filename: string): Promise<string | null>
}

const API = 'https://api.github.com'

function headers(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
  }
}

async function expectOk(res: Response, what: string): Promise<void> {
  if (!res.ok) {
    const detail = res.status === 401 ? 'token rejected' : res.status === 404 ? 'not found' : `HTTP ${res.status}`
    throw new Error(`Sync ${what} failed: ${detail}`)
  }
}

export const githubGistTransport: GistTransport = {
  async create(token, filename, content) {
    const res = await fetch(`${API}/gists`, {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify({
        description: 'Life OS sync — do not edit by hand',
        public: false,
        files: { [filename]: { content } },
      }),
    })
    await expectOk(res, 'create')
    const body = (await res.json()) as { id: string }
    return body.id
  },

  async read(token, gistId, filename) {
    const res = await fetch(`${API}/gists/${gistId}`, { headers: headers(token) })
    await expectOk(res, 'pull')
    const body = (await res.json()) as {
      files: Record<string, { content?: string; truncated?: boolean; raw_url?: string } | undefined>
    }
    const file = body.files[filename]
    if (!file) return null
    if (file.truncated && file.raw_url) {
      const raw = await fetch(file.raw_url)
      await expectOk(raw, 'pull (raw)')
      return raw.text()
    }
    return file.content ?? null
  },

  async update(token, gistId, filename, content) {
    const res = await fetch(`${API}/gists/${gistId}`, {
      method: 'PATCH',
      headers: headers(token),
      body: JSON.stringify({ files: { [filename]: { content } } }),
    })
    await expectOk(res, 'push')
  },

  async find(token, filename) {
    const res = await fetch(`${API}/gists?per_page=100`, { headers: headers(token) })
    await expectOk(res, 'lookup')
    const gists = (await res.json()) as Array<{ id: string; files: Record<string, unknown> }>
    return gists.find((g) => filename in g.files)?.id ?? null
  },
}

/* ---------- settings ---------- */

export async function getSyncSettings(): Promise<SyncSettings | null> {
  const rec = await get<{ key: string; value: SyncSettings | null }>(STORES.meta, SETTINGS_KEY)
  return rec?.value ?? null
}

export async function saveSyncSettings(value: SyncSettings): Promise<void> {
  await put(STORES.meta, { key: SETTINGS_KEY, value })
}

export async function disconnectSync(): Promise<void> {
  await put(STORES.meta, { key: SETTINGS_KEY, value: null })
}

/* ---------- operations ---------- */

/**
 * First-time setup: reuse an existing sync gist on the account if one exists
 * (second device), otherwise create it seeded with this device's data.
 */
export async function connectSync(token: string, transport: GistTransport = githubGistTransport): Promise<SyncSettings> {
  const trimmed = token.trim()
  const existing = await transport.find(trimmed, SYNC_FILENAME)
  let gistId: string
  if (existing) {
    gistId = existing
  } else {
    const doc = await buildExportDoc()
    gistId = await transport.create(trimmed, SYNC_FILENAME, JSON.stringify(doc))
  }
  const settings: SyncSettings = { token: trimmed, gistId, autoSync: true }
  await saveSyncSettings(settings)
  return settings
}

/** Pull → merge → push. Local DB ends as the union; the gist gets the union. */
export async function syncNow(transport: GistTransport = githubGistTransport): Promise<SyncResult> {
  const settings = await getSyncSettings()
  if (!settings) throw new Error('Sync is not set up')

  let pulled = 0
  const content = await transport.read(settings.token, settings.gistId, SYNC_FILENAME)
  if (content) {
    let remote: ExportDoc
    try {
      remote = JSON.parse(content) as ExportDoc
    } catch {
      throw new Error('Sync pull failed: gist content is not valid JSON')
    }
    const report = await importDoc(remote, 'merge')
    pulled =
      report.profiles.added +
      report.profiles.updated +
      Object.values(report.modules).reduce((n, r) => n + r.added + r.updated, 0)
  }

  const union = await buildExportDoc()
  await transport.update(settings.token, settings.gistId, SYNC_FILENAME, JSON.stringify(union))

  const at = nowIso()
  const result: SyncResult = { pulled, pushed: true, at }
  await saveSyncSettings({
    ...settings,
    lastSyncAt: at,
    lastSummary: pulled > 0 ? `pulled ${pulled}, pushed all` : 'pushed all, nothing new to pull',
  })
  return result
}

/** Fire-and-forget sync for background triggers (app focus, workout finish). */
export async function syncQuietly(transport: GistTransport = githubGistTransport): Promise<SyncResult | null> {
  try {
    const settings = await getSyncSettings()
    if (!settings?.autoSync) return null
    return await syncNow(transport)
  } catch {
    return null // calm: background sync failures never surface as errors
  }
}

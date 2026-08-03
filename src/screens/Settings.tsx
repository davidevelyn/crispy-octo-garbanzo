import { useEffect, useRef, useState } from 'react'
import { useApp, toast } from '../platform/store'
import { saveProfile, getProfiles } from '../platform/profiles'
import { buildExportDoc, downloadJson, importDoc } from '../platform/exportImport'
import { connectSync, disconnectSync, getSyncSettings, saveSyncSettings, syncNow, type SyncSettings } from '../platform/sync'
import type { ExportDoc } from '../platform/types'

export function Settings() {
  const profiles = useApp((s) => s.profiles)
  const activeProfileId = useApp((s) => s.activeProfileId)
  const setProfiles = useApp((s) => s.setProfiles)
  const profile = profiles.find((p) => p.profileId === activeProfileId)
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  if (!profile) return null

  const update = async (patch: Partial<typeof profile>) => {
    await saveProfile({ ...profile, ...patch })
    setProfiles(await getProfiles())
  }

  const onExport = async () => {
    const doc = await buildExportDoc()
    downloadJson(doc, `life-os-export-${new Date().toISOString().slice(0, 10)}.json`)
    toast('Exported')
  }

  const onImportFile = async (file: File) => {
    setBusy(true)
    try {
      const doc = JSON.parse(await file.text()) as ExportDoc
      const report = await importDoc(doc, 'merge')
      const total = Object.values(report.modules).reduce(
        (n, r) => n + r.added + r.updated,
        report.profiles.added + report.profiles.updated,
      )
      setProfiles(await getProfiles())
      toast(`Imported — ${total} records merged`)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="screen">
      <div className="section-title">Profile — {profile.name}</div>
      <div className="card stack">
        <div className="field">
          <label>Display name</label>
          <input
            className="input"
            defaultValue={profile.name}
            onBlur={(e) => {
              const name = e.target.value.trim()
              if (name && name !== profile.name) void update({ name })
            }}
          />
        </div>
        <div className="field">
          <label>Units</label>
          <div className="hstack">
            {(['lbs', 'kg'] as const).map((u) => (
              <button key={u} className={`chip ${profile.units === u ? 'on' : ''}`} onClick={() => void update({ units: u })}>
                {u}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <label>Bar weight (lbs)</label>
          <input
            className="input"
            type="number"
            inputMode="decimal"
            defaultValue={profile.barWeightLbs}
            onBlur={(e) => {
              const v = Number(e.target.value)
              if (v > 0 && v !== profile.barWeightLbs) void update({ barWeightLbs: v })
            }}
          />
        </div>
        <div className="field">
          <label>Plates per side (lbs, comma-separated)</label>
          <input
            className="input"
            defaultValue={profile.platesLbs.join(', ')}
            onBlur={(e) => {
              const plates = e.target.value
                .split(',')
                .map((s) => Number(s.trim()))
                .filter((n) => n > 0)
              if (plates.length > 0) void update({ platesLbs: plates })
            }}
          />
        </div>
      </div>

      <SyncSection />

      <div className="section-title">Data</div>
      <div className="stack">
        <button className="btn" onClick={() => void onExport()}>
          Export everything (JSON)
        </button>
        <button className="btn ghost" disabled={busy} onClick={() => fileRef.current?.click()}>
          Import from export file
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void onImportFile(f)
            e.target.value = ''
          }}
        />
        <p className="faint" style={{ fontSize: 13 }}>
          Everything lives on this device. The export file is the full picture — readable by you, and by any
          agent you point at it.
        </p>
      </div>
    </main>
  )
}

function relTime(iso?: string): string {
  if (!iso) return 'never'
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.round(mins / 60)
  return hours < 24 ? `${hours}h ago` : `${Math.round(hours / 24)}d ago`
}

function SyncSection() {
  const [settings, setSettings] = useState<SyncSettings | null>(null)
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const refresh = () =>
    void getSyncSettings().then((s) => {
      setSettings(s)
      setLoaded(true)
    })
  useEffect(refresh, [])

  if (!loaded) return null

  const connect = async () => {
    if (!token.trim()) return
    setBusy(true)
    try {
      await connectSync(token)
      await syncNow()
      setToken('')
      refresh()
      toast('Sync connected')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not connect')
    } finally {
      setBusy(false)
    }
  }

  const runSync = async () => {
    setBusy(true)
    try {
      const result = await syncNow()
      refresh()
      toast(result.pulled > 0 ? `Synced — ${result.pulled} new` : 'Synced — up to date')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Sync failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="section-title">Sync between your devices</div>
      {settings ? (
        <div className="card stack">
          <div className="spread">
            <div>
              <div className="title" style={{ fontSize: 15, fontWeight: 550 }}>Connected</div>
              <div className="sub">
                Last sync {relTime(settings.lastSyncAt)}
                {settings.lastSummary ? ` · ${settings.lastSummary}` : ''}
              </div>
            </div>
          </div>
          <button className="btn primary" disabled={busy} onClick={() => void runSync()}>
            Sync now
          </button>
          <button
            className={`chip ${settings.autoSync ? 'on' : ''}`}
            onClick={() => {
              void saveSyncSettings({ ...settings, autoSync: !settings.autoSync }).then(refresh)
            }}
            style={{ alignSelf: 'flex-start' }}
          >
            Auto-sync when the app opens {settings.autoSync ? '· on' : '· off'}
          </button>
          <button
            className="btn ghost faint"
            onClick={() => {
              void disconnectSync().then(() => {
                refresh()
                toast('Sync disconnected — data stays on this device')
              })
            }}
          >
            Disconnect this device
          </button>
        </div>
      ) : (
        <div className="card stack">
          <p className="dim" style={{ fontSize: 13 }}>
            Share one household pool — lists, tasks, and each other's training — using a private GitHub gist.
            Create a fine-grained token at github.com → Settings → Developer settings → Tokens, with{' '}
            <strong>only the Gists permission</strong>. First device creates the pool; the second joins it with
            the same account's token. The token stays on this device.
          </p>
          <input
            className="input"
            type="password"
            placeholder="GitHub token (gist-only)"
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
          <button className="btn primary" disabled={busy || !token.trim()} onClick={() => void connect()}>
            Connect sync
          </button>
        </div>
      )}
    </>
  )
}

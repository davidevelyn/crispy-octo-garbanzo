/**
 * Database structure. Additive-only structural upgrades: each version case
 * creates stores/indexes and falls through. Record-shape changes never happen
 * here — readers tolerate missing fields and app-level code migrates keyed
 * off meta.schemaVersion.
 */

export const DB_NAME = 'life-os'
export const DB_VERSION = 1

export const STORES = {
  profiles: 'profiles',
  meta: 'meta',
  sessions: 'sessions',
  programStates: 'programStates',
  routines: 'routines',
  measurements: 'measurements',
  grocery: 'grocery',
  tasks: 'tasks',
} as const

export type StoreName = (typeof STORES)[keyof typeof STORES]

export function upgrade(db: IDBDatabase, oldVersion: number): void {
  switch (oldVersion) {
    case 0: {
      db.createObjectStore(STORES.profiles, { keyPath: 'id' })
      db.createObjectStore(STORES.meta, { keyPath: 'key' })

      const sessions = db.createObjectStore(STORES.sessions, { keyPath: 'id' })
      sessions.createIndex('byProfileStart', ['profileId', 'startedAt'])
      sessions.createIndex('byProfileStatus', ['profileId', 'status'])

      const programStates = db.createObjectStore(STORES.programStates, { keyPath: 'id' })
      programStates.createIndex('byProfile', 'profileId')

      const routines = db.createObjectStore(STORES.routines, { keyPath: 'id' })
      routines.createIndex('byProfile', 'profileId')

      const measurements = db.createObjectStore(STORES.measurements, { keyPath: 'id' })
      measurements.createIndex('byProfileMetric', ['profileId', 'metric', 'takenAt'])

      db.createObjectStore(STORES.grocery, { keyPath: 'id' })
      db.createObjectStore(STORES.tasks, { keyPath: 'id' })
    }
    // falls through on future versions
  }
}

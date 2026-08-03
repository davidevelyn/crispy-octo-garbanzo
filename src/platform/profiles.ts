import { get, getAll, put } from './db'
import { STORES } from './schema'
import { nowIso } from './ids'
import type { Profile, ProfileId } from './types'

const DEFAULT_PLATES = [45, 35, 25, 10, 5, 2.5]

function makeProfile(id: ProfileId, name: string): Profile {
  const now = nowIso()
  return {
    id,
    profileId: id,
    name,
    units: 'lbs',
    barWeightLbs: 45,
    platesLbs: DEFAULT_PLATES,
    roundTomorrow: false,
    createdAt: now,
    updatedAt: now,
  }
}

/** Idempotent: creates the two household profiles on first run. */
export async function seedProfiles(): Promise<void> {
  const existing = await getAll<Profile>(STORES.profiles)
  if (existing.length === 0) {
    await put(STORES.profiles, makeProfile('david', 'David'))
    await put(STORES.profiles, makeProfile('margs', 'Margs'))
  }
}

export async function getProfiles(): Promise<Profile[]> {
  const all = await getAll<Profile>(STORES.profiles)
  return all.sort((a, b) => (a.id === 'david' ? -1 : b.id === 'david' ? 1 : 0))
}

export async function getProfile(id: ProfileId): Promise<Profile | undefined> {
  return get<Profile>(STORES.profiles, id)
}

export async function saveProfile(profile: Profile): Promise<Profile> {
  const next = { ...profile, updatedAt: nowIso() }
  await put(STORES.profiles, next)
  return next
}

export async function getLastProfileId(): Promise<ProfileId> {
  const rec = await get<{ key: string; value: ProfileId }>(STORES.meta, 'lastProfileId')
  return rec?.value ?? 'david'
}

export async function setLastProfileId(id: ProfileId): Promise<void> {
  await put(STORES.meta, { key: 'lastProfileId', value: id })
}

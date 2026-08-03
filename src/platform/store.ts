import { create } from 'zustand'
import type { ProfileId, Profile } from './types'

export interface RestTimerState {
  /** epoch ms when rest completes — timestamp truth, UI derives remaining */
  endsAt: number
  totalSec: number
  exerciseName: string
}

interface AppState {
  activeProfileId: ProfileId
  profiles: Profile[]
  restTimer: RestTimerState | null
  toast: string | null
  /** bumped after a background sync pulls changes — screens depend on it to refresh */
  syncTick: number
  setActiveProfile(id: ProfileId): void
  setProfiles(profiles: Profile[]): void
  startRest(totalSec: number, exerciseName: string): void
  clearRest(): void
  showToast(message: string): void
  clearToast(): void
  bumpSyncTick(): void
}

export const useApp = create<AppState>((set) => ({
  activeProfileId: 'david',
  profiles: [],
  restTimer: null,
  toast: null,
  syncTick: 0,
  setActiveProfile: (id) => set({ activeProfileId: id }),
  setProfiles: (profiles) => set({ profiles }),
  startRest: (totalSec, exerciseName) =>
    set({ restTimer: { endsAt: Date.now() + totalSec * 1000, totalSec, exerciseName } }),
  clearRest: () => set({ restTimer: null }),
  showToast: (toast) => set({ toast }),
  clearToast: () => set({ toast: null }),
  bumpSyncTick: () => set((s) => ({ syncTick: s.syncTick + 1 })),
}))

let toastTimeout: ReturnType<typeof setTimeout> | undefined
export function toast(message: string): void {
  useApp.getState().showToast(message)
  clearTimeout(toastTimeout)
  toastTimeout = setTimeout(() => useApp.getState().clearToast(), 2200)
}

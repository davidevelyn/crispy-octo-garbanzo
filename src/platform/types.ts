import type { RouteObject } from 'react-router-dom'
import type { ComponentType } from 'react'

/** ISO 8601 datetime string, e.g. '2026-08-03T22:14:00.000Z' */
export type ISODateTime = string

export type ProfileId = 'david' | 'margs'
export type OwnerId = ProfileId | 'shared'

/** Every persisted record carries these; updatedAt is the merge key for import/sync. */
export interface BaseRecord {
  id: string
  profileId: OwnerId
  createdAt: ISODateTime
  updatedAt: ISODateTime
}

export interface Profile extends BaseRecord {
  profileId: ProfileId
  name: string
  units: 'lbs' | 'kg'
  barWeightLbs: number
  /** per-side plate inventory in lbs */
  platesLbs: number[]
  /** golf flag: swaps heavy-lower slots in tonight's session, auto-clears after */
  roundTomorrow: boolean
  activeProgramStateId?: string
}

export interface ImportReport {
  added: number
  updated: number
  skippedOlder: number
  errors: string[]
}

export interface ModuleDefinition {
  id: string
  title: string
  basePath: string
  routes: RouteObject[]
  HomeCard: ComponentType<{ profileId: ProfileId }>
  /** IndexedDB store names this module owns (drives export/import) */
  stores: string[]
  exportData(): Promise<unknown>
  importData(section: unknown, mode: 'merge' | 'replace'): Promise<ImportReport>
}

export interface ExportDoc {
  schemaVersion: number
  exportedAt: ISODateTime
  app: 'life-os'
  profiles: Profile[]
  modules: Record<string, unknown>
}

export const SCHEMA_VERSION = 1

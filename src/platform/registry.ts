import type { ModuleDefinition } from './types'

/**
 * The module registry — the "OS" seam. Modules self-describe routes, a home
 * card, owned stores, and export/import. The platform never imports module
 * screens directly; adding a life domain = adding one ModuleDefinition.
 */

let modules: ModuleDefinition[] = []

export function registerModules(defs: ModuleDefinition[]): void {
  modules = defs
}

export function getModules(): ModuleDefinition[] {
  return modules
}

export function getModule(id: string): ModuleDefinition | undefined {
  return modules.find((m) => m.id === id)
}

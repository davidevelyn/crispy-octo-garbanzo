/** Single home for identity + time so tests can mock deterministically. */

export function uuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export function nowIso(): string {
  return new Date().toISOString()
}

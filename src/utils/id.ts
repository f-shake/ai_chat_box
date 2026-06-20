export function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

export function getNow(): string {
  return new Date().toISOString()
}

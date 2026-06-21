import type { ApiConfig } from '@/types'

const SHARE_SECRET = 'AI_CHAT_BOX_2026AI_CHAT_BOX_2026'
const SALT = new TextEncoder().encode('ai_chat_salt')

export interface ShareData {
  url?: string
  model?: string
  name?: string
  key?: string
  tools?: {
    presetId: string
    presetConfig: Record<string, any>
    toolToggles: Record<string, any>
    searchConfig: Record<string, any>
  }
}

async function deriveKey(): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(SHARE_SECRET),
    'PBKDF2',
    false,
    ['deriveKey']
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: SALT, iterations: 10000, hash: 'SHA-256' },
    key,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

export async function encryptShareData(obj: ShareData): Promise<string> {
  const key = await deriveKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const data = new TextEncoder().encode(JSON.stringify(obj))
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data)
  const combined = new Uint8Array(iv.length + cipher.byteLength)
  combined.set(iv)
  combined.set(new Uint8Array(cipher), iv.length)
  return btoa(String.fromCharCode(...combined))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

export async function decryptShareData(encoded: string): Promise<ShareData> {
  const key = await deriveKey()
  const raw = Uint8Array.from(
    atob(encoded.replace(/-/g, '+').replace(/_/g, '/')),
    (c) => c.charCodeAt(0)
  )
  const iv = raw.slice(0, 12)
  const cipher = raw.slice(12)
  const dec = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher)
  return JSON.parse(new TextDecoder().decode(dec))
}

export function useEncryptedShare() {
  function parseSharedConfigFromUrl(): ShareData | null {
    const params = new URLSearchParams(window.location.search)
    const data = params.get('data')
    if (!data) return null
    // Decrypt will happen async; return the raw string for later processing
    return null // actual decryption is done via the standalone function
  }

  function buildShareUrl(shareData: ShareData): string {
    encryptShareData(shareData).then((encoded) => {
      const url = `${window.location.origin}${window.location.pathname}?data=${encoded}`
      return url
    })
    return ''
  }

  return {
    parseSharedConfigFromUrl,
    buildShareUrl,
  }
}

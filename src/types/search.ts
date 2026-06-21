export type SearchProvider = 'local' | 'bocha'

export interface SearchConfig {
  provider: SearchProvider
  enabled: boolean
  // Local proxy
  proxyUrl: string
  // Bocha search
  bochaApiKey: string
}

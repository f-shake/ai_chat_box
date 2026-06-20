export type ApiStatus = 'unknown' | 'online' | 'offline' | 'checking'

export interface ApiConfig {
  id: string
  name: string
  apiUrl: string
  apiKey: string
  model: string
  status: ApiStatus
  statusError: string
}

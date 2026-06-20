export interface SearchResult {
  title: string
  url: string
  snippet: string
  engine?: string
}

export async function searchWeb(
  query: string,
  count: number,
  proxyUrl: string,
  engine?: string
): Promise<SearchResult[]> {
  const params = new URLSearchParams({ q: query })
  if (engine) params.set('engine', engine)
  const resp = await fetch(`${proxyUrl}/api/search?${params}`, {
    signal: AbortSignal.timeout(30000),
  })
  if (!resp.ok) throw new Error(`Search failed: HTTP ${resp.status}`)
  const data = await resp.json()
  return data.results || []
}

export async function fetchWebpage(url: string, proxyUrl: string): Promise<string> {
  const resp = await fetch(`${proxyUrl}/api/fetch?url=${encodeURIComponent(url)}`, {
    signal: AbortSignal.timeout(20000),
  })
  if (!resp.ok) throw new Error(`Fetch failed: HTTP ${resp.status}`)
  const data = await resp.json()
  return data.content || ''
}

export async function testSearchProxy(proxyUrl: string): Promise<boolean> {
  try {
    const resp = await fetch(`${proxyUrl}/api/status`, {
      signal: AbortSignal.timeout(5000),
    })
    if (!resp.ok) return false
    const data = await resp.json()
    return data.status === 'ok'
  } catch {
    return false
  }
}

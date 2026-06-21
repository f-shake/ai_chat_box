export interface SearchResult {
  title: string
  url: string
  snippet: string
  siteName?: string
  datePublished?: string
}

// ===== Local proxy search =====

export async function searchWeb(
  query: string,
  count: number,
  proxyUrl: string
): Promise<SearchResult[]> {
  const resp = await fetch(`${proxyUrl}/api/search?q=${encodeURIComponent(query)}`, {
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

// ===== Bocha search =====

const BOCHA_API_URL = 'https://api.bocha.cn/v1/web-search'

export async function testBochaConnection(apiKey: string): Promise<{ success: boolean; message: string }> {
  try {
    const resp = await fetch(BOCHA_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: 'test', count: 1, summary: false }),
      signal: AbortSignal.timeout(10000),
    })
    if (resp.ok) return { success: true, message: '连接成功' }
    if (resp.status === 403) return { success: false, message: '余额不足' }
    if (resp.status === 401) return { success: false, message: 'API Key 无效' }
    return { success: false, message: `HTTP ${resp.status}` }
  } catch (e: any) {
    return { success: false, message: e.message || '连接失败' }
  }
}

export async function bochaSearch(query: string, apiKey: string, count: number = 10): Promise<SearchResult[]> {
  const resp = await fetch(BOCHA_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      summary: true,
      count,
      freshness: 'noLimit',
    }),
    signal: AbortSignal.timeout(30000),
  })

  if (!resp.ok) {
    if (resp.status === 403) throw new Error('博查搜索余额不足')
    if (resp.status === 401) throw new Error('博查搜索 API Key 无效')
    throw new Error(`博查搜索失败: HTTP ${resp.status}`)
  }

  const body = await resp.json()
  if (body.code !== 200) throw new Error(body.msg || '博查搜索返回异常')

  const pages = body.data?.webPages?.value || []
  return pages.map((item: any) => ({
    title: item.name || '',
    url: item.url || '',
    snippet: item.summary || item.snippet || '',
    siteName: item.siteName || '',
    datePublished: item.datePublished || '',
  }))
}

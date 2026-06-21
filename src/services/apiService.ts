import type { ToolCall, StreamCallbacks } from '@/types'

/**
 * Convert common HTTP errors to user-friendly Chinese messages
 */
function friendlyHttpError(status: number, body: string): string {
  const lower = body.toLowerCase()
  if (status === 401 || status === 403) {
    if (lower.includes('authentication') || lower.includes('auth fail') || lower.includes('api key') || lower.includes('unauthorized')) {
      return 'AI 服务认证失败，请检查 API Key 是否正确'
    }
    return 'AI 服务拒绝访问，请检查 API 密钥或账户余额'
  }
  if (status === 404) return 'API 地址不正确，请检查 URL 是否包含 /v1 路径'
  if (status === 429) return '请求过于频繁，请稍后再试'
  if (status === 502 || status === 503) return 'AI 服务暂时不可用，请稍后重试'
  if (status === 400) {
    if (lower.includes('model')) return '模型名称不正确或不可用，请检查模型设置'
    if (lower.includes('content')) return '消息内容有误，请检查输入'
    return `请求参数有误：${body.slice(0, 200)}`
  }
  const details = body ? ` — ${body.slice(0, 200)}` : ''
  return `AI 服务错误 (HTTP ${status})${details}`
}

export interface ApiServiceOptions {
  apiUrl: string
  apiKey: string
  model: string
  systemPrompt: string
  messages: Array<{ role: string; content: any; tool_calls?: ToolCall[]; tool_call_id?: string }>
  temperature: number
  maxTokens: number
  topP: number
  frequencyPenalty: number
  presencePenalty: number
  reasoningEnabled: boolean
  searchEnabled: boolean
  calculatorEnabled: boolean
}

export interface StreamResult {
  fullContent: string
  fullReasoning: string
  toolCalls: ToolCall[]
  finishReason: string | null
}

function buildTools(searchEnabled: boolean, calculatorEnabled: boolean) {
  const tools: any[] = []

  if (searchEnabled) {
    tools.push({
      type: 'function' as const,
      function: {
        name: 'web_search',
        description: '搜索互联网获取实时信息。当用户询问新闻、天气、最新事件、不了解的知识、需要查询资料、验证事实时，必须调用此工具。不要用自己的知识回答不确定的内容，优先搜索。',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: '搜索关键词，尽量简洁准确，使用中文搜索' },
            count: { type: 'number', description: '每个引擎返回几条结果，默认8条', default: 8 },
          },
          required: ['query'],
        },
      },
    })
    tools.push({
      type: 'function' as const,
      function: {
        name: 'web_fetch',
        description: '获取指定URL的详细页面内容。当搜索结果摘要信息不足或用户要求查看具体页面时，用此工具获取完整页面内容。',
        parameters: {
          type: 'object',
          properties: {
            url: { type: 'string', description: '要读取的完整网页地址' },
          },
          required: ['url'],
        },
      },
    })
  }

  if (calculatorEnabled) {
    tools.push({
      type: 'function' as const,
      function: {
        name: 'calculator',
        description: '执行数学计算。当用户需要进行算术运算、数学公式计算时请使用此工具。传入符合 JavaScript 的表达式，例如 "1+2*3"、"Math.log(3*Math.pow(3,4))"、"Math.sin(30*Math.PI/180)"。注意：用户输入可能不规范的运算符（如 × 转为 * 、÷ 转为 /），请先转换为合法 JS 表达式再传入。返回结果会自动纠正浮点数精度问题（如 0.1+0.2 会返回 0.3 而非 0.300...04）。',
        parameters: {
          type: 'object',
          properties: {
            expression: { type: 'string', description: '要计算的 JavaScript 表达式' },
          },
          required: ['expression'],
        },
      },
    })
  }

  return tools
}

export async function streamChat(
  options: ApiServiceOptions,
  callbacks: StreamCallbacks,
  signal: AbortSignal
): Promise<StreamResult> {
  const {
    apiUrl, apiKey, model, systemPrompt,
    messages, temperature, maxTokens, topP, frequencyPenalty,
    presencePenalty, reasoningEnabled, searchEnabled,
  } = options

  const body: Record<string, any> = {
    model,
    messages,
    temperature,
    stream: true,
  }

  if (maxTokens > 0) body.max_tokens = maxTokens
  if (topP !== undefined && topP !== 1.0) body.top_p = topP
  if (frequencyPenalty !== undefined && frequencyPenalty !== 0) body.frequency_penalty = frequencyPenalty
  if (presencePenalty !== undefined && presencePenalty !== 0) body.presence_penalty = presencePenalty

  if (reasoningEnabled) {
    body.reasoning_effort = 'high'
    body.thinking = { type: 'enabled' }
    body.extra_body = { chat_template_kwargs: { enable_thinking: true } }
  } else {
    // Explicitly disable thinking so model doesn't default to it
    body.thinking = { type: 'disabled' }
    body.extra_body = { chat_template_kwargs: { enable_thinking: false } }
  }

  if (searchEnabled) {
    body.tools = buildTools(options.searchEnabled, options.calculatorEnabled)
  } else if (options.calculatorEnabled) {
    body.tools = buildTools(false, options.calculatorEnabled)
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`

  const resp = await fetch(`${apiUrl.replace(/\/+$/, '')}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal,
  })

  if (!resp.ok) {
    const errBody = await resp.text().catch(() => '')
    let userMsg = friendlyHttpError(resp.status, errBody)
    throw new Error(userMsg)
  }

  const reader = resp.body!.getReader()
  const decoder = new TextDecoder()

  let fullContent = ''
  let fullReasoning = ''
  const pendingToolCalls: Map<number, ToolCall> = new Map()
  let finishReason: string | null = null
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || !trimmed.startsWith('data: ')) continue
      const data = trimmed.slice(6)
      if (data === '[DONE]') continue

      try {
        const parsed = JSON.parse(data)
        const delta = parsed.choices?.[0]?.delta || {}
        const finish = parsed.choices?.[0]?.finish_reason

        // Content
        if (delta.content) {
          fullContent += delta.content
          callbacks.onContent(fullContent)
        }

        // Reasoning
        if (delta.reasoning_content) {
          fullReasoning += delta.reasoning_content
          callbacks.onReasoning(fullReasoning)
        }

        // Tool calls
        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index
            if (!pendingToolCalls.has(idx)) {
              pendingToolCalls.set(idx, {
                id: tc.id || '',
                type: 'function',
                function: { name: tc.function?.name || '', arguments: tc.function?.arguments || '' },
              })
            } else {
              const existing = pendingToolCalls.get(idx)!
              if (tc.function?.name) existing.function.name += tc.function.name
              if (tc.function?.arguments) existing.function.arguments += tc.function.arguments
              if (tc.id) existing.id = tc.id
            }
            callbacks.onToolCallChunk(idx, delta)
          }
        }

        if (finish) {
          finishReason = finish
        }
      } catch {
        // Skip malformed JSON lines
      }
    }
  }

  // Process remaining buffer
  if (buffer.trim()) {
    try {
      const data = buffer.trim().slice(6)
      if (data && data !== '[DONE]') {
        const parsed = JSON.parse(data)
        const finish = parsed.choices?.[0]?.finish_reason
        if (finish) finishReason = finish
      }
    } catch {
      // ignore
    }
  }

  const toolCalls = Array.from(pendingToolCalls.values())
  await callbacks.onFinish(finishReason, toolCalls)

  return { fullContent, fullReasoning, toolCalls, finishReason }
}

export async function testConnection(
  url: string,
  key: string
): Promise<{ success: boolean; text: string; models?: string[] }> {
  const apiUrl = url.replace(/\/+$/, '')
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (key) headers['Authorization'] = `Bearer ${key}`

  try {
    // Try GET /models first
    const resp = await fetch(`${apiUrl}/models`, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(10000),
    })
    if (resp.ok) {
      const data = await resp.json()
      const models = (data.data || []).map((m: any) => m.id || m)
      return { success: true, text: `连接成功，${models.length} 个模型可用`, models }
    }
    // Fallback: try a non-streaming chat completion
    const fallbackResp = await fetch(`${apiUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'hi' }],
        max_tokens: 1,
        stream: false,
      }),
      signal: AbortSignal.timeout(10000),
    })
    if (fallbackResp.ok) {
      return { success: true, text: '连接成功' }
    }
    const errBody = await fallbackResp.text().catch(() => '')
    return { success: false, text: `HTTP ${fallbackResp.status}: ${errBody.slice(0, 200)}` }
  } catch (e: any) {
    return { success: false, text: e.message || '连接失败' }
  }
}

export async function generateTitle(
  apiUrl: string,
  apiKey: string,
  model: string,
  userText: string,
  assistantText: string
): Promise<string> {
  const promptText = `为以下对话生成一个简短的中文标题（不超过15个字），直接返回标题文本，不要引号，不要多余内容。

用户：${userText.slice(0, 100)}${userText.length > 100 ? '…' : ''}${assistantText ? '\n\nAI：' + assistantText.slice(0, 200) + (assistantText.length > 200 ? '…' : '') : ''}`

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`

  const resp = await fetch(`${apiUrl.replace(/\/+$/, '')}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content: '你是一个对话标题生成器。根据对话内容生成简短标题，不超过15个字，直接返回标题文本。',
        },
        { role: 'user', content: promptText },
      ],
      temperature: 0.3,
      max_tokens: 256,
      stream: false,
      extra_body: { thinking: { type: 'disabled' } },
    }),
    signal: AbortSignal.timeout(15000),
  })

  if (!resp.ok) return ''
  const data = await resp.json()
  const msg = data.choices?.[0]?.message || {}
  const title = (msg.content || msg.reasoning_content || '').trim().replace(/^["「『]+|["」』]+$/g, '')
  if (title && title.length <= 20) return title
  return ''
}

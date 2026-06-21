import { ref } from 'vue'
import { useConversationStore } from '@/stores/conversationStore'

const MAX_CONSECUTIVE_FAILURES = 5
import { useConfigStore } from '@/stores/configStore'
import { useApiConfigStore } from '@/stores/apiConfigStore'
import { useSearchStore } from '@/stores/searchStore'
import { streamChat, generateTitle, type ApiServiceOptions } from '@/services/apiService'
import * as searchService from '@/services/searchService'
import { replacePromptPlaceholders } from '@/utils/prompts'
import { flattenContentForApi } from '@/utils/apiHelpers'
import { SAVE_INTERVAL } from '@/utils/constants'
import type { ToolCall, Message, ToolResult } from '@/types'

export function useStreamChat() {
  const conversationStore = useConversationStore()
  const configStore = useConfigStore()
  const apiConfigStore = useApiConfigStore()
  const searchStore = useSearchStore()

  const isStreaming = ref(false)
  const abortController = ref<AbortController | null>(null)
  const streamMsgIdx = ref(-1)

  async function sendMessage(userText?: string) {
    if (isStreaming.value) return

    const apiCfg = apiConfigStore.activeConfig
    if (!apiCfg || !apiCfg.apiUrl || !apiCfg.model) {
      ElMessage.error('请先完成 API 配置并测试连接')
      return
    }

    // Determine user content
    let userContent: any
    const hasFiles = conversationStore.pendingFiles.length > 0
    const text = userText !== undefined ? userText : configStore.activeConfig.systemPrompt // just placeholder

    // Read from textarea or use passed text
    const trimmed = (userText !== undefined ? userText : '').trim()
    if (!trimmed && !hasFiles) return

    if (hasFiles) {
      userContent = []
      if (trimmed) userContent.push({ type: 'text', text: trimmed })
      for (const f of conversationStore.pendingFiles) {
        if (f._type === 'image') {
          userContent.push({ type: 'image_url', image_url: { url: f.content } })
        } else {
          userContent.push({
            type: 'file',
            file: { name: f.name, content: f.content, size: f.size, mime: f.mime },
          })
        }
      }
    } else {
      userContent = trimmed
    }

    if (typeof userContent === 'string' && !userContent) return

    // Handle edit mode
    if (conversationStore.editingMsgIdx >= 0) {
      const editIdx = conversationStore.editingMsgIdx
      conversationStore.currentMessages.splice(editIdx)
      conversationStore.msgCounter = 0
      conversationStore.cancelEdit()
    }

    // Create conversation if none active
    if (!conversationStore.activeConvId) {
      await conversationStore.newConversation()
    }

    // Push user message
    conversationStore.pushUserMessage(userContent)
    conversationStore.saveCurrentConversation()
    conversationStore.pendingFiles = []

    // Add assistant placeholder
    const mIdx = conversationStore.currentMessages.length
    conversationStore.pushAssistantMessage()
    streamMsgIdx.value = mIdx

    // Use conversation snapshot params if available, else active preset
    const convCfg = conversationStore.activeConversation?.snapshot?.config || configStore.activeConfig

    // Build system prompt with search guidance
    const sys = replacePromptPlaceholders(configStore.activeConfig.systemPrompt)
    const isBocha = searchStore.config.provider === 'bocha'
    const hasSearchConfig = isBocha ? searchStore.config.bochaApiKey : searchStore.config.proxyUrl
    const searchEnabled = searchStore.config.enabled && !!hasSearchConfig
    const calcEnabled = configStore.params.calculatorEnabled

    // Build unified tools guidance
    const toolsGuidance: string[] = [
      '- 当用户询问当前日期、时间或时区时，使用 get_current_time 工具获取精确时间。',
      '- 当用户需要随机数、随机密码、掷骰子或唯一标识符时，使用 generate_random 或 generate_uuid 工具。',
      '- 当用户需要获取某个网页内容、且目标网站可能支持跨域（CORS）时，优先使用 fetch_page 工具直接获取。如果失败，再尝试 web_fetch（需本地代理）。',
    ]
    if (searchEnabled) {
      if (isBocha) {
        toolsGuidance.push(
          '- 当用户询问实时信息、新闻、不确定的事实、需要查询资料时，必须使用 web_search 工具搜索互联网。\n'
          + '  搜索结果包含标题、URL、摘要、来源和发布时间。根据搜索结果回答并引用来源。'
        )
      } else {
        toolsGuidance.push(
          '- 当用户询问实时信息、新闻、不确定的事实、需要查询资料时，必须使用 web_search 工具搜索互联网。\n'
          + '  如果搜索结果摘要信息不足，使用 web_fetch 打开最相关的链接获取完整内容。'
        )
      }
    }
    if (calcEnabled) {
      toolsGuidance.push(
        '- 当用户需要进行数学计算时，必须使用 calculator 工具。\n'
        + '  将用户的数学表达式转换为 JavaScript 形式传入，不要自己心算。'
        + '  例如：2+2 → 传 "2+2"；sin30° → 传 "Math.sin(30*Math.PI/180)"。'
        + '  需要知悉 JavaScript 计算可能存在浮点数精度问题（如 0.1+0.2）。'
      )
    }

    let toolsGuidanceText = ''
    if (toolsGuidance.length > 0) {
      toolsGuidanceText = '\n\n【可用工具】\n以下工具可以调用，请根据用户需求主动选择合适的工具：\n' + toolsGuidance.join('\n')
    }

    // Build API messages
    const historyLimit = convCfg.historyLimit || 20
    const msgsForApi: Array<{ role: string; content: any; tool_calls?: ToolCall[]; tool_call_id?: string }> = []

    if (sys) {
      msgsForApi.push({ role: 'system', content: sys + toolsGuidanceText })
    } else if (toolsGuidanceText) {
      msgsForApi.push({ role: 'system', content: toolsGuidanceText })
    }

    const historySlice = conversationStore.cutMessagesForApi(historyLimit)
    for (const m of historySlice) {
      if (m.role === 'system' || m.role === 'system-msg') continue
      const msg: any = { role: m.role }
      if (m.content) msg.content = flattenContentForApi(m.content)
      if (m.tool_calls) msg.tool_calls = m.tool_calls
      if (m.tool_call_id) msg.tool_call_id = m.tool_call_id
      msgsForApi.push(msg)
    }

    // Setup abort controller
    const controller = new AbortController()
    abortController.value = controller
    isStreaming.value = true
    conversationStore.isStreaming = true

    // Auto-save timer
    const saveTimer = setInterval(() => {
      const msg = conversationStore.currentMessages[streamMsgIdx.value]
      if (msg && msg.content) {
        conversationStore.saveCurrentConversation()
      }
    }, SAVE_INTERVAL)

    // Beforeunload handler
    const beforeUnloadHandler = () => {
      const msg = conversationStore.currentMessages[streamMsgIdx.value]
      if (msg && msg.content) {
        conversationStore.saveCurrentConversation()
      }
    }
    window.addEventListener('beforeunload', beforeUnloadHandler)

    let fullContent = ''
    let fullReasoning = ''
    const consecutiveFailCount = { value: 0 }

    try {
      const options: ApiServiceOptions = {
        apiUrl: apiCfg.apiUrl,
        apiKey: apiCfg.apiKey,
        model: apiCfg.model,
        systemPrompt: sys,
        messages: msgsForApi,
        temperature: convCfg.temperature,
        maxTokens: convCfg.maxTokens,
        topP: convCfg.topP,
        frequencyPenalty: convCfg.frequencyPenalty,
        presencePenalty: convCfg.presencePenalty,
        reasoningEnabled: convCfg.reasoningEnabled,
        calculatorEnabled: configStore.params.calculatorEnabled,
        timeEnabled: configStore.params.timeEnabled,
        randomEnabled: configStore.params.randomEnabled,
        uuidEnabled: configStore.params.uuidEnabled,
        fetchPageEnabled: configStore.params.fetchPageEnabled,
        searchEnabled,
      }

      await streamChat(
        options,
        {
          onContent: (text: string) => {
            fullContent = text
            conversationStore.updateMessageContent(streamMsgIdx.value, text)
          },
          onReasoning: (text: string) => {
            fullReasoning = text
            conversationStore.updateMessageReasoning(streamMsgIdx.value, text)
          },
          onToolCallChunk: (_index: number, _delta: any) => {
            // Tool calls are collected internally in apiService
          },
          onFinish: async (reason: string | null, toolCalls: ToolCall[]) => {
            if (reason === 'tool_calls' && toolCalls.length > 0) {
              const results = await executeToolCalls(toolCalls)
              const hasFailure = hasToolErrors(results)
              if (hasFailure) {
                consecutiveFailCount.value++
              } else {
                consecutiveFailCount.value = 0
              }
              if (consecutiveFailCount.value >= MAX_CONSECUTIVE_FAILURES) {
                const msg = conversationStore.currentMessages[streamMsgIdx.value]
                if (msg && typeof msg.content === 'string') {
                  msg.content += '\n\n> 工具连续多次失败，已自动停止'
                }
                return
              }
              await streamToolRound(msgsForApi, toolCalls, results, controller, options, consecutiveFailCount)
            }
          },
          onError: (error: Error) => {
            ElMessage.error(error.message)
          },
        },
        controller.signal
      )

      // Save final content (await to ensure IndexedDB write completes before finally block)
      await conversationStore.saveCurrentConversation()

      // Auto-generate title
      if (conversationStore.activeConversation && !conversationStore.activeConversation._aiTitle) {
        generateConversationTitleAsync(apiCfg.apiUrl, apiCfg.apiKey, apiCfg.model)
          .catch(() => {})
      }
    } catch (e: any) {
      if (e.name === 'AbortError') {
        // User stopped, save partial
        await conversationStore.saveCurrentConversation()
      } else {
        ElMessage.error(e.message || '发送失败')
        await conversationStore.saveCurrentConversation()
      }
    } finally {
      clearInterval(saveTimer)
      window.removeEventListener('beforeunload', beforeUnloadHandler)
      isStreaming.value = false
      conversationStore.isStreaming = false
      abortController.value = null
    }
  }

  async function executeToolCalls(toolCalls: ToolCall[]): Promise<ToolResult[]> {
    const results: ToolResult[] = []
    for (const tc of toolCalls) {
      const toolNameMap: Record<string, string> = {
        web_search: '联网搜索',
        web_fetch: '网页抓取',
        calculator: '计算器',
        get_current_time: '时间查询',
        generate_random: '随机数生成',
        generate_uuid: 'UUID 生成',
        fetch_page: '网页抓取',
      }
      const displayName = toolNameMap[tc.function.name] || tc.function.name

      // Show pending status
      const msg = conversationStore.currentMessages[streamMsgIdx.value]
      const beforeLen = msg?.content ? (typeof msg.content === 'string' ? msg.content.length : 0) : 0
      if (msg && typeof msg.content === 'string') {
        msg.content += `\n\n> 正在调用${displayName}...`
      }

      const replacePending = (resultText: string) => {
        if (!msg || typeof msg.content !== 'string') return
        msg.content = msg.content.slice(0, beforeLen) + resultText
      }

      try {
        const args = JSON.parse(tc.function.arguments)
        const isBocha = searchStore.config.provider === 'bocha'

        if (tc.function.name === 'web_search') {
          let searchResults: any[]
          if (isBocha) {
            searchResults = await searchService.bochaSearch(
              args.query,
              searchStore.config.bochaApiKey,
              args.count || 10
            )
          } else {
            searchResults = await searchService.searchWeb(
              args.query,
              args.count || 8,
              searchStore.config.proxyUrl
            )
          }
          results.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: JSON.stringify(searchResults),
          })
          if (searchResults.length > 0) {
            replacePending(`\n\n> 搜索完成（${searchResults.length} 条结果）：${args.query}`)
          } else {
            replacePending(`\n\n> 搜索完成，未找到相关结果：${args.query}`)
          }
        } else if (tc.function.name === 'calculator') {
          let result: any
          try {
            // Safe: eval runs in browser sandbox, same as any frontend JS
            result = String(eval(`'use strict'; (${args.expression})`))
          } catch (evalErr: any) {
            result = `计算错误：${evalErr.message}`
          }
          results.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: JSON.stringify({ result }),
          })
          replacePending(`\n\n> 计算结果：${result}`)
        } else if (tc.function.name === 'get_current_time') {
          const now = new Date()
          const result = {
            datetime: now.toLocaleString('zh-CN', { hour12: false }),
            date: now.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }),
            time: now.toLocaleTimeString('zh-CN', { hour12: false }),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            timestamp: now.getTime(),
            iso: now.toISOString(),
          }
          results.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result) })
          replacePending(`\n\n>当前时间：${result.datetime}（${result.timezone}）`)

        } else if (tc.function.name === 'generate_random') {
          const rMin = typeof args.min === 'number' ? args.min : 0
          const rMax = typeof args.max === 'number' ? args.max : 100
          const rCount = typeof args.count === 'number' ? args.count : 1
          const rType = args.type || 'number'
          const rLen = typeof args.length === 'number' ? args.length : 16
          const rResults: string[] = []
          for (let i = 0; i < rCount; i++) {
            if (rType === 'password') {
              const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
              let pwd = ''
              for (let j = 0; j < rLen; j++) pwd += chars[Math.floor(Math.random() * chars.length)]
              rResults.push(pwd)
            } else if (rType === 'hex') {
              let hex = ''
              for (let j = 0; j < rLen; j++) hex += Math.floor(Math.random() * 16).toString(16)
              rResults.push(hex)
            } else {
              rResults.push(String(Math.floor(Math.random() * (rMax - rMin + 1)) + rMin))
            }
          }
          const rv = rResults.length === 1 ? rResults[0] : rResults
          results.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify({ result: rv }) })
          replacePending(`\n\n>随机结果：${Array.isArray(rv) ? rv.join(', ') : rv}`)

        } else if (tc.function.name === 'generate_uuid') {
          const uuid = crypto.randomUUID()
          results.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify({ uuid }) })
          replacePending(`\n\n>生成的 UUID：${uuid}`)

        } else if (tc.function.name === 'fetch_page') {
          try {
            const resp = await fetch(args.url, { signal: AbortSignal.timeout(15000) })
            const text = await resp.text()
            const cleaned = text
              .replace(/<script[\s\S]*?<\/script>/gi, '')
              .replace(/<style[\s\S]*?<\/style>/gi, '')
              .replace(/<[^>]+>/g, '')
              .replace(/\s+/g, ' ')
              .trim()
              .slice(0, 5000)
            results.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify({ content: cleaned }) })
            replacePending(`\n\n>页面已获取（约 ${cleaned.length} 字）：${args.url}`)
          } catch (e: any) {
            const feMsg = (e as Error).message || ''
            const feErr = feMsg === 'Failed to fetch'
              ? '目标服务器不支持跨域访问（CORS），请尝试改用「联网搜索」中的 web_fetch 工具'
              : `直接获取失败：${feMsg}`
            results.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify({ error: feErr }) })
            replacePending(`\n\n>${feErr}`)
          }

        } else if (tc.function.name === 'web_fetch') {
          // web_fetch is only supported for local proxy
          if (isBocha) {
            results.push({
              role: 'tool',
              tool_call_id: tc.id,
              content: JSON.stringify({ error: '博查搜索不支持网页抓取，AI应根据搜索结果直接回答' }),
            })
            replacePending('\n\n>博查搜索不支持网页抓取')
          } else {
            const content = await searchService.fetchWebpage(
              args.url,
              searchStore.config.proxyUrl
            )
            results.push({
              role: 'tool',
              tool_call_id: tc.id,
              content: JSON.stringify({ content }),
            })
            replacePending(`\n\n>页面已获取（约 ${content.length} 字）：${args.url}`)
          }
        }
      } catch (e: any) {
        const raw = (e as Error).message || String(e)
        const toolName = tc.function.name
        let errMsg = raw
        if (raw === 'Failed to fetch' || raw.includes('Failed to fetch')) {
          errMsg = `工具「${toolName}」网络请求失败，请检查网络连接或目标服务器是否可用`
        } else if (raw.includes('AbortError') || raw.includes('aborted')) {
          errMsg = `工具「${toolName}」请求超时`
        }
        results.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: JSON.stringify({ error: errMsg }),
        })
        replacePending(`\n\n>${errMsg}`)
      }
    }
    return results
  }

  async function streamToolRound(
    originalMessages: any[],
    toolCalls: ToolCall[],
    toolResults: ToolResult[],
    controller: AbortController,
    options: ApiServiceOptions,
    consecutiveFailCount: { value: number }
  ) {
    // Build messages with tool calls and results
    const apiCfg = apiConfigStore.activeConfig
    if (!apiCfg) return

    const msgs = [
      ...originalMessages,
      {
        role: 'assistant',
        content: null,
        tool_calls: toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function' as const,
          function: { name: tc.function.name, arguments: tc.function.arguments },
        })),
      },
      ...toolResults,
    ]

    // Preserve tool execution status text that was appended to the message
    const existingPrefix = conversationStore.currentMessages[streamMsgIdx.value]?.content || ''
    const prefixStr = typeof existingPrefix === 'string' ? existingPrefix : ''

    // Preserve existing reasoning from prior rounds, append new reasoning with a blank line
    const existingReasoning = conversationStore.currentMessages[streamMsgIdx.value]?.reasoning_content || ''
    const reasoningPrefix = typeof existingReasoning === 'string' && existingReasoning ? existingReasoning + '\n\n' : ''

    try {
      await streamChat(
        { ...options, messages: msgs },
        {
          onContent: (text: string) => {
            // Prepend tool call status (e.g. "搜索完成…") to each content update,
            // with a blank line separator so AI response doesn't glue to the URL
            conversationStore.updateMessageContent(streamMsgIdx.value, prefixStr + '\n\n' + text)
          },
          onReasoning: (text: string) => {
            // Append to existing reasoning (don't overwrite previous rounds)
            conversationStore.updateMessageReasoning(streamMsgIdx.value, reasoningPrefix + text)
          },
          onToolCallChunk: (_i: number, _d: any) => {},
          onFinish: async (reason: string | null, nextToolCalls: ToolCall[]) => {
            if (reason === 'tool_calls' && nextToolCalls.length > 0) {
              const results = await executeToolCalls(nextToolCalls)
              const hasFailure = hasToolErrors(results)
              if (hasFailure) {
                consecutiveFailCount.value++
              } else {
                consecutiveFailCount.value = 0
              }
              if (consecutiveFailCount.value >= MAX_CONSECUTIVE_FAILURES) {
                const msg = conversationStore.currentMessages[streamMsgIdx.value]
                if (msg && typeof msg.content === 'string') {
                  msg.content += '\n\n> 工具连续多次失败，已自动停止'
                }
                return
              }
              await streamToolRound(msgs, nextToolCalls, results, controller, options, consecutiveFailCount)
            }
          },
          onError: (error: Error) => {
            ElMessage.error(error.message)
          },
        },
        controller.signal
      )
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        ElMessage.error(e.message || '搜索处理失败')
      }
    }
  }

  async function generateConversationTitleAsync(apiUrl: string, apiKey: string, model: string) {
    const conv = conversationStore.activeConversation
    if (!conv) return
    if (conv._aiTitle) return

    const firstUser = conversationStore.currentMessages.find((m) => m.role === 'user')
    const firstAssistant = conversationStore.currentMessages.find((m) => m.role === 'assistant' && m.content)
    if (!firstUser) return

    const userText = extractTextPartsSimple(firstUser.content)
    const assistantText = firstAssistant ? extractTextPartsSimple(firstAssistant.content) : ''

    const title = await generateTitle(apiUrl, apiKey, model, userText, assistantText)
    if (title && title.length <= 20 && title !== conv.title) {
      conv.title = title
      conv._aiTitle = true
      await conversationStore.saveConversations()
    }
  }

  function extractTextPartsSimple(content: any): string {
    if (!content) return ''
    if (typeof content === 'string') return content
    return content
      .filter((p: any) => p.type === 'text')
      .map((p: any) => p.text)
      .join(' ')
      .trim()
  }

  function stopStream() {
    if (abortController.value) {
      abortController.value.abort()
      abortController.value = null
    }
  }

  function hasToolErrors(results: ToolResult[]): boolean {
    return results.some((r) => {
      try {
        const parsed = JSON.parse(r.content)
        return !!parsed.error
      } catch {
        return false
      }
    })
  }

  return {
    sendMessage,
    stopStream,
    isStreaming,
  }
}

import { ref } from 'vue'
import { useConversationStore } from '@/stores/conversationStore'
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
    const text = userText !== undefined ? userText : configStore.params.systemPrompt // just placeholder

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

    // Build system prompt with search guidance
    const sys = replacePromptPlaceholders(configStore.params.systemPrompt)
    const isBocha = searchStore.config.provider === 'bocha'
    const searchEnabled = searchStore.config.enabled && (
      isBocha ? searchStore.config.bochaApiKey : searchStore.config.proxyUrl
    )
    let searchGuidance = ''
    if (searchEnabled) {
      if (isBocha) {
        searchGuidance = '\n\n【联网搜索能力】\n'
          + '你可以使用 web_search 工具搜索互联网获取最新信息。'
          + '搜索结果包含标题、URL、摘要、来源网站和发布时间。'
          + '根据搜索结果中的信息回答用户的问题，并引用相关来源。'
      } else {
        searchGuidance = '\n\n【联网搜索能力】\n'
          + '1. 你可以使用 web_search 搜索互联网获取最新信息。\n'
          + '2. 对于你知道的网站（如天气网站、财经网站等），可以直接用 web_fetch 获取内容，不必先搜索。\n'
          + '3. 如果搜索结果摘要中的信息不足，请用 web_fetch 打开最相关的链接获取完整内容。\n'
          + '4. 搜索结果同时来自多个搜索引擎，每个引擎的结果分开返回，请综合多个来源的信息给出更准确的回答。'
      }
    }

    // Build API messages
    const historyLimit = configStore.params.historyLimit || 20
    const msgsForApi: Array<{ role: string; content: any; tool_calls?: ToolCall[]; tool_call_id?: string }> = []

    if (sys) {
      msgsForApi.push({ role: 'system', content: sys + searchGuidance })
    } else if (searchGuidance) {
      msgsForApi.push({ role: 'system', content: searchGuidance })
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

    try {
      const options: ApiServiceOptions = {
        apiUrl: apiCfg.apiUrl,
        apiKey: apiCfg.apiKey,
        model: apiCfg.model,
        systemPrompt: sys,
        searchGuidance,
        messages: msgsForApi,
        temperature: configStore.params.temperature,
        maxTokens: configStore.params.maxTokens,
        topP: configStore.params.topP,
        frequencyPenalty: configStore.params.frequencyPenalty,
        presencePenalty: configStore.params.presencePenalty,
        reasoningEnabled: configStore.params.reasoningEnabled,
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
              // Execute tools and continue streaming
              const results = await executeToolCalls(toolCalls)
              // Append tool results to messages and continue
              await streamToolRound(msgsForApi, toolCalls, results, controller, options)
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
      try {
        const args = JSON.parse(tc.function.arguments)
        const msg = conversationStore.currentMessages[streamMsgIdx.value]
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
          if (msg) {
            const status = `\n\n> 搜索完成（${searchResults.length} 条结果）：${args.query}`
            msg.content = (msg.content || '') + status
          }
        } else if (tc.function.name === 'web_fetch') {
          // web_fetch is only supported for local proxy
          if (isBocha) {
            results.push({
              role: 'tool',
              tool_call_id: tc.id,
              content: JSON.stringify({ error: '博查搜索不支持网页抓取，AI应根据搜索结果直接回答' }),
            })
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
            if (msg) {
              const status = `\n\n> 页面已获取（约 ${content.length} 字）：${args.url}`
              msg.content = (msg.content || '') + status
            }
          }
        }
      } catch (e: any) {
        results.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: JSON.stringify({ error: e.message }),
        })
      }
    }
    return results
  }

  async function streamToolRound(
    originalMessages: any[],
    toolCalls: ToolCall[],
    toolResults: ToolResult[],
    controller: AbortController,
    options: ApiServiceOptions
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
              await streamToolRound(msgs, nextToolCalls, results, controller, options)
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

  return {
    sendMessage,
    stopStream,
    isStreaming,
  }
}

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import * as db from '@/services/dbService'
import { CONV_KEY, ACTIVE_KEY, COLLAPSE_LENGTH } from '@/utils/constants'
import type { Conversation, Message, PendingFile } from '@/types'
import { genId, getNow } from '@/utils/id'
import { extractTextParts } from '@/utils/formatContent'

// Index used by MessageList for the system prompt message (not in currentMessages)
export const SYSTEM_PROMPT_INDEX = -1

export const useConversationStore = defineStore('conversation', () => {
  const conversations = ref<Conversation[]>([])
  const activeConvId = ref<string | null>(null)
  const currentMessages = ref<Message[]>([])
  const isStreaming = ref(false)
  const pendingFiles = ref<PendingFile[]>([])
  const editingMsgIdx = ref(-1)
  const msgCounter = ref(0)

  const activeConversation = computed(() =>
    conversations.value.find((c) => c.id === activeConvId.value) || null
  )

  const hasActiveConv = computed(() => !!activeConvId.value)

  const sortedConversations = computed(() =>
    [...conversations.value].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )
  )

  const convCount = computed(() => conversations.value.length)

  const convTitle = computed(() => {
    const c = activeConversation.value
    if (!c) return '新对话'
    if (c.title && c.title !== '新对话') return c.title
    const firstUser = currentMessages.value.find((m) => m.role === 'user')
    if (firstUser) {
      const t = extractTextParts(firstUser.content)
      if (t) return t.length > 40 ? t.slice(0, 40) + '...' : t
    }
    return '新对话'
  })

  const expandedMessages = ref<Set<number>>(new Set())
  const systemPromptExpanded = ref(false)

  function isMessageCollapsed(msgIdx: number): boolean {
    // System prompt (index -1) uses its own flag
    if (msgIdx === SYSTEM_PROMPT_INDEX) {
      return !systemPromptExpanded.value
    }
    const msg = currentMessages.value[msgIdx]
    if (!msg) return false
    const text = typeof msg.content === 'string' ? msg.content : extractTextParts(msg.content)
    if (text.length <= COLLAPSE_LENGTH) return false
    return !expandedMessages.value.has(msgIdx)
  }

  function toggleMessageCollapse(msgIdx: number) {
    if (msgIdx === SYSTEM_PROMPT_INDEX) {
      systemPromptExpanded.value = !systemPromptExpanded.value
      return
    }
    if (expandedMessages.value.has(msgIdx)) {
      expandedMessages.value.delete(msgIdx)
    } else {
      expandedMessages.value.add(msgIdx)
    }
    // Trigger reactivity by creating a new Set
    expandedMessages.value = new Set(expandedMessages.value)
  }

  // --- Data persistence ---

  async function loadConversations() {
    const raw = await db.getItem(CONV_KEY)
    if (raw) {
      try {
        conversations.value = JSON.parse(raw)
      } catch {}
    }
  }

  async function saveConversations() {
    await db.setItem(CONV_KEY, JSON.stringify(conversations.value))
  }

  async function loadActiveId() {
    const id = await db.getItem(ACTIVE_KEY)
    if (id) {
      activeConvId.value = id
      // Load messages for this conversation
      const conv = conversations.value.find((c) => c.id === id)
      if (conv) {
        currentMessages.value = conv.messages || []
        if (conv.systemPrompt) {
          // System prompt is handled by configStore
        }
      }
    }
  }

  async function saveActiveId() {
    if (activeConvId.value) {
      await db.setItem(ACTIVE_KEY, activeConvId.value)
    } else {
      await db.removeItem(ACTIVE_KEY)
    }
  }

  function saveCurrentConversation(updateTime = true) {
    if (!activeConvId.value) return
    const conv = conversations.value.find((c) => c.id === activeConvId.value)
    if (!conv) return
    conv.messages = currentMessages.value
    if (updateTime) conv.updatedAt = getNow()

    // Auto-title based on first user message
    if (conv.title === '新对话') {
      const firstUser = currentMessages.value.find((m) => m.role === 'user')
      if (firstUser) {
        const t = extractTextParts(firstUser.content)
        if (t) {
          conv.title = t.length > 15 ? t.slice(0, 15) + '…' : t
          conv._aiTitle = false
        }
      }
    }

    saveConversations()
  }

  // --- Conversation CRUD ---

  async function newConversation(): Promise<string> {
    const conv: Conversation = {
      id: genId(),
      title: '新对话',
      messages: [],
      createdAt: getNow(),
      updatedAt: getNow(),
    }
    conversations.value.push(conv)
    activeConvId.value = conv.id
    currentMessages.value = []
    msgCounter.value = 0
    expandedMessages.value = new Set()
    editingMsgIdx.value = -1
    pendingFiles.value = []
    await saveConversations()
    await saveActiveId()
    return conv.id
  }

  async function switchConversation(id: string) {
    // Save current if active (without bumping its timestamp)
    if (activeConvId.value) {
      saveCurrentConversation(false)
    }
    const conv = conversations.value.find((c) => c.id === id)
    if (conv) {
      activeConvId.value = id
      currentMessages.value = conv.messages || []
      msgCounter.value = 0
      expandedMessages.value = new Set()
      editingMsgIdx.value = -1
      pendingFiles.value = []
      await saveActiveId()
    }
  }

  async function deleteConversation(id: string) {
    conversations.value = conversations.value.filter((c) => c.id !== id)
    if (activeConvId.value === id) {
      activeConvId.value = conversations.value[0]?.id || null
      if (activeConvId.value) {
        const conv = conversations.value.find((c) => c.id === activeConvId.value)
        currentMessages.value = conv?.messages || []
      } else {
        currentMessages.value = []
      }
      msgCounter.value = 0
      expandedMessages.value = new Set()
      await saveActiveId()
    }
    await saveConversations()
  }

  async function clearAllConversations() {
    conversations.value = []
    activeConvId.value = null
    currentMessages.value = []
    msgCounter.value = 0
    expandedMessages.value = new Set()
    await saveConversations()
    await saveActiveId()
  }

  async function renameConversation(title: string) {
    const conv = activeConversation.value
    if (!conv) return
    conv.title = title || '新对话'
    conv._aiTitle = true
    conv.updatedAt = getNow()
    await saveConversations()
  }

  // --- Message operations ---

  function addMessage(msg: Message) {
    currentMessages.value.push(msg)
  }

  function pushUserMessage(content: Message['content']): number {
    const msg: Message = { role: 'user', content }
    currentMessages.value.push(msg)
    return currentMessages.value.length - 1
  }

  function pushAssistantMessage(index?: number): number {
    const msg: Message = {
      role: 'assistant',
      content: '',
      reasoning_content: '',
    }
    if (index !== undefined) {
      currentMessages.value.splice(index, 0, msg)
      return index
    }
    currentMessages.value.push(msg)
    return currentMessages.value.length - 1
  }

  function removeMessage(index: number) {
    if (index >= 0 && index < currentMessages.value.length) {
      currentMessages.value.splice(index, 1)
    }
  }

  function updateMessageContent(index: number, content: string) {
    if (index >= 0 && index < currentMessages.value.length) {
      currentMessages.value[index].content = content
    }
  }

  function updateMessageReasoning(index: number, reasoning: string) {
    if (index >= 0 && index < currentMessages.value.length) {
      currentMessages.value[index].reasoning_content = reasoning
    }
  }

  function editMessage(idx: number) {
    editingMsgIdx.value = idx
  }

  function cancelEdit() {
    editingMsgIdx.value = -1
  }

  function cutMessagesForApi(historyLimit: number) {
    const msgs = currentMessages.value.slice()
    // Build the message array for API: exclude system/system-msg roles,
    // exclude empty assistant placeholders (no content AND no tool_calls),
    // exclude assistant messages that are tool_call-only (no visible content)
    const filtered = msgs.filter((m) => {
      if (m.role === 'system') return false
      if (m.role === 'system-msg') return false
      if (m.role === 'tool') return true
      // Skip empty assistant placeholders (from streaming)
      if (m.role === 'assistant' && !m.content && !m.tool_calls) return false
      // Skip tool_call-only assistant messages with no visible content
      if (m.role === 'assistant' && m.tool_calls && !m.content) return false
      return true
    })
    if (historyLimit > 0) {
      return filtered.slice(-historyLimit * 2)
    }
    return filtered
  }

  return {
    conversations,
    activeConvId,
    currentMessages,
    isStreaming,
    pendingFiles,
    editingMsgIdx,
    msgCounter,
    expandedMessages,
    activeConversation,
    hasActiveConv,
    sortedConversations,
    convCount,
    convTitle,
    isMessageCollapsed,
    toggleMessageCollapse,
    loadConversations,
    saveConversations,
    loadActiveId,
    saveActiveId,
    saveCurrentConversation,
    newConversation,
    switchConversation,
    deleteConversation,
    clearAllConversations,
    renameConversation,
    addMessage,
    pushUserMessage,
    pushAssistantMessage,
    removeMessage,
    updateMessageContent,
    updateMessageReasoning,
    editMessage,
    cancelEdit,
    cutMessagesForApi,
  }
})

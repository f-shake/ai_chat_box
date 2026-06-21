<template>
  <div ref="containerRef" class="message-list" @scroll="handleScroll">
    <!-- System prompt (rendered via MessageBubble so it gets collapse) -->
    <MessageBubble
      v-if="systemPrompt"
      :message="systemPromptMessage"
      :is-streaming="false"
      :msg-index="SYSTEM_PROMPT_INDEX"
      :preset-name="systemPromptPresetName"
    />

    <!-- Messages -->
    <MessageBubble
      v-for="(msg, idx) in visibleMessages"
      :key="'msg-' + idx"
      :message="msg"
      :is-streaming="isStreaming && idx === messages.length - 1"
      :msg-index="idx"
      @edit="handleEdit"
      @regenerate="handleRegenerate"
    />

    <!-- Empty state -->
    <EmptyState v-if="messages.length === 0 && !systemPrompt" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useConversationStore, SYSTEM_PROMPT_INDEX } from '@/stores/conversationStore'
import { useConfigStore } from '@/stores/configStore'
import { usePromptStore } from '@/stores/promptStore'
import type { Message } from '@/types'
import MessageBubble from './MessageBubble.vue'
import EmptyState from './EmptyState.vue'

const emit = defineEmits<{
  edit: [index: number]
  regenerate: []
}>()

const conversationStore = useConversationStore()
const configStore = useConfigStore()
const promptStore = usePromptStore()

const containerRef = ref<HTMLElement | null>(null)
const userScrolledAway = ref(false)
let scrollRaf = 0

const messages = computed(() => conversationStore.currentMessages)
const isStreaming = computed(() => conversationStore.isStreaming)

const systemPrompt = computed(() => configStore.params.systemPrompt)

const systemPromptPresetName = computed(() => {
  const sp = systemPrompt.value
  if (!sp) return ''
  const match = promptStore.allPrompts.find((p) => p.config?.systemPrompt === sp)
  return match ? match.title : ''
})

const systemPromptMessage = computed<Message>(() => ({
  role: 'system-prompt',
  content: systemPrompt.value,
}))

// Filter out tool-only messages that shouldn't be displayed
const visibleMessages = computed(() => {
  return messages.value.filter((m, idx) => {
    if (m.role === 'tool') return false
    if (m.role === 'assistant' && m.tool_calls && !m.content) return false
    return true
  })
})

// Auto-scroll — use requestAnimationFrame so scroll runs AFTER
// the browser has laid out the newly rendered content.
// Double-rAF catches async rendering (marked.parse, KaTeX, image loads).
watch(
  () => messages.value.length,
  () => {
    if (!userScrolledAway.value) scrollToBottom()
  }
)

watch(
  () => {
    const lastMsg = messages.value[messages.value.length - 1]
    return lastMsg?.content
  },
  () => {
    if (!userScrolledAway.value) scrollToBottom()
  }
)

// Final scroll when streaming ends, in case the last async render
// came in after the content watch fired.
watch(isStreaming, (now, was) => {
  if (was && !now) scrollToBottom()
})

function handleScroll() {
  const el = containerRef.value
  if (!el) return
  const threshold = 60
  const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold
  userScrolledAway.value = !atBottom
}

function scrollToBottom() {
  cancelAnimationFrame(scrollRaf)
  scrollRaf = requestAnimationFrame(() => {
    const el = containerRef.value
    if (el) {
      el.scrollTop = el.scrollHeight
    }
    // Second pass catches async rendering that completed after the first rAF
    scrollRaf = requestAnimationFrame(() => {
      if (el) {
        el.scrollTop = el.scrollHeight
      }
    })
  })
}

function handleEdit(idx: number) {
  emit('edit', idx)
}

function handleRegenerate() {
  emit('regenerate')
}
</script>

<style scoped>
.message-list {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}
</style>

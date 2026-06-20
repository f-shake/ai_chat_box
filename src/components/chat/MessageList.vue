<template>
  <div ref="containerRef" class="message-list" @scroll="handleScroll">
    <!-- System prompt (rendered via MessageBubble so it gets collapse) -->
    <MessageBubble
      v-if="systemPrompt"
      :message="systemPromptMessage"
      :is-streaming="false"
      :msg-index="SYSTEM_PROMPT_INDEX"
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
import { ref, computed, watch, nextTick } from 'vue'
import { useConversationStore, SYSTEM_PROMPT_INDEX } from '@/stores/conversationStore'
import { useConfigStore } from '@/stores/configStore'
import type { Message } from '@/types'
import MessageBubble from './MessageBubble.vue'
import EmptyState from './EmptyState.vue'

const emit = defineEmits<{
  edit: [index: number]
  regenerate: []
}>()

const conversationStore = useConversationStore()
const configStore = useConfigStore()

const containerRef = ref<HTMLElement | null>(null)
const userScrolledAway = ref(false)

const messages = computed(() => conversationStore.currentMessages)
const isStreaming = computed(() => conversationStore.isStreaming)

const systemPrompt = computed(() => configStore.params.systemPrompt)

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

// Auto-scroll
watch(
  () => messages.value.length,
  () => {
    if (!userScrolledAway.value) {
      nextTick(() => scrollToBottom())
    }
  }
)

watch(
  () => {
    const lastMsg = messages.value[messages.value.length - 1]
    return lastMsg?.content
  },
  () => {
    if (!userScrolledAway.value) {
      nextTick(() => scrollToBottom())
    }
  }
)

function handleScroll() {
  const el = containerRef.value
  if (!el) return
  const threshold = 60
  const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold
  userScrolledAway.value = !atBottom
}

function scrollToBottom() {
  const el = containerRef.value
  if (el) {
    el.scrollTop = el.scrollHeight
  }
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

<template>
  <div class="chat-area">
    <MessageList
      @edit="handleEdit"
      @regenerate="handleRegenerate"
    />

    <ChatInput @send="handleSend" @stop="handleStop" />
  </div>
</template>

<script setup lang="ts">
import { useConversationStore } from '@/stores/conversationStore'
import { useStreamChat } from '@/composables/useStreamChat'
import MessageList from './MessageList.vue'
import ChatInput from './ChatInput.vue'

const conversationStore = useConversationStore()
const { sendMessage, stopStream } = useStreamChat()

function handleSend(text?: string) {
  sendMessage(text)
}

function handleStop() {
  stopStream()
}

function handleEdit(idx: number) {
  conversationStore.editMessage(idx)
  // Restore message content to input
  const msg = conversationStore.currentMessages[idx]
  if (msg) {
    const content = typeof msg.content === 'string' ? msg.content : ''
    // The input text is set - we need to access it differently
    // For now, we set editing state and the ChatInput shows the edit indicator
  }
}

async function handleRegenerate() {
  const msgs = conversationStore.currentMessages
  if (msgs.length < 2) return
  const lastAssistant = msgs[msgs.length - 1]
  if (lastAssistant.role !== 'assistant') return
  conversationStore.removeMessage(msgs.length - 1)
  const lastUserIdx = msgs.length - 1
  const lastUser = msgs[lastUserIdx]
  if (lastUser.role !== 'user') return
  const content = typeof lastUser.content === 'string' ? lastUser.content : ''
  // Use edit mechanism: splice old user message, push new one, then stream
  conversationStore.editingMsgIdx = lastUserIdx
  sendMessage(content)
}
</script>

<style scoped>
.chat-area {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-primary);
}
</style>

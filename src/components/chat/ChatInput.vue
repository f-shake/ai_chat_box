<template>
  <div class="chat-input-area">
    <ChatInputOptions />

    <FilePreviewStrip />

    <div class="input-row">
      <el-button
        class="new-chat-btn"
        size="default"
        text
        title="新建对话"
        :disabled="isNewConvRedundant"
        @click="newConversation"
      >
        <el-icon><Plus /></el-icon>
      </el-button>

      <el-input
        ref="inputRef"
        v-model="inputText"
        type="textarea"
        :rows="1"
        :disabled="disabled"
        placeholder="Enter发送，Shift+Enter换行"
        :autosize="{ minRows: 1, maxRows: 6 }"
        @keydown="handleKeyDown"
        @paste="handlePaste"
        class="chat-textarea"
      />

      <el-button
        v-if="!conversationStore.isStreaming"
        type="primary"
        :disabled="disabled || (!inputText.trim() && conversationStore.pendingFiles.length === 0)"
        @click="doSend"
        title="发送 (Enter)"
        style="width: 40px;"
      >
        <el-icon :size="18"><Promotion /></el-icon>
      </el-button>
      <el-button
        v-else
        type="danger"
        @click="emit('stop')"
        title="停止生成"
        style="width: 40px;"
      >
        <el-icon :size="18"><Close /></el-icon>
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useConversationStore } from '@/stores/conversationStore'
import { useConfigStore } from '@/stores/configStore'
import { useStreamChat } from '@/composables/useStreamChat'
import { useFileHandler } from '@/composables/useFileHandler'
import { DEFAULT_CONFIG_PARAMS } from '@/utils/constants'
import { ElInput } from 'element-plus'
import { Plus, Promotion, Close } from '@element-plus/icons-vue'
import ChatInputOptions from './ChatInputOptions.vue'
import FilePreviewStrip from './FilePreviewStrip.vue'

const emit = defineEmits<{
  send: [text?: string]
  stop: []
}>()

const conversationStore = useConversationStore()
const configStore = useConfigStore()
const { sendMessage } = useStreamChat()

const inputRef = ref<InstanceType<typeof ElInput> | null>(null)
const inputText = ref('')

// Disable "new conversation" button when already at an empty default conversation
const isNewConvRedundant = computed(() => {
  if (!conversationStore.activeConvId) return false
  if (conversationStore.currentMessages.length > 0) return false
  if (configStore.params.systemPrompt !== DEFAULT_CONFIG_PARAMS.systemPrompt) return false
  return true
})

const disabled = computed(() => {
  // Disabled when no active API config
  return false
})

function doSend() {
  const text = inputText.value.trim()
  if (!text && conversationStore.pendingFiles.length === 0) return
  if (conversationStore.isStreaming) return

  emit('send', text || undefined)
  inputText.value = ''
}

function handleKeyDown(e: Event) {
  const ke = e as KeyboardEvent
  if (ke.key === 'Enter' && !ke.shiftKey) {
    ke.preventDefault()
    doSend()
  }
  if (ke.key === 'Escape') {
    if (conversationStore.editingMsgIdx >= 0) {
      conversationStore.cancelEdit()
    }
  }
}

async function handlePaste(e: ClipboardEvent) {
  const items = e.clipboardData?.items
  if (!items) return
  const imageFiles: File[] = []
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile()
      if (file) imageFiles.push(file)
    }
  }
  if (imageFiles.length > 0) {
    e.preventDefault()
    const { readFileAsContent } = useFileHandler()
    for (const file of imageFiles) {
      try {
        const pending = await readFileAsContent(file)
        conversationStore.pendingFiles.push(pending)
      } catch {}
    }
  }
}

async function newConversation() {
  if (isNewConvRedundant.value) return
  await conversationStore.newConversation()
}

</script>

<style scoped>
.chat-input-area {
  padding: 8px 16px 12px;
  border-top: 1px solid var(--border-color);
  background: var(--bg-primary);
}

.input-row {
  display: flex;
  align-items: flex-end;
  gap: 8px;
}

.new-chat-btn {
  flex-shrink: 0;
  margin-bottom: 2px;
}

.chat-textarea {
  flex: 1;
}

.chat-textarea :deep(.el-textarea__inner) {
  min-height: 40px;
  border-radius: 8px;
  resize: none;
}
</style>

<template>
  <div
    :class="['message', message.role, { streaming: isStreaming }]"
    @mouseenter="showActions = true"
    @mouseleave="showActions = false"
  >
    <!-- User / System-prompt: bubble style, right-aligned -->
    <template v-if="message.role === 'user' || message.role === 'system-prompt'">
      <div class="bubble">
        <div v-if="message.role === 'system-prompt'" class="bubble-label">系统提示词</div>
        <!-- System prompt: hide content entirely when collapsed -->
        <template v-if="message.role === 'system-prompt' && isCollapsed">
          <!-- collapsed: only show the label above, no content -->
        </template>
        <template v-else>
          <div v-if="isStreaming && !message.content" class="typing-indicator">
            <span></span><span></span><span></span>
          </div>
          <div v-else-if="renderedHtml" :class="['msg-body', { collapsed: isCollapsed && message.role !== 'system-prompt' }]" v-html="renderedHtml"></div>
        </template>

        <div class="bubble-footer">
          <button v-if="canCollapse" class="collapse-toggle" @click="toggleCollapse">
            {{ isCollapsed ? '展开 ▾' : '收起 ▴' }}
          </button>
          <span class="timestamp">{{ timestamp }}</span>
          <span v-if="showActions || !isStreaming" class="msg-actions">
            <el-button size="small" text title="复制" @click="copyMessage">
              <el-icon><CopyDocument /></el-icon>
            </el-button>
            <el-button
              v-if="message.role === 'user' && msgIndex >= 0"
              size="small" text title="编辑" @click="editMsg"
            >
              <el-icon><Edit /></el-icon>
            </el-button>
          </span>
        </div>
      </div>
    </template>

    <!-- Assistant: full width, no bubble -->
    <template v-else-if="message.role === 'assistant'">
      <div class="assistant-block">
        <ReasoningBlock
          v-if="message.reasoning_content"
          :reasoning="message.reasoning_content"
          :auto-open="isStreaming"
        />
        <div v-if="isStreaming && !message.content" class="typing-indicator">
          <span></span><span></span><span></span>
        </div>
        <div v-else-if="renderedHtml" class="msg-body" v-html="renderedHtml"></div>
        <div class="msg-footer">
          <span class="timestamp">{{ timestamp }}</span>
          <span v-if="showActions || !isStreaming" class="msg-actions">
            <el-dropdown trigger="click" @command="handleCopyCommand">
              <el-button size="small" text title="复制">
                <el-icon><CopyDocument /></el-icon>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item v-if="hasReasoning" command="thinking">复制思考内容</el-dropdown-item>
                  <el-dropdown-item command="markdown">复制原始回复内容</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
            <el-button v-if="!isStreaming" size="small" text title="重新生成" @click="emit('regenerate')">
              <el-icon><Refresh /></el-icon>
            </el-button>
          </span>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { formatContent } from '@/utils/formatContent'
import { useClipboard } from '@/composables/useClipboard'
import { useConversationStore } from '@/stores/conversationStore'
import { COLLAPSE_LENGTH } from '@/utils/constants'
import type { Message, MessageContent } from '@/types'
import { CopyDocument, Edit, Refresh } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import ReasoningBlock from './ReasoningBlock.vue'

const props = defineProps<{
  message: Message
  isStreaming: boolean
  msgIndex: number
}>()

const emit = defineEmits<{
  edit: [index: number]
  regenerate: []
}>()

const conversationStore = useConversationStore()
const { copyRich, copyPlain, getPlainTextFromElement } = useClipboard()
const showActions = ref(false)

// Collapse for user / system-prompt messages (not assistant)
const canCollapse = computed(() => {
  if (props.isStreaming) return false
  if (props.message.role === 'assistant') return false
  const text = typeof props.message.content === 'string' ? props.message.content : ''
  return text.length > COLLAPSE_LENGTH
})

const isCollapsed = computed(() => {
  if (!canCollapse.value) return false
  return conversationStore.isMessageCollapsed(props.msgIndex)
})

function toggleCollapse() {
  conversationStore.toggleMessageCollapse(props.msgIndex)
}

const renderedHtml = ref('')

watch(
  () => props.message.content,
  async (val) => {
    renderedHtml.value = await renderMessageContent(val)
  },
  { immediate: true }
)

async function renderMessageContent(content: MessageContent): Promise<string> {
  if (!content) return ''
  if (typeof content === 'string') return (await formatContent(content)) || ''

  let html = ''
  for (let i = 0; i < content.length; i++) {
    const part = content[i]
    if (part.type === 'text' && part.text.trim()) {
      html += (await formatContent(part.text)) || ''
    } else if (part.type === 'file') {
      const size = formatFileSize(part.file.size)
      const fileContent = part.file.content || ''
      const isLong = fileContent.length > 5000
      const displayContent = escapeHtml(isLong ? fileContent.slice(0, 5000) + '\n… (内容已截断)' : fileContent)
      html += `<div class="msg-file"><span class="msg-file-icon">${part.file.name.split('.').pop()?.toUpperCase() || 'FILE'}</span><span class="msg-file-info"><span class="msg-file-name">${escapeHtml(part.file.name)}</span><span class="msg-file-size">${size}</span></span></div><div class="msg-file-content">${escapeHtml(displayContent)}</div>`
    } else if (part.type === 'image_url') {
      html += `<div class="msg-image"><img src="${escapeHtml(part.image_url.url)}" alt="图片" loading="lazy"></div>`
    }
  }
  return html
}

const timestamp = computed(() => new Date().toLocaleTimeString())
const hasReasoning = computed(() => props.message.reasoning_content?.trim()?.length > 0)

async function copyMessage() {
  const text = typeof props.message.content === 'string' ? props.message.content : ''
  const html = renderedHtml.value
  await copyRich(text, html)
  ElMessage.success('已复制')
}

async function copyThinkingContent() {
  const text = props.message.reasoning_content || ''
  if (text) {
    await copyPlain(text)
    ElMessage.success('已复制思考内容')
  }
}

async function copyRawMarkdown() {
  const text = typeof props.message.content === 'string' ? props.message.content : JSON.stringify(props.message.content)
  await copyPlain(text)
  ElMessage.success('已复制原始内容')
}

async function handleCopyCommand(command: string) {
  switch (command) {
    case 'thinking': await copyThinkingContent(); break
    case 'markdown': await copyRawMarkdown(); break
    default: await copyMessage(); break
  }
}

function editMsg() {
  emit('edit', props.msgIndex)
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function escapeHtml(str: string): string {
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}
</script>

<style scoped>
.message {
  display: flex;
  margin-bottom: var(--chat-msg-gap);
  animation: message-fade-in 0.2s ease;
}

/* User: right-aligned, blue bubble */
.message.user {
  justify-content: flex-end;
}
.message.user .bubble {
  max-width: 75%;
  padding: 10px 14px;
  border-radius: 12px;
  border-bottom-right-radius: 4px;
  background: var(--user-bubble-bg);
  color: var(--user-bubble-text);
  position: relative;
  word-break: break-word;
  line-height: var(--chat-line-height);
}

/* System-prompt: right-aligned, gray bubble */
.message.system-prompt {
  justify-content: flex-end;
}
.message.system-prompt .bubble {
  max-width: 75%;
  padding: 10px 14px;
  border-radius: 12px;
  border-bottom-right-radius: 4px;
  background: var(--system-bubble-bg);
  color: var(--system-bubble-text);
  position: relative;
  word-break: break-word;
  line-height: var(--chat-line-height);
}

/* Assistant: full width */
.message.assistant {
  justify-content: flex-start;
}
.assistant-block {
  width: 100%;
  min-width: 0;
  padding: 4px 16px;
  line-height: var(--chat-line-height);
}

.bubble-label {
  font-size: 11px;
  color: var(--text-tertiary);
  margin-bottom: 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.bubble-footer,
.msg-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
  font-size: 11px;
  color: var(--text-tertiary);
}

.timestamp {
  white-space: nowrap;
}

.msg-actions {
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.15s;
  margin-left: auto;
}

.message:hover .msg-actions {
  opacity: 1;
}

@keyframes message-fade-in {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

.message.system-msg {
  justify-content: center;
}

/* Typing indicator */
.typing-indicator {
  display: flex;
  gap: 4px;
  padding: 4px 0;
  align-items: center;
}
.typing-indicator span {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--text-tertiary);
  animation: typing-bounce 1.4s ease-in-out infinite;
}
.typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
.typing-indicator span:nth-child(3) { animation-delay: 0.4s; }

@keyframes typing-bounce {
  0%, 60%, 100% { transform: translateY(0); }
  30% { transform: translateY(-6px); }
}
</style>

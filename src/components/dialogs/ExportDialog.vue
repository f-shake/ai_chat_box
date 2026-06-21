<template>
  <el-dialog v-model="visible" title="导出数据" width="90%" style="max-width: 500px">
    <div class="export-section">
      <el-checkbox v-model="exportPrompts">预设提示词</el-checkbox>
      <el-checkbox v-model="exportApiConfigs">API 配置</el-checkbox>
      <el-checkbox v-model="exportConversations">对话记录</el-checkbox>
    </div>
    <el-divider />
    <div class="export-section">
      <label class="export-label">导出格式</label>
      <el-radio-group v-model="exportFormat">
        <el-radio value="json">JSON</el-radio>
        <el-radio value="csv">CSV（仅当前对话）</el-radio>
      </el-radio-group>
    </div>
    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" @click="doExport" :disabled="!hasSelection">导出</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { usePromptStore } from '@/stores/promptStore'
import { useApiConfigStore } from '@/stores/apiConfigStore'
import { useConversationStore } from '@/stores/conversationStore'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const promptStore = usePromptStore()
const apiConfigStore = useApiConfigStore()
const conversationStore = useConversationStore()

const visible = ref(props.modelValue)
watch(() => props.modelValue, (v) => { visible.value = v })
watch(visible, (v) => emit('update:modelValue', v))

const exportPrompts = ref(true)
const exportApiConfigs = ref(true)
const exportConversations = ref(false)
const exportFormat = ref('json')

const hasSelection = computed(() => exportPrompts.value || exportApiConfigs.value || exportConversations.value)

function doExport() {
  const data: Record<string, any> = {
    exportedAt: new Date().toISOString(),
    version: 2,
  }

  if (exportFormat.value === 'json') {
    if (exportPrompts.value) {
      data.prompts = promptStore.userPrompts
      data.groups = promptStore.groups
    }
    if (exportApiConfigs.value) {
      data.apiConfigs = apiConfigStore.configs
    }
    if (exportConversations.value) {
      data.conversations = conversationStore.conversations
    }
    downloadJSON(data, 'ai-chat-export.json')
  } else {
    // CSV export of current conversation
    const conv = conversationStore.activeConversation
    if (!conv) {
      ElMessage.warning('没有活跃对话')
      return
    }
    let csv = '﻿' // BOM for Chinese
    csv += '角色,内容,时间\n'
    for (const m of conv.messages) {
      if (m.role === 'tool' || (m.role === 'assistant' && m.tool_calls && !m.content)) continue
      const content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
      csv += `${m.role},"${content.replace(/"/g, '""')}","${conv.updatedAt}"\n`
    }
    downloadText(csv, `${conv.title || '对话'}.csv`, 'text/csv;charset=utf-8')
  }

  visible.value = false
  ElMessage.success('导出成功')
}

function downloadJSON(data: any, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function downloadText(text: string, filename: string, mime: string) {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<style scoped>
.export-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.export-label {
  font-size: 13px;
  color: var(--text-primary);
  font-weight: 500;
}
</style>

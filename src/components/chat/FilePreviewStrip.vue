<template>
  <div v-if="conversationStore.pendingFiles.length > 0" class="file-preview-strip">
    <div
      v-for="file in conversationStore.pendingFiles"
      :key="file.id"
      class="file-preview-card"
    >
      <span class="file-icon">{{ getFileEmoji(file.name) }}</span>
      <span class="file-name">{{ file.name }}</span>
      <el-button size="small" circle text @click="removeFile(file.id)">
        <el-icon><Close /></el-icon>
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useConversationStore } from '@/stores/conversationStore'
import { getFileIcon } from '@/utils/escape'
import { Close } from '@element-plus/icons-vue'

const conversationStore = useConversationStore()

function getFileEmoji(name: string): string {
  return getFileIcon(name)
}

function removeFile(id: string) {
  conversationStore.pendingFiles = conversationStore.pendingFiles.filter((f) => f.id !== id)
}
</script>

<style scoped>
.file-preview-strip {
  display: flex;
  gap: 8px;
  padding: 4px 0;
  overflow-x: auto;
  flex-wrap: nowrap;
}

.file-preview-card {
  display: flex;
  align-items: center;
  gap: 4px;
  background: var(--bg-tertiary);
  border-radius: 6px;
  padding: 3px 6px;
  font-size: 12px;
  white-space: nowrap;
  flex-shrink: 0;
}

.file-icon {
  font-size: 14px;
}

.file-name {
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-primary);
}
</style>

<template>
  <div class="history-sidebar">
    <div class="history-header">
      <h3>对话历史</h3>
      <el-button size="small" text @click="handleClearAll">清空全部</el-button>
    </div>

    <el-scrollbar class="history-list">
      <div v-if="conversationStore.convCount === 0" class="history-empty">
        暂无对话记录<br>发送消息后自动创建
      </div>
      <div
        v-for="conv in conversationStore.sortedConversations"
        :key="conv.id"
        :class="['history-item', { active: conv.id === conversationStore.activeConvId }]"
        @click="switchConv(conv.id)"
      >
        <div class="history-item-title">{{ conv.title }}</div>
        <div class="history-item-meta">
          <span>{{ formatTime(conv.updatedAt) }}</span>
          <span class="history-item-actions">
            <el-button size="small" text @click.stop="handleRename(conv)">
              <el-icon><Edit /></el-icon>
            </el-button>
            <el-button size="small" text @click.stop="handleDelete(conv)">
              <el-icon><Close /></el-icon>
            </el-button>
          </span>
        </div>
      </div>
    </el-scrollbar>

    <div class="history-footer">
      共 {{ conversationStore.convCount }} 个对话
    </div>
  </div>
</template>

<script setup lang="ts">
import { useUiStore } from '@/stores/uiStore'
import { useConversationStore } from '@/stores/conversationStore'
import type { Conversation } from '@/types'
import { ElMessageBox } from 'element-plus'

const uiStore = useUiStore()
const conversationStore = useConversationStore()

function switchConv(id: string) {
  conversationStore.switchConversation(id)
  // Only close sidebar on mobile (desktop keeps it open unless hamburger button is clicked)
  if (window.innerWidth < 768) {
    uiStore.closeHistory()
  }
}

function formatTime(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  if (isToday) return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  // Format: MM-DD HH:mm
  const MM = String(d.getMonth() + 1).padStart(2, '0')
  const DD = String(d.getDate()).padStart(2, '0')
  const HH = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${MM}-${DD} ${HH}:${mm}`
}

function handleRename(conv: Conversation) {
  ElMessageBox.prompt('重命名对话', '重命名', {
    inputValue: conv.title,
    confirmButtonText: '确定',
    cancelButtonText: '取消',
  }).then(({ value }) => {
    if (value) {
      conversationStore.renameConversation(value)
    }
  }).catch(() => {})
}

function handleDelete(conv: Conversation) {
  ElMessageBox.confirm('确定要删除此对话吗？', '删除对话', {
    confirmButtonText: '删除',
    cancelButtonText: '取消',
    type: 'warning',
  }).then(() => {
    conversationStore.deleteConversation(conv.id)
  }).catch(() => {})
}

function handleClearAll() {
  ElMessageBox.confirm('确定要清空所有对话吗？此操作不可撤销。', '清空对话', {
    confirmButtonText: '清空',
    cancelButtonText: '取消',
    type: 'warning',
  }).then(() => {
    conversationStore.clearAllConversations()
  }).catch(() => {})
}
</script>

<style scoped>
.history-sidebar {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.history-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  border-bottom: 1px solid var(--border-color);
}

.history-header h3 {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.history-list {
  flex: 1;
  padding: 4px 8px;
}

.history-empty {
  text-align: center;
  padding: 40px 16px;
  color: var(--text-tertiary);
  font-size: 13px;
  line-height: 1.8;
}

.history-item {
  padding: 5px 12px;
  border-radius: 6px;
  cursor: pointer;
  margin-bottom: 1px;
  transition: background 0.15s;

  &:hover {
    background: var(--bg-tertiary);
  }

  &.active {
    background: var(--el-color-primary-light-9);
  }
}

.history-item-title {
  font-size: 13px;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.4;
}

.history-item-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 11px;
  color: var(--text-tertiary);
  line-height: 1.3;
}

.history-item-actions {
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.15s;
}

.history-item:hover .history-item-actions {
  opacity: 1;
}

.history-footer {
  padding: 8px 16px;
  border-top: 1px solid var(--border-color);
  font-size: 11px;
  color: var(--text-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>

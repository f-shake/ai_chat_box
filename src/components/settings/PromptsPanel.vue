<template>
  <div class="prompts-panel">
    <div class="panel-header">
      <el-button @click="resetAll">重置</el-button>
      <el-button @click="openGroupManager">分组</el-button>
      <el-button type="primary" @click="openAddDialog">新增</el-button>
    </div>

    <div class="panel-search">
      <el-input
        v-model="promptStore.searchQuery"
        placeholder="搜索预设…"
        clearable
      />
    </div>

    <el-scrollbar class="prompts-groups">
      <div v-for="{ group, prompts } in promptStore.groupedPrompts" :key="group.key" class="prompt-group-wrap">
        <el-collapse v-model="openGroups" class="prompt-collapse">
          <el-collapse-item :name="group.key">
            <template #title>
              <div class="group-title-row">
                <span class="group-title">{{ group.name }}</span>
                <span class="group-spacer"></span>
                <el-tag size="small" type="info" effect="plain" class="group-count-tag">{{ prompts.length }}</el-tag>
              </div>
            </template>
            <div class="prompt-group-content">
              <div v-for="p in prompts" :key="p.id" :class="['prompt-item', { active: configStore.activePresetId === p.id }]">
                <div class="prompt-item-header" @click="activate(p.id)">
                  <span class="prompt-title">{{ p.title }}</span>
                  <el-tag v-if="configStore.activePresetId === p.id" size="small" type="success" effect="light">当前</el-tag>
                  <el-tag v-else-if="p.builtIn" size="small" type="info" effect="plain">内置</el-tag>
                </div>
                <div v-if="p.description" class="prompt-desc">{{ p.description }}</div>
                <div class="prompt-chips">
                  <el-tag size="small" v-if="p.config.temperature !== 0.7" type="warning">T={{ p.config.temperature }}</el-tag>
                </div>
                <div class="prompt-actions">
                  <el-button type="primary" size="small" @click="activate(p.id)" :disabled="configStore.activePresetId === p.id">应用</el-button>
                  <el-button text size="small" @click="editPrompt(p.id)">编辑</el-button>
                  <el-button text size="small" type="danger" @click="deletePrompt(p.id)">删除</el-button>
                </div>
              </div>
            </div>
          </el-collapse-item>
        </el-collapse>
      </div>
    </el-scrollbar>

    <!-- Dialogs -->
    <PromptDialog
      v-model="dialogVisible"
      :editing-id="editingId"
      @saved="onSaved"
    />
    <GroupManagerDialog v-model="groupManagerVisible" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { usePromptStore } from '@/stores/promptStore'
import { useConfigStore } from '@/stores/configStore'
import { useConversationStore } from '@/stores/conversationStore'
import { useUiStore } from '@/stores/uiStore'
import PromptDialog from './PromptDialog.vue'
import GroupManagerDialog from './GroupManagerDialog.vue'

const promptStore = usePromptStore()
const configStore = useConfigStore()
const conversationStore = useConversationStore()
const uiStore = useUiStore()

// active id is read directly from configStore.activePresetId in template

const dialogVisible = ref(false)
const editingId = ref<string | null>(null)
const groupManagerVisible = ref(false)
const openGroups = ref<string[]>([])

function openAddDialog() {
  editingId.value = null
  dialogVisible.value = true
}

function editPrompt(id: string) {
  editingId.value = id
  dialogVisible.value = true
}

function deletePrompt(id: string) {
  ElMessageBox.confirm('确定要删除此预设吗？', '删除', {
    type: 'warning',
    confirmButtonText: '删除',
    cancelButtonText: '取消',
  }).then(() => {
    promptStore.deletePrompt(id)
  }).catch(() => {})
}

async function activate(id: string) {
  const p = promptStore.applyPrompt(id)
  if (!p) return
  await configStore.setActivePresetKey(id)

  // Update snapshot on current conversation
  const conv = conversationStore.activeConversation
  if (conv) {
    conv.snapshot = {
      presetName: p.title || '',
      config: { ...configStore.activeConfig },
    }
    conversationStore.saveCurrentConversation()
  }

  // If current conversation has messages, start a new one
  const msgs = conversationStore.currentMessages
  if (msgs.length > 0) {
    await conversationStore.newConversation()
  }

  uiStore.closeSettings()
  ElMessage.success(`已切换至「${p.title}」`)
}

function resetAll() {
  ElMessageBox.confirm('确定要重置所有预设到初始状态吗？', '重置预设', {
    type: 'warning',
    confirmButtonText: '重置',
    cancelButtonText: '取消',
  }).then(() => {
    promptStore.resetAllPresets()
    ElMessage.success('已重置所有预设')
  }).catch(() => {})
}

function openGroupManager() {
  groupManagerVisible.value = true
}

function onSaved() {
  // Refresh
}
</script>

<style scoped>
.prompts-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 8px;
}

.panel-header {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
  flex-wrap: wrap;
}

.panel-search {
  margin-bottom: 4px;
}

.prompts-groups {
  flex: 1;
}

.prompt-group-wrap {
  margin-bottom: 8px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  overflow: hidden;
  background: var(--el-bg-color);
}

.prompt-collapse {
  border: none;
}

.prompt-collapse :deep(.el-collapse-item__header) {
  padding: 0 12px;
  height: 40px;
  background: var(--el-fill-color-light);
  border-bottom: 1px solid var(--el-border-color-light);
  font-weight: 600;
  font-size: 14px;
  display: flex;
  align-items: center;
}

.group-title-row {
  display: flex;
  align-items: center;
  width: 100%;
  gap: 8px;
}

.group-title {
  flex: 0 0 auto;
  color: var(--el-text-color-primary);
}

.group-spacer {
  flex: 1;
}

.group-count-tag {
  flex-shrink: 0;
  margin-right: 6px;
}

.prompt-collapse :deep(.el-collapse-item__wrap) {
  border: none;
  background: var(--el-bg-color);
}

.prompt-collapse :deep(.el-collapse-item__content) {
  padding: 0;
}

.prompt-group-content {
  padding: 6px 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.prompt-item {
  padding: 6px 4px;
  border-bottom: 1px solid var(--el-border-color-extra-light);
}

.prompt-item:last-child {
  border-bottom: none;
}

.prompt-item-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 2px;
}

.prompt-title {
  font-weight: 600;
  font-size: 13px;
  color: var(--el-text-color-primary);
}

.prompt-desc {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-bottom: 4px;
  line-height: 1.5;
}

.prompt-chips {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  margin-bottom: 4px;
}

.prompt-actions {
  display: flex;
  gap: 6px;
  justify-content: flex-end;
}
</style>

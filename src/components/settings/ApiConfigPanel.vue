<template>
  <div class="api-config-panel">
    <div class="panel-header">
      <el-button type="primary" @click="openAddDialog">+ 新增服务</el-button>
    </div>

    <div class="panel-search">
      <el-input
        v-model="apiConfigStore.searchQuery"
        placeholder="搜索服务…"
        clearable
      />
    </div>

    <el-scrollbar class="config-list">
      <el-card
        v-for="cfg in apiConfigStore.filteredConfigs"
        :key="cfg.id"
        :class="['config-card', { active: cfg.id === apiConfigStore.activeId }]"
        shadow="never"
        @click="applyConfig(cfg.id)"
      >
        <div class="config-card-header">
          <span class="config-name">{{ cfg.name }}</span>
          <span :class="['status-dot', cfg.status]" :title="cfg.statusError"></span>
        </div>
        <div class="config-card-body">
          <div class="config-url" :title="cfg.apiUrl">{{ cfg.apiUrl }}</div>
          <div class="config-model">{{ cfg.model }}</div>
        </div>
        <div class="config-card-actions">
          <el-button text @click.stop="editConfig(cfg.id)">编辑</el-button>
          <el-button text type="danger" @click.stop="deleteConfig(cfg.id)">删除</el-button>
        </div>
      </el-card>
    </el-scrollbar>

    <div class="connection-status">
      <span :class="['status-dot', statusClass]"></span>
      <span class="status-text">{{ statusText }}</span>
      <el-button text @click="testConn" :loading="testing">测试连接</el-button>
    </div>

    <!-- Dialog -->
    <ApiConfigDialog
      v-model="dialogVisible"
      :editing-id="editingId"
      @saved="onSaved"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useApiConfigStore } from '@/stores/apiConfigStore'
import { testConnection } from '@/services/apiService'
import { ElMessage, ElMessageBox } from 'element-plus'
import ApiConfigDialog from './ApiConfigDialog.vue'

const apiConfigStore = useApiConfigStore()

const dialogVisible = ref(false)
const editingId = ref<string | null>(null)
const testing = ref(false)

const activeCfg = computed(() => apiConfigStore.activeConfig)

const statusClass = computed(() => activeCfg.value?.status || 'offline')

const statusText = computed(() => {
  const cfg = activeCfg.value
  if (!cfg) return '未连接'
  switch (cfg.status) {
    case 'online': return `已连接 (${cfg.name})`
    case 'offline': return `${cfg.name}: ${cfg.statusError || '连接失败'}`
    case 'checking': return '测试中…'
    default: return cfg.name
  }
})

function openAddDialog() {
  editingId.value = null
  dialogVisible.value = true
}

function editConfig(id: string) {
  editingId.value = id
  dialogVisible.value = true
}

function deleteConfig(id: string) {
  ElMessageBox.confirm('确定要删除此 API 配置吗？', '删除', {
    type: 'warning',
    confirmButtonText: '删除',
    cancelButtonText: '取消',
  }).then(() => {
    apiConfigStore.deleteConfig(id)
  }).catch(() => {})
}

function applyConfig(id: string) {
  apiConfigStore.applyConfig(id)
  // Auto-test
  const cfg = apiConfigStore.configs.find((c) => c.id === id)
  if (cfg) {
    testConn()
  }
}

async function testConn() {
  const cfg = apiConfigStore.activeConfig
  if (!cfg || !cfg.apiUrl) {
    ElMessage.warning('请先配置 API')
    return
  }
  testing.value = true
  apiConfigStore.updateStatus(cfg.id, 'checking')
  const result = await testConnection(cfg.apiUrl, cfg.apiKey)
  apiConfigStore.updateStatus(cfg.id, result.success ? 'online' : 'offline', result.text)
  testing.value = false
}

function onSaved() {
  // Reset status to unknown for the saved config, then auto-test
  const configs = apiConfigStore.configs
  if (configs.length > 0) {
    const last = configs[configs.length - 1]
    apiConfigStore.updateStatus(last.id, 'unknown')
    apiConfigStore.applyConfig(last.id)
    // Re-test connection if the saved config has an API URL
    if (last.apiUrl) {
      testConn()
    }
  }
}
</script>

<style scoped>
.api-config-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 8px;
}

.panel-header {
  display: flex;
  justify-content: flex-end;
}

.config-list {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.config-card {
  cursor: pointer;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  margin-bottom: 4px;
}
.config-card :deep(.el-card__body) {
  padding: 8px 12px;
}

.config-card.active {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}

.config-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}

.config-name {
  font-weight: 600;
  font-size: 13px;
  color: var(--text-primary);
}

.config-card-body {
  font-size: 11px;
  color: var(--text-tertiary);
  line-height: 1.5;
}

.config-url, .config-model {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.config-card-actions {
  display: flex;
  gap: 4px;
  justify-content: flex-end;
  margin-top: 4px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
  flex-shrink: 0;
}

.status-dot.online {
  background: #4caf50;
  box-shadow: 0 0 4px #4caf50;
}

.status-dot.offline {
  background: #f44336;
}

.status-dot.checking {
  background: #ff9800;
  animation: pulse 1s infinite;
}

.status-dot.unknown {
  background: #9e9e9e;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.connection-status {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 0;
  border-top: 1px solid var(--border-color);
  font-size: 12px;
}

.status-text {
  flex: 1;
  color: var(--text-secondary);
}
</style>

<template>
  <div class="input-options">
    <el-switch
      v-model="reasoningEnabled"
      active-text="深度思考"
      size="small"
      @change="onReasoningChange"
    />

    <el-dropdown trigger="click" placement="bottom-start" @command="() => {}">
      <el-button size="small" text class="tools-btn">
        <el-icon><Tools /></el-icon> 工具
        <el-icon><ArrowDown /></el-icon>
      </el-button>
      <template #dropdown>
        <div class="tools-dropdown">
          <div class="tools-item">
            <el-switch v-model="searchEnabled" size="small" @change="onSearchChange" />
            <span class="tools-label">联网搜索</span>
          </div>
          <div class="tools-item">
            <el-switch v-model="calculatorEnabled" size="small" @change="onCalculatorChange" />
            <span class="tools-label">计算器</span>
          </div>
          <div class="tools-item">
            <el-switch v-model="timeEnabled" size="small" @change="onTimeChange" />
            <span class="tools-label">时间日期</span>
          </div>
          <div class="tools-item">
            <el-switch v-model="randomEnabled" size="small" @change="onRandomChange" />
            <span class="tools-label">随机数</span>
          </div>
          <div class="tools-item">
            <el-switch v-model="uuidEnabled" size="small" @change="onUuidChange" />
            <span class="tools-label">UUID</span>
          </div>
          <div class="tools-item">
            <el-switch v-model="fetchPageEnabled" size="small" @change="onFetchPageChange" />
            <span class="tools-label">网页抓取</span>
          </div>
        </div>
      </template>
    </el-dropdown>

    <span v-if="conversationStore.editingMsgIdx >= 0" class="editing-indicator">
      <el-tag size="small" type="warning">编辑中</el-tag>
      <el-button size="small" circle text @click="cancelEdit">
        <el-icon><Close /></el-icon>
      </el-button>
    </span>

    <el-upload
      :show-file-list="false"
      :multiple="true"
      :accept="acceptTypes"
      :on-change="handleUploadChange"
      :auto-upload="false"
      class="upload-btn"
    >
      <el-button size="small" text title="上传文件或图片">
        <el-icon><Upload /></el-icon>
      </el-button>
    </el-upload>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useConversationStore } from '@/stores/conversationStore'
import { useConfigStore } from '@/stores/configStore'
import { useSearchStore } from '@/stores/searchStore'
import { usePromptStore } from '@/stores/promptStore'
import { useFileHandler } from '@/composables/useFileHandler'
import { Close, Upload, Tools, ArrowDown } from '@element-plus/icons-vue'
import type { UploadFile } from 'element-plus'

const conversationStore = useConversationStore()
const configStore = useConfigStore()
const searchStore = useSearchStore()
const promptStore = usePromptStore()
const { readFileAsContent } = useFileHandler()

// Use conversation snapshot for param values, fall back to active preset
const convCfg = computed(() => conversationStore.activeConversation?.snapshot?.config || configStore.activeConfig)
const reasoningEnabled = ref(convCfg.value.reasoningEnabled)
const calculatorEnabled = ref(configStore.params.calculatorEnabled)
const timeEnabled = ref(configStore.params.timeEnabled)
const randomEnabled = ref(configStore.params.randomEnabled)
const uuidEnabled = ref(configStore.params.uuidEnabled)
const fetchPageEnabled = ref(configStore.params.fetchPageEnabled)
const searchEnabled = ref(searchStore.config.enabled)

const acceptTypes = '.txt,.md,.csv,.json,.xml,.js,.py,.html,.css,.yaml,.yml,.toml,.docx,image/*'

watch(() => convCfg.value.reasoningEnabled, (val) => {
  reasoningEnabled.value = val
})

watch(() => configStore.params.calculatorEnabled, (val) => {
  calculatorEnabled.value = val
})
watch(() => configStore.params.timeEnabled, (val) => {
  timeEnabled.value = val
})
watch(() => configStore.params.randomEnabled, (val) => {
  randomEnabled.value = val
})
watch(() => configStore.params.uuidEnabled, (val) => {
  uuidEnabled.value = val
})
watch(() => configStore.params.fetchPageEnabled, (val) => {
  fetchPageEnabled.value = val
})

watch(() => searchStore.config.enabled, (val) => {
  searchEnabled.value = val
})

function onReasoningChange(val: string | number | boolean) {
  const v = Boolean(val)
  // If conversation has a snapshot, update it in-place
  const conv = conversationStore.activeConversation
  if (conv?.snapshot) {
    conv.snapshot.config.reasoningEnabled = v
    conversationStore.saveCurrentConversation()
    return
  }
  // Otherwise update the active preset
  const id = configStore.activePresetId
  if (id) {
    promptStore.editPrompt(id, {
      config: { ...convCfg.value, reasoningEnabled: v },
    })
  }
}

function onCalculatorChange(val: string | number | boolean) {
  configStore.params.calculatorEnabled = Boolean(val)
  configStore.saveParams()
}

function onTimeChange(val: string | number | boolean) {
  configStore.params.timeEnabled = Boolean(val)
  configStore.saveParams()
}

function onRandomChange(val: string | number | boolean) {
  configStore.params.randomEnabled = Boolean(val)
  configStore.saveParams()
}

function onUuidChange(val: string | number | boolean) {
  configStore.params.uuidEnabled = Boolean(val)
  configStore.saveParams()
}

function onFetchPageChange(val: string | number | boolean) {
  configStore.params.fetchPageEnabled = Boolean(val)
  configStore.saveParams()
}

function onSearchChange(val: string | number | boolean) {
  searchStore.setEnabled(Boolean(val))
}

function cancelEdit() {
  conversationStore.cancelEdit()
}

async function handleUploadChange(uploadFile: UploadFile) {
  if (!uploadFile.raw) return
  try {
    const pending = await readFileAsContent(uploadFile.raw)
    conversationStore.pendingFiles.push(pending)
  } catch (e: any) {
    ElMessage.error(e.message || '文件读取失败')
  }
}
</script>

<style scoped>
.input-options {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 4px 0;
  flex-wrap: wrap;
}

.tools-btn {
  display: flex;
  align-items: center;
  gap: 2px;
}

.editing-indicator {
  display: flex;
  align-items: center;
  gap: 4px;
}

.upload-btn {
  margin-left: auto;
}

.tools-dropdown {
  padding: 8px;
  min-width: 160px;
}

.tools-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
}

.tools-label {
  font-size: 13px;
  color: var(--text-primary);
  white-space: nowrap;
}
</style>

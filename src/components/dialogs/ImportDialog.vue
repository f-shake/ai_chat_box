<template>
  <el-dialog v-model="visible" title="导入数据" width="90%" style="max-width: 500px">
    <div v-if="!importedData" class="import-step">
      <el-upload
        drag
        :auto-upload="false"
        :show-file-list="false"
        :on-change="handleFileChange"
        accept=".json"
      >
        <el-icon class="upload-icon" :size="40"><UploadFilled /></el-icon>
        <div class="upload-text">点击或拖拽 JSON 文件到此处</div>
      </el-upload>
    </div>

    <div v-else class="import-preview">
      <h4>预览导入内容：</h4>
      <div class="import-stats">
        <div v-if="importedData.presets" class="stat-item">
          <el-checkbox v-model="importPresets">参数配置 ({{ importedData.presets.length }} 个)</el-checkbox>
        </div>
        <div v-if="importedData.apiConfigs" class="stat-item">
          <el-checkbox v-model="importApiConfigs">API 配置 ({{ importedData.apiConfigs.length }} 个)</el-checkbox>
        </div>
        <div v-if="importedData.conversations" class="stat-item">
          <el-checkbox v-model="importConversations">对话记录 ({{ importedData.conversations.length }} 个)</el-checkbox>
        </div>
        <div v-if="importedData.params" class="stat-item">
          <el-checkbox v-model="importConfig">工具与搜索配置</el-checkbox>
        </div>
      </div>
      <el-alert type="warning" :closable="false" show-icon>
        导入将合并所选数据。相同 ID 的对话和配置将被覆盖。
      </el-alert>
    </div>

    <template #footer>
      <el-button @click="cancel">取消</el-button>
      <el-button
        v-if="importedData"
        type="primary"
        @click="doImport"
        :disabled="!importPresets && !importApiConfigs && !importConversations && !importConfig"
      >
        导入
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { usePromptStore } from '@/stores/promptStore'
import { useApiConfigStore } from '@/stores/apiConfigStore'
import { useConversationStore } from '@/stores/conversationStore'
import { useConfigStore } from '@/stores/configStore'
import { useSearchStore } from '@/stores/searchStore'
import { UploadFilled } from '@element-plus/icons-vue'
import type { UploadFile } from 'element-plus'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const promptStore = usePromptStore()
const apiConfigStore = useApiConfigStore()
const conversationStore = useConversationStore()
const configStore = useConfigStore()
const searchStore = useSearchStore()

const visible = ref(props.modelValue)
watch(() => props.modelValue, (v) => { visible.value = v })
watch(visible, (v) => {
  if (!v) {
    importedData.value = null
  }
})

const importedData = ref<any>(null)
const importPresets = ref(true)
const importApiConfigs = ref(true)
const importConversations = ref(true)
const importConfig = ref(true)

function handleFileChange(uploadFile: UploadFile) {
  if (!uploadFile.raw) return
  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      importedData.value = JSON.parse(e.target?.result as string)
    } catch {
      ElMessage.error('无效的 JSON 文件')
    }
  }
  reader.readAsText(uploadFile.raw)
}

async function doImport() {
  if (!importedData.value) return

  if (importPresets.value && importedData.value.presets) {
    // Merge presets (overwrite by ID)
    for (const p of importedData.value.presets) {
      // Match against both user and preset prompts
      const userIdx = promptStore.userPrompts.findIndex((up) => up.id === p.id)
      if (userIdx >= 0) {
        promptStore.userPrompts[userIdx] = p
        continue
      }
      // Check if there's a user override for this built-in preset
      const hasOverride = promptStore.userPrompts.some((up) => up.presetRef === p.id)
      if (!hasOverride) {
        promptStore.userPrompts.push({ ...p, builtIn: false })
      }
    }
  }

  if (importApiConfigs.value && importedData.value.apiConfigs) {
    for (const c of importedData.value.apiConfigs) {
      const existing = apiConfigStore.configs.findIndex((ac) => ac.id === c.id)
      if (existing >= 0) {
        apiConfigStore.configs[existing] = c
      } else {
        apiConfigStore.configs.push(c)
      }
    }
    await apiConfigStore.saveConfigs()
  }

  if (importConversations.value && importedData.value.conversations) {
    for (const conv of importedData.value.conversations) {
      const existing = conversationStore.conversations.findIndex((c) => c.id === conv.id)
      if (existing >= 0) {
        conversationStore.conversations[existing] = conv
      } else {
        conversationStore.conversations.push(conv)
      }
    }
    await conversationStore.saveConversations()
  }

  // Save imported presets and restore activePresetId
  if (importPresets.value && importedData.value.presets) {
    await promptStore.saveAll()
    if (importedData.value.activePresetId) {
      await configStore.setActivePresetKey(importedData.value.activePresetId)
    }
  }

  if (importConfig.value && importedData.value.params) {
    Object.assign(configStore.params, importedData.value.params)
    await configStore.saveParams()
  }
  if (importConfig.value && importedData.value.activePresetId) {
    await configStore.setActivePresetKey(importedData.value.activePresetId)
  }
  if (importConfig.value && importedData.value.searchConfig) {
    Object.assign(searchStore.config, importedData.value.searchConfig)
    await searchStore.save()
  }
  if (importConfig.value && importedData.value.format) {
    Object.assign(configStore.format, importedData.value.format)
    configStore.applyFormatToCSS()
    await configStore.saveFormat()
  }

  if (!importPresets.value) {
    await promptStore.saveAll()
  }
  visible.value = false
  ElMessage.success('导入成功')
}

function cancel() {
  visible.value = false
}
</script>

<style scoped>
.upload-icon {
  margin-bottom: 8px;
}

.upload-text {
  font-size: 14px;
  color: var(--text-secondary);
}

.import-stats {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}

.import-preview h4 {
  margin-bottom: 12px;
  font-size: 14px;
  color: var(--text-primary);
}
</style>

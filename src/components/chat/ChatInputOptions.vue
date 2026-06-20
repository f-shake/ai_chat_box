<template>
  <div class="input-options">
    <el-switch
      v-model="reasoningEnabled"
      active-text="深度思考"
      size="small"
      @change="onReasoningChange"
    />
    <el-switch
      v-model="searchEnabled"
      active-text="搜索"
      size="small"
      @change="onSearchChange"
    />

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
import { ref, watch } from 'vue'
import { useConversationStore } from '@/stores/conversationStore'
import { useConfigStore } from '@/stores/configStore'
import { useSearchStore } from '@/stores/searchStore'
import { useFileHandler } from '@/composables/useFileHandler'
import { Close, Upload } from '@element-plus/icons-vue'
import type { UploadFile } from 'element-plus'

const conversationStore = useConversationStore()
const configStore = useConfigStore()
const searchStore = useSearchStore()
const { readFileAsContent } = useFileHandler()

const reasoningEnabled = ref(configStore.params.reasoningEnabled)
const searchEnabled = ref(searchStore.config.enabled)

const acceptTypes = '.txt,.md,.csv,.json,.xml,.js,.py,.html,.css,.yaml,.yml,.toml,.docx,image/*'

watch(() => configStore.params.reasoningEnabled, (val) => {
  reasoningEnabled.value = val
})

watch(() => searchStore.config.enabled, (val) => {
  searchEnabled.value = val
})

function onReasoningChange(val: boolean) {
  configStore.params.reasoningEnabled = val
  configStore.saveParams()
}

function onSearchChange(val: boolean) {
  searchStore.setEnabled(val)
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

.editing-indicator {
  display: flex;
  align-items: center;
  gap: 4px;
}

.upload-btn {
  margin-left: auto;
}
</style>

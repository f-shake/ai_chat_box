<template>
  <el-dialog v-model="visible" title="分享配置" width="90%" style="max-width: 500px">
    <div class="share-form">
      <el-checkbox v-model="shareUrl">服务地址 (URL)</el-checkbox>
      <el-checkbox v-model="shareModel">模型名称</el-checkbox>
      <el-checkbox v-model="shareName">服务名称</el-checkbox>
      <el-checkbox v-model="shareKey">API Key</el-checkbox>
      <el-divider />
      <el-checkbox v-model="shareTools">工具（参数 + 工具开关 + 搜索配置）</el-checkbox>
    </div>

    <el-divider />

    <div v-if="shareResult" class="share-result">
      <el-input v-model="shareResult" type="textarea" :rows="3" readonly />
      <el-button @click="copyUrl">复制链接</el-button>
    </div>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" @click="generateShare" :loading="generating">
        {{ shareResult ? '重新生成' : '生成分享链接' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useApiConfigStore } from '@/stores/apiConfigStore'
import { useConfigStore } from '@/stores/configStore'
import { useSearchStore } from '@/stores/searchStore'
import { encryptShareData } from '@/composables/useEncryptedShare'
import type { ShareData } from '@/composables/useEncryptedShare'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const apiConfigStore = useApiConfigStore()
const configStore = useConfigStore()
const searchStore = useSearchStore()

const visible = ref(props.modelValue)
watch(() => props.modelValue, (v) => { visible.value = v })
watch(visible, (v) => {
  if (!v) {
    shareResult.value = ''
  }
})

const shareUrl = ref(true)
const shareModel = ref(true)
const shareName = ref(false)
const shareKey = ref(false)
const shareTools = ref(false)
const generating = ref(false)
const shareResult = ref('')

async function generateShare() {
  const active = apiConfigStore.activeConfig
  if (!active) {
    ElMessage.warning('没有活跃的 API 配置')
    return
  }

  generating.value = true
  try {
    const data: ShareData = {}
    if (shareUrl.value) data.url = active.apiUrl
    if (shareModel.value) data.model = active.model
    if (shareName.value) data.name = active.name
    if (shareKey.value) data.key = active.apiKey
    if (shareTools.value) {
      data.tools = {
        presetId: configStore.activePresetId,
        presetConfig: { ...configStore.activeConfig },
        toolToggles: { ...configStore.params },
        searchConfig: { ...searchStore.config },
      }
    }

    const encoded = await encryptShareData(data)
    const url = `${window.location.origin}${window.location.pathname}?data=${encoded}`
    shareResult.value = url
  } catch (e: any) {
    ElMessage.error('生成失败: ' + e.message)
  }
  generating.value = false
}

async function copyUrl() {
  try {
    await navigator.clipboard.writeText(shareResult.value)
    ElMessage.success('已复制到剪贴板')
  } catch {
    ElMessage.error('复制失败')
  }
}
</script>

<style scoped>
.share-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.share-result {
  display: flex;
  gap: 8px;
  align-items: flex-start;
}

.share-result .el-input {
  flex: 1;
}
</style>

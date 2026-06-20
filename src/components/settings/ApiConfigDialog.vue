<template>
  <el-dialog v-model="visible" :title="editingId ? '编辑服务' : '新增服务'" width="500px">
    <el-form :model="form" label-width="80px">
      <el-form-item label="名称">
        <el-input v-model="form.name" placeholder="服务名称" />
      </el-form-item>
      <el-form-item label="API URL">
        <el-input v-model="form.apiUrl" placeholder="https://api.deepseek.com/v1" />
      </el-form-item>
      <el-form-item label="API Key">
        <el-input v-model="form.apiKey" type="password" show-password placeholder="sk-..." />
      </el-form-item>
      <el-form-item label="模型">
        <el-select
          v-model="form.model"
          allow-create
          filterable
          placeholder="输入或选择模型"
          style="width: 100%"
        >
          <el-option
            v-for="m in availableModels"
            :key="m"
            :label="m"
            :value="m"
          />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button @click="testConn" :loading="testing">测试连接</el-button>
        <span v-if="testResult" :class="['test-result', testResult.success ? 'success' : 'error']">
          {{ testResult.text }}
        </span>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" @click="save">{{ editingId ? '保存' : '创建' }}</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue'
import { useApiConfigStore } from '@/stores/apiConfigStore'
import { testConnection } from '@/services/apiService'

const props = defineProps<{
  modelValue: boolean
  editingId: string | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  saved: []
}>()

const apiConfigStore = useApiConfigStore()

const visible = ref(props.modelValue)
watch(() => props.modelValue, (v) => { visible.value = v })
watch(visible, (v) => emit('update:modelValue', v))

const form = reactive({
  name: '',
  apiUrl: '',
  apiKey: '',
  model: '',
})

const testing = ref(false)
const testResult = ref<{ success: boolean; text: string } | null>(null)
const availableModels = ref<string[]>([])

watch(visible, (v) => {
  if (v && props.editingId) {
    const cfg = apiConfigStore.configs.find((c) => c.id === props.editingId)
    if (cfg) {
      form.name = cfg.name
      form.apiUrl = cfg.apiUrl
      form.apiKey = cfg.apiKey
      form.model = cfg.model
    }
  } else if (v) {
    form.name = ''
    form.apiUrl = ''
    form.apiKey = ''
    form.model = ''
  }
  testResult.value = null
  availableModels.value = []
})

async function testConn() {
  if (!form.apiUrl) {
    ElMessage.warning('请先填写 API URL')
    return
  }
  testing.value = true
  testResult.value = null
  const result = await testConnection(form.apiUrl, form.apiKey)
  testing.value = false
  testResult.value = result
  if (result.models && result.models.length > 0) {
    availableModels.value = result.models
  }
}

async function save() {
  if (!form.name || !form.apiUrl || !form.model) {
    ElMessage.warning('请填写必要信息')
    return
  }

  if (props.editingId) {
    await apiConfigStore.updateConfig(props.editingId, { ...form })
  } else {
    await apiConfigStore.addConfig({ ...form })
  }
  emit('saved')
  visible.value = false
}
</script>

<style scoped>
.test-result {
  margin-left: 8px;
  font-size: 12px;
}
.test-result.success {
  color: #2e7d32;
}
.test-result.error {
  color: #c62828;
}
</style>

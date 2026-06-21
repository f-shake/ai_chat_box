<template>
  <el-dialog v-model="visible" :title="editingId ? '编辑预设' : '新增预设'" width="90%" style="max-width: 550px">
    <el-form :model="form" label-width="100px">
      <el-form-item label="标题">
        <el-input v-model="form.title" placeholder="预设名称" />
      </el-form-item>
      <el-form-item label="描述">
        <el-input v-model="form.description" placeholder="简短描述" />
      </el-form-item>
      <el-form-item label="所属分组">
        <el-select v-model="form.groupKey" style="width: 100%">
          <el-option
            v-for="g in promptStore.groups"
            :key="g.key"
            :label="g.name"
            :value="g.key"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="系统提示词">
        <el-input v-model="form.config.systemPrompt" type="textarea" :rows="4" placeholder="系统提示词内容" />
      </el-form-item>
      <el-form-item label="温度">
        <el-slider v-model="form.config.temperature" :min="0" :max="2" :step="0.1" />
      </el-form-item>
      <el-form-item label="最大 Token">
        <el-input-number v-model="form.config.maxTokens" :min="0" :max="131072" style="width: 100%" />
      </el-form-item>
      <el-form-item label="Top-P">
        <el-slider v-model="form.config.topP" :min="0" :max="1" :step="0.05" />
      </el-form-item>
      <el-form-item label="历史轮数">
        <el-input-number v-model="form.config.historyLimit" :min="0" :max="100" style="width: 100%" />
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
import { usePromptStore } from '@/stores/promptStore'
import type { PromptConfig } from '@/types'

const props = defineProps<{
  modelValue: boolean
  editingId: string | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  saved: []
}>()

const promptStore = usePromptStore()

const visible = ref(props.modelValue)
watch(() => props.modelValue, (v) => { visible.value = v })
watch(visible, (v) => emit('update:modelValue', v))

const defaultPresetConfig: PromptConfig = {
  systemPrompt: '',
  temperature: 0.7,
  maxTokens: 0,
  topP: 1.0,
  frequencyPenalty: 0,
  presencePenalty: 0,
  historyLimit: 20,
  reasoningEnabled: false,
}

const form = reactive({
  title: '',
  description: '',
  groupKey: 'chat',
  config: { ...defaultPresetConfig },
})

watch(visible, (v) => {
  if (v && props.editingId) {
    // Find in all prompts (preset or user)
    const p = promptStore.allPrompts.find((p) => p.id === props.editingId)
    if (p) {
      form.title = p.title
      form.description = p.description
      form.groupKey = p.groupKey
      form.config = { ...p.config }
    }
  } else if (v) {
    form.title = ''
    form.description = ''
    form.groupKey = promptStore.groups[0]?.key || 'chat'
    form.config = { systemPrompt: '', temperature: 0.7, maxTokens: 0, topP: 1.0, frequencyPenalty: 0, presencePenalty: 0, historyLimit: 20, reasoningEnabled: false }
  }
})

async function save() {
  if (!form.title) {
    ElMessage.warning('请输入标题')
    return
  }

  if (props.editingId) {
    await promptStore.editPrompt(props.editingId, {
      title: form.title,
      description: form.description,
      groupKey: form.groupKey,
      config: form.config,
    })
  } else {
    await promptStore.addPrompt({
      title: form.title,
      description: form.description,
      groupKey: form.groupKey,
      config: form.config,
    })
  }
  emit('saved')
  visible.value = false
}
</script>

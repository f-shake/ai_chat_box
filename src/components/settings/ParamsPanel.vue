<template>
  <div class="settings-panel">
    <div class="form-group">
      <label>当前系统提示词</label>
      <el-input
        v-model="configStore.params.systemPrompt"
        type="textarea"
        :rows="6"
        placeholder="系统提示词"
        @blur="autoSave"
      />
    </div>

    <div class="form-group">
      <label>温度: {{ configStore.params.temperature }}</label>
      <el-slider v-model="configStore.params.temperature" :min="0" :max="2" :step="0.1" @change="autoSave" />
    </div>

    <div class="form-group">
      <label>最大 Token <span class="hint">(0=不限制)</span></label>
      <el-input-number v-model="configStore.params.maxTokens" :min="0" :max="131072" :step="1" @change="autoSave" style="width: 100%" />
    </div>

    <div class="form-group">
      <label>Top-P: {{ configStore.params.topP }}</label>
      <el-slider v-model="configStore.params.topP" :min="0" :max="1" :step="0.05" @change="autoSave" />
    </div>

    <div class="form-group">
      <label>频率惩罚: {{ configStore.params.frequencyPenalty }}</label>
      <el-slider v-model="configStore.params.frequencyPenalty" :min="-2" :max="2" :step="0.1" @change="autoSave" />
    </div>

    <div class="form-group">
      <label>存在惩罚: {{ configStore.params.presencePenalty }}</label>
      <el-slider v-model="configStore.params.presencePenalty" :min="-2" :max="2" :step="0.1" @change="autoSave" />
    </div>

    <div class="form-group">
      <label>携带历史轮数</label>
      <el-input-number v-model="configStore.params.historyLimit" :min="0" :max="100" :step="1" @change="autoSave" style="width: 100%" />
      <span class="hint">设为 0 则不携带上下文</span>
    </div>

    <el-divider />
    <div class="flex-row">
      <el-button type="success" @click="saveParams">保存参数</el-button>
      <el-button @click="resetParams">重置</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useConfigStore } from '@/stores/configStore'
import { useUiStore } from '@/stores/uiStore'

const configStore = useConfigStore()
const uiStore = useUiStore()

function autoSave() {
  configStore.saveParams()
}

function saveParams() {
  configStore.saveParams()
  uiStore.closeSettings()
  ElMessage.success('参数已保存')
}

function resetParams() {
  configStore.resetParams()
  ElMessage.success('参数已重置')
}
</script>

<style scoped>
.settings-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.form-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.form-group label {
  font-size: 13px;
  color: var(--text-primary);
  font-weight: 500;
}
.hint {
  font-size: 11px;
  color: var(--text-tertiary);
  line-height: 1.4;
}
.flex-row {
  display: flex;
  gap: 8px;
}
</style>

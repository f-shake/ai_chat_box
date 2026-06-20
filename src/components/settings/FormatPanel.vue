<template>
  <div class="settings-panel">
    <div class="form-group">
      <label>字号: {{ configStore.format.fontSize }}px</label>
      <el-slider v-model="configStore.format.fontSize" :min="12" :max="28" :step="1" @change="onFormatChange" />
    </div>
    <div class="form-group">
      <label>行高: {{ configStore.format.lineHeight }}</label>
      <el-slider v-model="configStore.format.lineHeight" :min="1.0" :max="2.5" :step="0.1" @change="onFormatChange" />
    </div>
    <div class="form-group">
      <label>消息间距: {{ configStore.format.msgGap }}px</label>
      <el-slider v-model="configStore.format.msgGap" :min="4" :max="32" :step="2" @change="onFormatChange" />
    </div>
    <div class="form-group">
      <label>段落间距: {{ configStore.format.paraGap }}px</label>
      <el-slider v-model="configStore.format.paraGap" :min="0" :max="20" :step="1" @change="onFormatChange" />
    </div>
    <div class="form-group">
      <el-switch v-model="configStore.format.indent" active-text="首行缩进 2 字符" @change="onFormatChange" />
    </div>
    <el-divider />
    <el-button @click="resetFormat" :disabled="isFormatDefault">重置</el-button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useConfigStore } from '@/stores/configStore'
import { DEFAULT_FORMAT_CONFIG } from '@/utils/constants'

const configStore = useConfigStore()

const isFormatDefault = computed(() => {
  return JSON.stringify(configStore.format) === JSON.stringify(DEFAULT_FORMAT_CONFIG)
})

function onFormatChange() {
  configStore.saveFormat()
  configStore.applyFormatToCSS()
}

function resetFormat() {
  configStore.resetFormat()
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
</style>

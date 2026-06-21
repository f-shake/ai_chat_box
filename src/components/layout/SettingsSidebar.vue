<template>
  <div class="settings-sidebar">
    <el-tabs v-model="activeTab" class="settings-tabs" :stretch="true">
      <el-tab-pane label="服务" name="api">
        <ApiConfigPanel />
      </el-tab-pane>
      <el-tab-pane label="参数" name="params">
        <ParamsPanel />
      </el-tab-pane>
      <el-tab-pane label="预设" name="prompts">
        <PromptsPanel />
      </el-tab-pane>
      <el-tab-pane label="工具" name="search">
        <SearchPanel />
      </el-tab-pane>
      <el-tab-pane label="格式" name="format">
        <FormatPanel />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import ApiConfigPanel from '@/components/settings/ApiConfigPanel.vue'
import ParamsPanel from '@/components/settings/ParamsPanel.vue'
import PromptsPanel from '@/components/settings/PromptsPanel.vue'
import SearchPanel from '@/components/settings/SearchPanel.vue'
import FormatPanel from '@/components/settings/FormatPanel.vue'

const activeTab = ref('api')
</script>

<style scoped>
.settings-sidebar {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.settings-tabs {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.settings-tabs :deep(.el-tabs__content) {
  flex: 1;
  overflow: auto;
  padding: 12px;
}

.settings-tabs :deep(.el-tab-pane) {
  height: 100%;
}
</style>

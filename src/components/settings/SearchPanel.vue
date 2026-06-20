<template>
  <div class="settings-panel">
    <div class="form-group">
      <el-switch v-model="searchEnabled" active-text="启用联网搜索" @change="onEnabledChange" />
    </div>
    <div class="form-group">
      <label>代理地址</label>
      <el-input v-model="proxyUrl" placeholder="http://localhost:3456" @blur="onSave" />
      <span class="hint">Node.js 搜索代理的服务地址，启动后填写</span>
    </div>
    <div class="form-group">
      <label>首选搜索引擎</label>
      <el-select v-model="preferredEngine" @change="onSave" style="width: 100%">
        <el-option label="搜狗搜索" value="sogou" />
        <el-option label="必应搜索" value="bing" />
        <el-option label="360 搜索" value="so360" />
      </el-select>
      <span class="hint">搜索失败时会自动降级到其他可用引擎</span>
    </div>
    <div class="form-group row-group">
      <el-button @click="testProxy" :loading="testing">测试连接</el-button>
      <span :class="['proxy-status', proxyStatus]">{{ proxyStatusText }}</span>
    </div>
    <el-divider />
    <el-button type="success" @click="saveAll">保存</el-button>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useSearchStore } from '@/stores/searchStore'
import { testSearchProxy } from '@/services/searchService'

const searchStore = useSearchStore()

const searchEnabled = ref(searchStore.config.enabled)
const proxyUrl = ref(searchStore.config.proxyUrl)
const preferredEngine = ref(searchStore.config.preferredEngine)
const testing = ref(false)
const proxyStatus = ref('')
const proxyStatusText = ref('')

watch(() => searchStore.config, (val) => {
  searchEnabled.value = val.enabled
  proxyUrl.value = val.proxyUrl
  preferredEngine.value = val.preferredEngine
}, { deep: true })

async function testProxy() {
  testing.value = true
  proxyStatus.value = ''
  proxyStatusText.value = '测试中…'
  const ok = await testSearchProxy(proxyUrl.value)
  testing.value = false
  if (ok) {
    proxyStatus.value = 'online'
    proxyStatusText.value = '连接成功'
  } else {
    proxyStatus.value = 'offline'
    proxyStatusText.value = '连接失败'
  }
}

function onEnabledChange() {
  searchStore.setEnabled(searchEnabled.value)
}

function onSave() {
  searchStore.config.proxyUrl = proxyUrl.value
  searchStore.config.preferredEngine = preferredEngine.value
  searchStore.save()
}

async function saveAll() {
  onSave()
  ElMessage.success('搜索配置已保存')
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
.row-group {
  flex-direction: row;
  align-items: center;
  gap: 8px;
}
.proxy-status {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 4px;
}
.proxy-status.online {
  background: #e8f5e9;
  color: #2e7d32;
}
.proxy-status.offline {
  background: #fce4ec;
  color: #c62828;
}
</style>

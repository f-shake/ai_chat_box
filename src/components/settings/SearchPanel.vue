<template>
  <div class="settings-panel">
    <div class="form-group">
      <el-switch v-model="searchEnabled" active-text="启用联网搜索" @change="onEnabledChange" />
    </div>

    <!-- Provider selector -->
    <div class="form-group">
      <label>搜索服务商</label>
      <el-select v-model="provider" @change="onProviderChange" style="width: 100%">
        <el-option label="博查搜索" value="bocha" />
        <el-option label="本地服务" value="local" />
      </el-select>
    </div>

    <!-- Bocha settings -->
    <template v-if="provider === 'bocha'">
      <div class="form-group">
        <label>博查 API Key</label>
        <el-input v-model="bochaApiKey" type="password" show-password placeholder="sk-..." @blur="onSave" />
        <span class="hint">前往 <a href="https://open.bocha.cn" target="_blank">open.bocha.cn</a> 获取</span>
      </div>
      <div class="form-group row-group">
        <el-button size="small" @click="testBocha" :loading="bochaTesting">测试连接</el-button>
        <span :class="['proxy-status', bochaStatus]">{{ bochaStatusText }}</span>
      </div>
      <el-divider />
      <el-button type="success" @click="saveAll">保存</el-button>
    </template>

    <!-- Local proxy settings -->
    <template v-if="provider === 'local'">
      <div class="form-group">
        <label>代理地址</label>
        <el-input v-model="proxyUrl" placeholder="http://localhost:3456" @blur="onSave" />
        <span class="hint">Node.js 搜索代理的服务地址，需先启动 server.js</span>
      </div>
      <div class="form-group row-group">
        <el-button size="small" @click="testProxy" :loading="testing">测试连接</el-button>
        <span :class="['proxy-status', proxyStatus]">{{ proxyStatusText }}</span>
      </div>
      <el-divider />
      <el-button type="success" @click="saveAll">保存</el-button>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useSearchStore } from '@/stores/searchStore'
import { testSearchProxy, testBochaConnection } from '@/services/searchService'

const searchStore = useSearchStore()

const searchEnabled = ref(searchStore.config.enabled)
const provider = ref(searchStore.config.provider)
const proxyUrl = ref(searchStore.config.proxyUrl)
const bochaApiKey = ref(searchStore.config.bochaApiKey)
const testing = ref(false)
const proxyStatus = ref('')
const proxyStatusText = ref('')
const bochaTesting = ref(false)
const bochaStatus = ref('')
const bochaStatusText = ref('')

watch(() => searchStore.config, (val) => {
  searchEnabled.value = val.enabled
  provider.value = val.provider
  proxyUrl.value = val.proxyUrl
  bochaApiKey.value = val.bochaApiKey
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

async function testBocha() {
  if (!bochaApiKey.value) {
    ElMessage.warning('请先填写 API Key')
    return
  }
  bochaTesting.value = true
  bochaStatus.value = ''
  bochaStatusText.value = '测试中…'
  const result = await testBochaConnection(bochaApiKey.value)
  bochaTesting.value = false
  bochaStatus.value = result.success ? 'online' : 'offline'
  bochaStatusText.value = result.message
}

function onEnabledChange() {
  searchStore.setEnabled(searchEnabled.value)
}

async function onProviderChange() {
  searchStore.config.provider = provider.value
  await searchStore.save()
}

function onSave() {
  searchStore.config.proxyUrl = proxyUrl.value
  searchStore.config.bochaApiKey = bochaApiKey.value
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
.hint a {
  color: var(--el-color-primary);
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

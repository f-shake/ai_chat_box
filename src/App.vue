<template>
  <div class="app-root">
    <AppHeader
      @open-export="exportDialogVisible = true"
      @open-import="importDialogVisible = true"
      @open-share="shareDialogVisible = true"
    />

    <div class="app-body">
      <!-- Desktop: Left sidebar (toggle via hamburger button) -->
      <aside v-if="!isMobile" v-show="uiStore.historyVisible" class="history-aside">
        <HistorySidebar />
      </aside>

      <!-- Mobile: History drawer (slide from left) -->
      <el-drawer
        v-if="isMobile"
        v-model="uiStore.historyVisible"
        :with-header="false"
        :size="'70%'"
        direction="ltr"
        :z-index="200"
        class="mobile-history-drawer"
        :body-style="{ padding: 0 }"
      >
        <HistorySidebar />
      </el-drawer>

      <!-- Main chat area -->
      <main class="chat-main">
        <ChatArea />
      </main>
    </div>

    <!-- Settings drawer (right side, all devices) -->
    <el-drawer
      v-model="uiStore.settingsVisible"
      title="设置"
      :size="isMobile ? '85%' : '360px'"
      direction="rtl"
      :z-index="200"
      :with-header="false"
    >
      <SettingsSidebar />
    </el-drawer>

    <!-- Welcome dialog -->
    <el-dialog v-model="welcomeVisible" title="欢迎使用 AI 聊天助手" :width="isMobile ? '90%' : '480px'" :close-on-click-modal="false" :show-close="false">
      <div class="welcome-content">
        <p>在使用前，请先完成以下配置：</p>
        <ol style="padding-left: 20px; line-height: 2;">
          <li><strong>配置 AI 服务</strong> — 点击右上角 <el-icon><Setting /></el-icon> 进入设置 →「服务」面板，填入 API 地址和密钥，测试连接后即可开始聊天。</li>
          <li><strong>（可选）配置联网搜索</strong> — 如需联网搜索，可在设置 →「搜索」面板中，选择「博查搜索」或启动本地搜索代理 server.js。</li>
        </ol>
      </div>
      <template #footer>
        <el-button type="primary" @click="onWelcomeDone">我知道了</el-button>
      </template>
    </el-dialog>

    <!-- Export / Import / Share dialogs -->
    <ExportDialog v-model="exportDialogVisible" />
    <ImportDialog v-model="importDialogVisible" />
    <ShareDialog v-model="shareDialogVisible" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { useUiStore } from '@/stores/uiStore'
import AppHeader from '@/components/layout/AppHeader.vue'
import HistorySidebar from '@/components/layout/HistorySidebar.vue'
import SettingsSidebar from '@/components/layout/SettingsSidebar.vue'
import { Setting } from '@element-plus/icons-vue'
import { WELCOME_DONE_KEY } from '@/utils/constants'
import ChatArea from '@/components/chat/ChatArea.vue'
import ExportDialog from '@/components/dialogs/ExportDialog.vue'
import ImportDialog from '@/components/dialogs/ImportDialog.vue'
import ShareDialog from '@/components/dialogs/ShareDialog.vue'

const uiStore = useUiStore()

const welcomeVisible = ref(false)
const exportDialogVisible = ref(false)
const importDialogVisible = ref(false)
const shareDialogVisible = ref(false)

onMounted(() => {
  nextTick(() => {
    try {
      const done = localStorage.getItem(WELCOME_DONE_KEY)
      if (!done) welcomeVisible.value = true
    } catch {
      welcomeVisible.value = true
    }
  })
})

function onWelcomeDone() {
  welcomeVisible.value = false
  try { localStorage.setItem(WELCOME_DONE_KEY, '1') } catch {}
}

const isMobile = ref(window.innerWidth < 768)

function onResize() {
  const nowMobile = window.innerWidth < 768
  // Transition from mobile → desktop: close drawer, show sidebar
  if (isMobile.value && !nowMobile) {
    uiStore.closeHistory()
  }
  isMobile.value = nowMobile
}

onMounted(() => {
  window.addEventListener('resize', onResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', onResize)
})
</script>

<style scoped>
.app-root {
  height: var(--app-height, 100vh);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--bg-primary);
}

.app-body {
  flex: 1;
  display: flex;
  overflow: hidden;
  min-height: 0;
}

.history-aside {
  width: 260px;
  flex-shrink: 0;
  background: var(--bg-secondary);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.chat-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}

</style>

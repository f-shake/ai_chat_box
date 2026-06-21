<template>
  <div class="app-root">
    <AppHeader />

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
        :size="'85%'"
        direction="ltr"
        :z-index="200"
        class="mobile-history-drawer"
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
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useUiStore } from '@/stores/uiStore'
import AppHeader from '@/components/layout/AppHeader.vue'
import HistorySidebar from '@/components/layout/HistorySidebar.vue'
import SettingsSidebar from '@/components/layout/SettingsSidebar.vue'
import ChatArea from '@/components/chat/ChatArea.vue'

const uiStore = useUiStore()

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

/* Mobile history drawer: remove default padding */
.mobile-history-drawer :deep(.el-drawer__body) {
  padding: 0;
}
</style>

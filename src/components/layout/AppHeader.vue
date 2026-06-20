<template>
  <el-header class="app-header" height="50px">
    <div class="header-left">
      <button class="header-icon-btn" @click="uiStore.toggleHistory()" title="对话历史">
        <el-icon :size="20"><Menu /></el-icon>
      </button>
      <h1 class="header-title" v-show="isMobile">AI 聊天</h1>
    </div>

    <div class="header-center">
      <span class="conv-title" @click="renameDialogVisible = true">
        {{ conversationStore.convTitle }}
      </span>
    </div>

    <div class="header-right">
      <button class="header-icon-btn" @click="uiStore.toggleTheme()" :title="uiStore.theme === 'light' ? '切换到暗色模式' : '切换到亮色模式'">
        <el-icon :size="20">
          <Sunny v-if="uiStore.theme === 'light'" />
          <Moon v-else />
        </el-icon>
      </button>
      <button class="header-icon-btn" @click="uiStore.openSettings()" title="设置">
        <el-icon :size="20"><Setting /></el-icon>
      </button>
      <el-dropdown trigger="click" @command="handleDropdown">
        <button class="header-icon-btn" title="更多">
          <el-icon :size="20"><MoreFilled /></el-icon>
        </button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="export">
              <el-icon><Download /></el-icon> 导出数据
            </el-dropdown-item>
            <el-dropdown-item command="import">
              <el-icon><Upload /></el-icon> 导入数据
            </el-dropdown-item>
            <el-dropdown-item command="share">
              <el-icon><Share /></el-icon> 分享配置
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
  </el-header>

  <!-- Rename dialog -->
  <el-dialog v-model="renameDialogVisible" title="重命名对话" width="400px" :close-on-click-modal="true">
    <el-input v-model="renameTitle" placeholder="输入新标题" @keyup.enter="doRename" />
    <template #footer>
      <el-button @click="renameDialogVisible = false">取消</el-button>
      <el-button type="primary" @click="doRename">确定</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useUiStore } from '@/stores/uiStore'
import { useConversationStore } from '@/stores/conversationStore'
import {
  Menu, Sunny, Moon, Setting, MoreFilled,
  Download, Upload, Share,
} from '@element-plus/icons-vue'

const emit = defineEmits<{
  openExport: []
  openImport: []
  openShare: []
}>()

const uiStore = useUiStore()
const conversationStore = useConversationStore()

const isMobile = ref(window.innerWidth < 768)
function onResize() { isMobile.value = window.innerWidth < 768 }
onMounted(() => window.addEventListener('resize', onResize))
onUnmounted(() => window.removeEventListener('resize', onResize))

const renameDialogVisible = ref(false)
const renameTitle = ref('')

function handleDropdown(command: string) {
  switch (command) {
    case 'export': emit('openExport'); break
    case 'import': emit('openImport'); break
    case 'share': emit('openShare'); break
  }
}

function doRename() {
  if (renameTitle.value.trim()) {
    conversationStore.renameConversation(renameTitle.value.trim())
  }
  renameDialogVisible.value = false
}
</script>

<style scoped>
.app-header {
  display: flex;
  align-items: center;
  background: var(--bg-primary);
  border-bottom: 1px solid var(--border-color);
  padding: 0 12px;
  height: 50px;
  flex-shrink: 0;
  -webkit-app-region: drag;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 4px;
  width: 100px;
  flex-shrink: 0;
  -webkit-app-region: no-drag;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 4px;
  width: 100px;
  flex-shrink: 0;
  justify-content: flex-end;
  -webkit-app-region: no-drag;
}

.header-center {
  flex: 1;
  text-align: center;
  overflow: hidden;
  line-height: 50px;
  border-radius: 6px;
  cursor: pointer;
  -webkit-app-region: no-drag;
}

.header-center:hover {
  background: var(--bg-secondary);
}

.conv-title {
  font-size: 14px;
  color: var(--text-primary);
  padding: 0 12px;
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: inline-block;
  vertical-align: middle;
}

h1.header-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.conv-title:hover {
  background: var(--bg-secondary);
}

.header-icon-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 6px;
  border-radius: 6px;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
}

.header-icon-btn:hover {
  background: var(--bg-secondary);
  color: var(--text-primary);
}
</style>

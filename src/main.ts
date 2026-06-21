import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import 'element-plus/theme-chalk/dark/css-vars.css'
import router from '@/router'
import '@/styles/global.scss'

import App from './App.vue'

// Services and stores
import { initDB } from '@/services/dbService'
import { testConnection } from '@/services/apiService'
import { decryptShareData } from '@/composables/useEncryptedShare'
import { useUiStore } from '@/stores/uiStore'
import { useConversationStore } from '@/stores/conversationStore'
import { useApiConfigStore } from '@/stores/apiConfigStore'
import { usePromptStore } from '@/stores/promptStore'
import { useConfigStore } from '@/stores/configStore'
import { useSearchStore } from '@/stores/searchStore'

async function bootstrap() {
  const app = createApp(App)

  // Pinia
  const pinia = createPinia()
  app.use(pinia)

  // Router
  app.use(router)

  // Element Plus with Chinese locale
  app.use(ElementPlus, { locale: zhCn })

  app.mount('#app')

  // Initialize DB and load data
  await initDB()

  const uiStore = useUiStore()
  uiStore.initTheme()

  const conversationStore = useConversationStore()
  await conversationStore.loadConversations()
  await conversationStore.loadActiveId()

  const apiConfigStore = useApiConfigStore()
  await apiConfigStore.loadConfigs()
  await apiConfigStore.loadActiveId()

  const promptStore = usePromptStore()
  promptStore.loadPresetPrompts()
  await promptStore.loadGroups()
  await promptStore.loadPrompts()

  const configStore = useConfigStore()
  await configStore.loadParams()
  await configStore.loadFormat()

  const searchStore = useSearchStore()
  await searchStore.load()

  // Handle visual viewport for mobile
  const vv = window.visualViewport
  if (vv) {
    const setAppHeight = () => {
      document.documentElement.style.setProperty('--app-height', `${vv.height}px`)
    }
    vv.addEventListener('resize', setAppHeight)
    setAppHeight()
  }

  // Check for shared config in URL
  const params = new URLSearchParams(window.location.search)
  const data = params.get('data')
  if (data) {
    try {
      const shareData = await decryptShareData(data)
      if (shareData.url) {
        await apiConfigStore.addConfig({
          name: shareData.name || '共享配置',
          apiUrl: shareData.url,
          apiKey: shareData.key || '',
          model: shareData.model || '',
        })
        ElMessage.success('已应用共享配置')
      }
    } catch {
      // Invalid share data, ignore
    }
    window.history.replaceState({}, '', window.location.pathname)
  }

  // Auto-test connection
  if (apiConfigStore.activeConfig?.apiUrl) {
    const cfg = apiConfigStore.activeConfig
    if (cfg) {
      apiConfigStore.updateStatus(cfg.id, 'checking')
      const result = await testConnection(cfg.apiUrl, cfg.apiKey)
      apiConfigStore.updateStatus(cfg.id, result.success ? 'online' : 'offline', result.success ? '' : result.text)
    }
  }
}

bootstrap()

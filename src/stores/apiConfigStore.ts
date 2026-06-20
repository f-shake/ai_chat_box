import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import * as db from '@/services/dbService'
import { API_CONFIGS_KEY, ACTIVE_API_CONFIG_KEY, DEFAULT_API_CONFIGS } from '@/utils/constants'
import type { ApiConfig, ApiStatus } from '@/types'
import { genId } from '@/utils/id'

export const useApiConfigStore = defineStore('apiConfig', () => {
  const configs = ref<ApiConfig[]>([])
  const activeId = ref<string | null>(null)
  const searchQuery = ref('')

  const activeConfig = computed(() => {
    return configs.value.find((c) => c.id === activeId.value) || configs.value[0] || null
  })

  const filteredConfigs = computed(() => {
    const q = searchQuery.value.toLowerCase()
    if (!q) return configs.value
    return configs.value.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.apiUrl.toLowerCase().includes(q) ||
        c.model.toLowerCase().includes(q)
    )
  })

  async function loadConfigs() {
    const raw = await db.getItem(API_CONFIGS_KEY)
    if (raw) {
      try {
        configs.value = JSON.parse(raw)
      } catch {}
    }
    // Migrate old flat config format
    if (!raw || configs.value.length === 0) {
      // Check if there's legacy flat config
      const oldUrl = await db.getItem('ai_chat_api_url')
      const oldKey = await db.getItem('ai_chat_api_key')
      const oldModel = await db.getItem('ai_chat_model')
      if (oldUrl) {
        configs.value.push({
          id: genId(),
          name: 'API',
          apiUrl: oldUrl,
          apiKey: oldKey || '',
          model: oldModel || 'gpt-3.5-turbo',
          status: 'unknown',
          statusError: '',
        })
      }
    }
    if (configs.value.length === 0) {
      configs.value = DEFAULT_API_CONFIGS.map((c) => ({ ...c, status: 'unknown' as ApiStatus, statusError: '' }))
    }
  }

  async function saveConfigs() {
    await db.setItem(API_CONFIGS_KEY, JSON.stringify(configs.value))
  }

  async function loadActiveId() {
    const id = await db.getItem(ACTIVE_API_CONFIG_KEY)
    if (id) activeId.value = id
  }

  async function saveActiveId() {
    if (activeId.value) {
      await db.setItem(ACTIVE_API_CONFIG_KEY, activeId.value)
    }
  }

  function applyConfig(id: string) {
    activeId.value = id
    saveActiveId()
  }

  async function addConfig(data: Partial<ApiConfig>) {
    const cfg: ApiConfig = {
      id: genId(),
      name: data.name || '新服务',
      apiUrl: data.apiUrl || '',
      apiKey: data.apiKey || '',
      model: data.model || '',
      status: 'unknown',
      statusError: '',
    }
    configs.value.push(cfg)
    await saveConfigs()
  }

  async function updateConfig(id: string, data: Partial<ApiConfig>) {
    const idx = configs.value.findIndex((c) => c.id === id)
    if (idx >= 0) {
      configs.value[idx] = { ...configs.value[idx], ...data }
      await saveConfigs()
    }
  }

  async function deleteConfig(id: string) {
    configs.value = configs.value.filter((c) => c.id !== id)
    if (activeId.value === id) {
      activeId.value = configs.value[0]?.id || null
      saveActiveId()
    }
    await saveConfigs()
  }

  function updateStatus(id: string, status: ApiStatus, errorMsg?: string) {
    const cfg = configs.value.find((c) => c.id === id)
    if (cfg) {
      cfg.status = status
      cfg.statusError = errorMsg || ''
    }
  }

  return {
    configs,
    activeId,
    searchQuery,
    activeConfig,
    filteredConfigs,
    loadConfigs,
    saveConfigs,
    loadActiveId,
    saveActiveId,
    applyConfig,
    addConfig,
    updateConfig,
    deleteConfig,
    updateStatus,
  }
})

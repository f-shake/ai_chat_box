import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as db from '@/services/dbService'
import { SEARCH_CONFIG_KEY } from '@/utils/constants'
import type { SearchConfig, SearchProvider } from '@/types'

export const useSearchStore = defineStore('search', () => {
  const config = ref<SearchConfig>({
    provider: 'local',
    enabled: true,
    proxyUrl: 'http://localhost:3456',
    bochaApiKey: '',
  })

  async function load() {
    const raw = await db.getItem(SEARCH_CONFIG_KEY)
    if (raw) {
      try {
        const parsed = JSON.parse(raw)
        config.value = { ...config.value, ...parsed }
      } catch {}
    }
  }

  async function save() {
    await db.setItem(SEARCH_CONFIG_KEY, JSON.stringify(config.value))
  }

  async function setEnabled(v: boolean) {
    config.value.enabled = v
    await save()
  }

  async function setProvider(p: SearchProvider) {
    config.value.provider = p
    await save()
  }

  return {
    config,
    load,
    save,
    setEnabled,
    setProvider,
  }
})

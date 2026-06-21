import { defineStore } from 'pinia'
import { ref, reactive, computed } from 'vue'
import * as db from '@/services/dbService'
import { CONFIG_KEY, FORMAT_KEY, ACTIVE_PRESET_KEY, DEFAULT_CONFIG_PARAMS, DEFAULT_FORMAT_CONFIG } from '@/utils/constants'
import type { FormatConfig } from '@/types'
import { usePromptStore } from '@/stores/promptStore'

export const useConfigStore = defineStore('config', () => {
  // Global tool toggles (independent of presets)
  const params = reactive({ ...DEFAULT_CONFIG_PARAMS })
  const format = reactive<FormatConfig>({ ...DEFAULT_FORMAT_CONFIG })

  // Active preset ID — the app always runs under a preset
  const activePresetId = ref('')

  // Resolved config from the active preset (systemPrompt, temperature, etc.)
  const activeConfig = computed(() => {
    const promptStore = usePromptStore()
    if (activePresetId.value) {
      const p = promptStore.allPrompts.find((p) => p.id === activePresetId.value)
      if (p) return p.config
    }
    // Fallback: return first available preset's config WITHOUT persisting it
    const first = promptStore.allPrompts[0]
    if (first) {
      return first.config
    }
    // Absolute fallback (shouldn't happen with built-in presets)
    return {
      systemPrompt: '',
      temperature: 0.7,
      maxTokens: 0,
      topP: 1.0,
      frequencyPenalty: 0,
      presencePenalty: 0,
      historyLimit: 20,
      reasoningEnabled: false,
    }
  })

  async function loadParams() {
    const raw = await db.getItem(CONFIG_KEY)
    if (raw) {
      try {
        const parsed = JSON.parse(raw)
        // Only merge fields that are in DEFAULT_CONFIG_PARAMS (tool toggles)
        for (const key of Object.keys(DEFAULT_CONFIG_PARAMS)) {
          if (key in parsed) {
            (params as any)[key] = parsed[key]
          }
        }
      } catch {}
    }
    // Save back to purge any old fields no longer in DEFAULT_CONFIG_PARAMS
    await saveParams()
  }

  async function saveParams() {
    await db.setItem(CONFIG_KEY, JSON.stringify({ ...params }))
  }

  function resetParams() {
    Object.assign(params, DEFAULT_CONFIG_PARAMS)
    saveParams()
  }

  async function loadActivePreset() {
    const id = await db.getItem(ACTIVE_PRESET_KEY)
    if (id) {
      activePresetId.value = id
    }
    // If no valid active preset, the activeConfig getter will auto-fix
  }

  async function setActivePresetKey(id: string) {
    activePresetId.value = id
    await db.setItem(ACTIVE_PRESET_KEY, id)
  }

  async function loadFormat() {
    const raw = await db.getItem(FORMAT_KEY)
    if (raw) {
      try {
        const parsed = JSON.parse(raw)
        Object.assign(format, parsed)
      } catch {}
    }
    applyFormatToCSS()
  }

  async function saveFormat() {
    await db.setItem(FORMAT_KEY, JSON.stringify({ ...format }))
  }

  function resetFormat() {
    Object.assign(format, DEFAULT_FORMAT_CONFIG)
    saveFormat()
    applyFormatToCSS()
  }

  function applyFormatToCSS() {
    document.documentElement.style.setProperty('--chat-font-size', `${format.fontSize}px`)
    document.documentElement.style.setProperty('--chat-line-height', `${format.lineHeight}`)
    document.documentElement.style.setProperty('--chat-msg-gap', `${format.msgGap}px`)
    document.documentElement.style.setProperty('--chat-para-gap', `${format.paraGap}px`)
    document.documentElement.style.setProperty('--chat-indent', format.indent ? '2em' : '0')
  }

  return {
    params,
    format,
    activePresetId,
    activeConfig,
    loadParams,
    saveParams,
    resetParams,
    loadActivePreset,
    setActivePresetKey,
    loadFormat,
    saveFormat,
    resetFormat,
    applyFormatToCSS,
  }
})

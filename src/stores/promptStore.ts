import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import * as db from '@/services/dbService'
import { PROMPTS_KEY, GROUPS_KEY, HIDDEN_PROMPTS_KEY, DEFAULT_CONFIG_PARAMS } from '@/utils/constants'
import type { Prompt, PromptGroup, PromptConfig } from '@/types'
import { genId } from '@/utils/id'

import presetsData from '@/../data/presets.json'

// Default groups defined in code (not in presets.json — that file is a flat array)
const DEFAULT_GROUPS: PromptGroup[] = [
  { key: 'chat', name: '聊天', builtIn: true },
  { key: 'content-transformation', name: '内容转换', builtIn: true },
  { key: 'expression-optimization', name: '表达优化', builtIn: true },
  { key: 'structural-adjustment', name: '结构调整', builtIn: true },
  { key: 'text-correction', name: '文本修正', builtIn: true },
  { key: 'text-evaluation', name: '文本评估', builtIn: true },
]

export const usePromptStore = defineStore('prompt', () => {
  const groups = ref<PromptGroup[]>([])
  const userPrompts = ref<Prompt[]>([])
  const hiddenPresetIds = ref<string[]>([])
  const presetPrompts = ref<Prompt[]>([])
  const searchQuery = ref('')

  // Load built-in presets from presets.json (flat array format)
  function loadPresetPrompts() {
    const data = presetsData as any
    // presets.json is a flat array, NOT { groups, prompts }
    const list = Array.isArray(data) ? data : (data.prompts || [])

    const items: Prompt[] = []
    for (const p of list) {
      const cfg: PromptConfig = {
        systemPrompt: p.config?.systemPrompt || p.content || '',
        temperature: p.config?.temperature ?? DEFAULT_CONFIG_PARAMS.temperature,
        maxTokens: p.config?.maxTokens ?? DEFAULT_CONFIG_PARAMS.maxTokens,
        topP: p.config?.topP ?? DEFAULT_CONFIG_PARAMS.topP,
        frequencyPenalty: p.config?.frequencyPenalty ?? DEFAULT_CONFIG_PARAMS.frequencyPenalty,
        presencePenalty: p.config?.presencePenalty ?? DEFAULT_CONFIG_PARAMS.presencePenalty,
        historyLimit: p.config?.historyLimit ?? DEFAULT_CONFIG_PARAMS.historyLimit,
        reasoningEnabled: p.config?.reasoningEnabled ?? DEFAULT_CONFIG_PARAMS.reasoningEnabled,
      }

      items.push({
        id: p.id || genId(),
        groupKey: p.groupKey || 'chat',
        title: p.title || '',
        description: p.description || '',
        builtIn: true,
        config: cfg,
        presetRef: p.id,
      })
    }

    presetPrompts.value = items
  }

  async function loadGroups() {
    // Start with defaults
    groups.value = [...DEFAULT_GROUPS]

    // Merge with user-saved groups
    const raw = await db.getItem(GROUPS_KEY)
    if (raw) {
      try {
        const saved = JSON.parse(raw)
        for (const sg of saved) {
          const existing = groups.value.find((g) => g.key === sg.key)
          if (existing) {
            // Update name but keep builtIn flag
            existing.name = sg.name
          } else {
            groups.value.push(sg)
          }
        }
      } catch {}
    }
  }

  async function loadPrompts() {
    const raw = await db.getItem(PROMPTS_KEY)
    if (raw) {
      try {
        userPrompts.value = JSON.parse(raw)
      } catch {}
    }
    const hiddenRaw = await db.getItem(HIDDEN_PROMPTS_KEY)
    if (hiddenRaw) {
      try {
        hiddenPresetIds.value = JSON.parse(hiddenRaw)
      } catch {}
    }
  }

  async function saveAll() {
    await db.setItem(PROMPTS_KEY, JSON.stringify(userPrompts.value))
    await db.setItem(GROUPS_KEY, JSON.stringify(groups.value))
    await db.setItem(HIDDEN_PROMPTS_KEY, JSON.stringify(hiddenPresetIds.value))
  }

  // Merge presets + user overrides, exclude hidden ones
  const allPrompts = computed(() => {
    const visiblePresets = presetPrompts.value.filter(
      (p) => !hiddenPresetIds.value.includes(p.id)
    )

    // Build map: presetRef/id → Prompt
    const presetMap = new Map<string, Prompt>()
    for (const p of visiblePresets) {
      presetMap.set(p.presetRef || p.id, { ...p })
    }

    // Apply user overrides
    for (const up of userPrompts.value) {
      if (up.presetRef && presetMap.has(up.presetRef)) {
        presetMap.set(up.presetRef, { ...presetMap.get(up.presetRef)!, ...up })
      } else {
        presetMap.set(up.id, up)
      }
    }

    return Array.from(presetMap.values())
  })

  const filteredPrompts = computed(() => {
    const q = searchQuery.value.toLowerCase()
    if (!q) return allPrompts.value
    return allPrompts.value.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q)
    )
  })

  const groupedPrompts = computed(() => {
    const map = new Map<string, Prompt[]>()
    for (const p of filteredPrompts.value) {
      if (!map.has(p.groupKey)) map.set(p.groupKey, [])
      map.get(p.groupKey)!.push(p)
    }

    const sorted: Array<{ group: PromptGroup; prompts: Prompt[] }> = []
    for (const g of groups.value) {
      if (map.has(g.key)) {
        sorted.push({ group: g, prompts: map.get(g.key)! })
      }
    }
    // Add prompts from unknown groups
    for (const [key, prompts] of map) {
      if (!groups.value.find((g) => g.key === key)) {
        sorted.push({
          group: { key, name: key, builtIn: false },
          prompts,
        })
      }
    }
    return sorted
  })

  async function addPrompt(p: Partial<Prompt>) {
    const prompt: Prompt = {
      id: genId(),
      groupKey: p.groupKey || 'chat',
      title: p.title || '新预设',
      description: p.description || '',
      builtIn: false,
      config: { ...DEFAULT_CONFIG_PARAMS, ...p.config },
      presetRef: p.presetRef,
    }
    userPrompts.value.push(prompt)
    await saveAll()
  }

  async function editPrompt(id: string, data: Partial<Prompt>) {
    const idx = userPrompts.value.findIndex((p) => p.id === id)
    if (idx >= 0) {
      userPrompts.value[idx] = { ...userPrompts.value[idx], ...data }
      await saveAll()
      return
    }
    // Handle preset override
    const preset = presetPrompts.value.find((p) => p.id === id)
    if (preset) {
      const existing = userPrompts.value.find((p) => p.presetRef === id)
      if (existing) {
        Object.assign(existing, data)
      } else {
        await addPrompt({ ...data, presetRef: id, groupKey: preset.groupKey })
      }
      await saveAll()
    }
  }

  async function deletePrompt(id: string) {
    const preset = presetPrompts.value.find((p) => p.id === id)
    if (preset) {
      // Hide preset
      if (!hiddenPresetIds.value.includes(id)) {
        hiddenPresetIds.value.push(id)
      }
    }
    userPrompts.value = userPrompts.value.filter((p) => p.id !== id)
    await saveAll()
  }

  async function resetAllPresets() {
    userPrompts.value = []
    hiddenPresetIds.value = []
    loadPresetPrompts()
    await saveAll()
  }

  function applyPrompt(id: string) {
    return allPrompts.value.find((p) => p.id === id) || null
  }

  async function addGroup(name: string) {
    const key = 'group_' + genId()
    groups.value.push({ key, name, builtIn: false })
    await saveAll()
    return key
  }

  async function renameGroup(key: string, name: string) {
    const g = groups.value.find((g) => g.key === key)
    if (g) {
      g.name = name
      await saveAll()
    }
  }

  async function deleteGroup(key: string) {
    groups.value = groups.value.filter((g) => g.key !== key)
    userPrompts.value = userPrompts.value.filter((p) => p.groupKey !== key)
    await saveAll()
  }

  return {
    groups,
    userPrompts,
    hiddenPresetIds,
    presetPrompts,
    searchQuery,
    allPrompts,
    filteredPrompts,
    groupedPrompts,
    loadPresetPrompts,
    loadGroups,
    loadPrompts,
    saveAll,
    addPrompt,
    editPrompt,
    deletePrompt,
    resetAllPresets,
    applyPrompt,
    addGroup,
    renameGroup,
    deleteGroup,
  }
})

import { defineStore } from 'pinia'
import { ref, reactive } from 'vue'
import * as db from '@/services/dbService'
import { CONFIG_KEY, FORMAT_KEY, DEFAULT_CONFIG_PARAMS, DEFAULT_FORMAT_CONFIG } from '@/utils/constants'
import type { FormatConfig } from '@/types'

export const useConfigStore = defineStore('config', () => {
  const params = reactive({ ...DEFAULT_CONFIG_PARAMS })
  const format = reactive<FormatConfig>({ ...DEFAULT_FORMAT_CONFIG })

  async function loadParams() {
    const raw = await db.getItem(CONFIG_KEY)
    if (raw) {
      try {
        const parsed = JSON.parse(raw)
        Object.assign(params, parsed)
      } catch {}
    }
  }

  async function saveParams() {
    await db.setItem(CONFIG_KEY, JSON.stringify({ ...params }))
  }

  function resetParams() {
    Object.assign(params, DEFAULT_CONFIG_PARAMS)
    saveParams()
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
    loadParams,
    saveParams,
    resetParams,
    loadFormat,
    saveFormat,
    resetFormat,
    applyFormatToCSS,
  }
})

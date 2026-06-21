export interface PromptConfig {
  systemPrompt: string
  temperature: number
  maxTokens: number
  topP: number
  frequencyPenalty: number
  presencePenalty: number
  historyLimit: number
  reasoningEnabled: boolean
}

export interface Prompt {
  id: string
  groupKey: string
  title: string
  description: string
  builtIn: boolean
  config: PromptConfig
  presetRef?: string
}

export interface PromptGroup {
  key: string
  name: string
  builtIn: boolean
}

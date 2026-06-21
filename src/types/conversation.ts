export interface ContentPartText {
  type: 'text'
  text: string
}

export interface ContentPartFile {
  type: 'file'
  file: {
    name: string
    content: string
    size: number
    mime: string
  }
}

export interface ContentPartImage {
  type: 'image_url'
  image_url: { url: string }
}

export type ContentPart = ContentPartText | ContentPartFile | ContentPartImage

export type MessageContent = string | ContentPart[]

export interface ToolCallFunction {
  name: string
  arguments: string
}

export interface ToolCall {
  id: string
  type: 'function'
  function: ToolCallFunction
}

export interface Message {
  role: 'user' | 'assistant' | 'system' | 'system-msg' | 'tool' | 'system-prompt'
  content: MessageContent | null
  reasoning_content?: string
  tool_calls?: ToolCall[]
  tool_call_id?: string
}

import type { PromptConfig } from './prompt'

export interface Conversation {
  id: string
  title: string
  messages: Message[]
  createdAt: string
  updatedAt: string
  systemPrompt?: string
  snapshot?: {
    presetName: string
    config: PromptConfig
  }
  _aiTitle?: boolean
}

export interface ToolResult {
  role: 'tool'
  tool_call_id: string
  content: string
}

export interface StreamCallbacks {
  onContent: (text: string) => void
  onReasoning: (text: string) => void
  onToolCallChunk: (index: number, delta: Partial<ToolCall>) => void
  onFinish: (reason: string | null, toolCalls: ToolCall[]) => Promise<void>
  onError: (error: Error) => void
}

export interface PendingFile {
  id: string
  name: string
  size: number
  mime: string
  content: string
  _type: 'text' | 'image' | 'docx'
}

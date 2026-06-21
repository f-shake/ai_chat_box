import type { ContentPart, MessageContent } from '@/types'

/**
 * Convert stored message content to API-ready format.
 * String → string (plain text)
 * Array → ContentPart[] (text, image_url)
 * Note: `type: 'file'` is not supported by standard OpenAI-compatible APIs,
 * so file content is embedded as a text block instead.
 */
export function flattenContentForApi(content: MessageContent): string | ContentPart[] {
  if (typeof content === 'string') return content
  if (!content) return ''
  return content.map((part) => {
    if (part.type === 'file') {
      const size = formatBytes(part.file.size)
      return {
        type: 'text' as const,
        text: `[文件] ${part.file.name} (${size})\n\`\`\`\n${part.file.content}\n\`\`\``,
      }
    }
    if (part.type === 'image_url') {
      return { type: 'image_url', image_url: { url: part.image_url.url } }
    }
    return { type: 'text', text: part.text }
  })
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

import type { ContentPart, MessageContent } from '@/types'

/**
 * Convert stored message content to API-ready format.
 * String → string (plain text)
 * Array → ContentPart[] (text, file, image_url)
 */
export function flattenContentForApi(content: MessageContent): string | ContentPart[] {
  if (typeof content === 'string') return content
  if (!content) return ''
  return content.map((part) => {
    if (part.type === 'file') {
      return {
        type: 'file',
        file: {
          name: part.file.name,
          content: part.file.content,
          size: part.file.size,
          mime: part.file.mime,
        },
      }
    }
    if (part.type === 'image_url') {
      return { type: 'image_url', image_url: { url: part.image_url.url } }
    }
    return { type: 'text', text: part.text }
  })
}

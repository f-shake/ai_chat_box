import { marked } from 'marked'

marked.setOptions({
  breaks: true,
  gfm: true,
})

export async function formatContent(text: string): Promise<string> {
  if (!text) return ''
  const result = await marked.parse(text)
  return result as string
}

export function extractTextParts(content: string | any[] | null | undefined): string {
  if (!content) return ''
  if (typeof content === 'string') return content
  return content
    .filter((p: any) => p.type === 'text')
    .map((p: any) => p.text)
    .join(' ')
    .trim()
}

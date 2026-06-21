import { marked } from 'marked'
import katex from 'katex'
import 'katex/dist/katex.min.css'

marked.setOptions({
  breaks: true,
  gfm: true,
})

/**
 * Render LaTeX math expressions ($$...$$ and $...$) in text to HTML via KaTeX.
 */
function renderLatex(text: string): string {
  // Block math: $$ ... $$
  let result = text.replace(/\$\$([\s\S]*?)\$\$/g, (_m: string, expr: string) => {
    try {
      return katex.renderToString(expr.trim(), { displayMode: true, throwOnError: false })
    } catch {
      return `<div class="math-error">${_m}</div>`
    }
  })
  // Inline math: $...$  where content contains at least one math operator/symbol (not pure digits+commas)
  result = result.replace(/\$([^$\n]{1,80}?)\$/g, (_m: string, expr: string) => {
    const trimmed = expr.trim()
    // If it's just digits and commas (e.g. $1,000), treat as currency, not math
    if (/^[\d,.\s]+$/.test(trimmed)) return _m
    try {
      return katex.renderToString(trimmed, { displayMode: false, throwOnError: false })
    } catch {
      return _m
    }
  })
  return result
}

export async function formatContent(text: string): Promise<string> {
  if (!text) return ''
  const withMath = renderLatex(text)
  const result = await marked.parse(withMath)
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

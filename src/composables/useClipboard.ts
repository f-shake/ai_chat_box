import { formatContent } from '@/utils/formatContent'

export function useClipboard() {
  async function copyRich(plainText: string, htmlContent: string): Promise<void> {
    try {
      if (navigator.clipboard.write) {
        const wrappedHtml = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head><body>${htmlContent}</body></html>`
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/plain': new Blob([plainText], { type: 'text/plain' }),
            'text/html': new Blob([wrappedHtml], { type: 'text/html' }),
          }),
        ])
      } else {
        await navigator.clipboard.writeText(plainText)
      }
    } catch {
      // Fallback
      await navigator.clipboard.writeText(plainText)
    }
  }

  async function copyPlain(text: string): Promise<void> {
    await navigator.clipboard.writeText(text)
  }

  function extractPlainFromHtml(html: string): string {
    const div = document.createElement('div')
    div.innerHTML = html
    // Remove UI elements
    div.querySelectorAll('.msg-action-btn, .timestamp, .collapse-toggle, .bubble-footer').forEach(el => el.remove())
    return div.textContent || ''
  }

  /**
   * Strip reasoning/thinking blocks from markdown content
   */
  function stripReasoning(text: string): string {
    return text.replace(/<details[^>]*>[\s\S]*?<\/details>\s*/g, '').trim()
  }

  /**
   * Get plain text from a message DOM element, stripping UI elements
   */
  function getPlainTextFromElement(el: HTMLElement): string {
    const clone = el.cloneNode(true) as HTMLElement
    clone.querySelectorAll('.msg-action-btn, .timestamp, .collapse-toggle, .bubble-footer, .copy-menu, .split-copy-wrap').forEach(el => el.remove())
    return clone.textContent?.trim() || ''
  }

  return {
    copyRich,
    copyPlain,
    extractPlainFromHtml,
    stripReasoning,
    getPlainTextFromElement,
  }
}

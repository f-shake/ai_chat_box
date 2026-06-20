export function replacePromptPlaceholders(text: string): string {
  const now = new Date()
  const dateStr = now.toLocaleDateString('zh-CN', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
  })
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone

  return text
    .replace(/\{\{current_time\}\}/g, dateStr)
    .replace(/\{\{timezone\}\}/g, tz)
}

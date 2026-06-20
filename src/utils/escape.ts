export function escapeHtml(str: string): string {
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

const FILE_ICONS: Record<string, string> = {
  md: 'MD',
  txt: 'TXT',
  csv: 'CSV',
  json: 'JSON',
  xml: 'XML',
  js: 'JS',
  py: 'PY',
  html: 'HTML',
  css: 'CSS',
  yaml: 'YAML',
  yml: 'YML',
  toml: 'TOML',
  docx: 'DOCX',
}

export function getFileIcon(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || ''
  return FILE_ICONS[ext] || 'FILE'
}

export function getFileCategory(file: File): 'text' | 'image' | 'docx' | 'other' {
  if (file.type.startsWith('image/')) return 'image'
  if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      file.name.endsWith('.docx')) return 'docx'
  return 'text'
}

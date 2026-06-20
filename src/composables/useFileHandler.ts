import { getFileCategory, getFileIcon } from '@/utils/escape'
import { MAX_IMAGE_SIZE, MAX_FILE_SIZE, MAX_IMAGE_DIMENSION, IMAGE_QUALITY } from '@/utils/constants'
import type { PendingFile } from '@/types'

export function useFileHandler() {
  async function readFileAsContent(file: File): Promise<PendingFile> {
    const category = getFileCategory(file)
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8)

    // Validate size
    if (category === 'image' && file.size > MAX_IMAGE_SIZE) {
      throw new Error(`图片文件过大：${(file.size / 1024 / 1024).toFixed(1)}MB（限制 ${MAX_IMAGE_SIZE / 1024 / 1024}MB）`)
    }
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`文件过大：${(file.size / 1024 / 1024).toFixed(1)}MB（限制 ${MAX_FILE_SIZE / 1024 / 1024}MB）`)
    }

    const base: PendingFile = {
      id,
      name: file.name,
      size: file.size,
      mime: file.type,
      content: '',
      _type: 'text',
    }

    if (category === 'image') {
      base.content = await compressImage(file)
      base._type = 'image'
      base.mime = 'image/jpeg'
    } else if (category === 'docx') {
      const arrayBuffer = await readAsArrayBuffer(file)
      const mammoth = await import('mammoth')
      const result = await mammoth.extractRawText({ arrayBuffer })
      base.content = result.value || '(无法解析此 DOCX 文件内容)'
      base._type = 'text'
    } else {
      base.content = await readAsText(file)
      base._type = 'text'
    }

    return base
  }

  function readAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(new Error('读取文件失败'))
      reader.readAsText(file, 'utf-8')
    })
  }

  function readAsArrayBuffer(file: File): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as ArrayBuffer)
      reader.onerror = () => reject(new Error('读取文件失败'))
      reader.readAsArrayBuffer(file)
    })
  }

  function compressImage(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        let { width, height } = img
        if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
          const ratio = Math.min(MAX_IMAGE_DIMENSION / width, MAX_IMAGE_DIMENSION / height)
          width = Math.floor(width * ratio)
          height = Math.floor(height * ratio)
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, width, height)
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(file.type ? `data:${file.type};base64,` : '')
              return
            }
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result as string)
            reader.readAsDataURL(blob)
          },
          'image/jpeg',
          IMAGE_QUALITY
        )
      }
      img.onerror = () => reject(new Error('图片解析失败'))
      img.src = URL.createObjectURL(file)
    })
  }

  function getFileEmoji(name: string): string {
    return getFileIcon(name)
  }

  return {
    readFileAsContent,
    readAsText,
    compressImage,
    getFileEmoji,
  }
}

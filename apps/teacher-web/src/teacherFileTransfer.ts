const maximumAttachmentBytes = 10 * 1024 * 1024

const mimeTypeByExtension: Readonly<Record<string, string>> = {
  '.pdf': 'application/pdf',
  '.docx':
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
}

const allowedMimeTypes = new Set(Object.values(mimeTypeByExtension))

export function teacherAttachmentMimeType(file: File): string {
  const browserType = file.type.trim().toLowerCase()
  if (allowedMimeTypes.has(browserType)) return browserType
  const dot = file.name.lastIndexOf('.')
  const extension = dot >= 0 ? file.name.slice(dot).toLowerCase() : ''
  return mimeTypeByExtension[extension] ?? browserType
}

export function validateTeacherAttachment(file: File): string {
  const mimeType = teacherAttachmentMimeType(file)
  if (!allowedMimeTypes.has(mimeType)) {
    throw new Error('附件仅支持 PDF、DOCX、JPG 或 PNG')
  }
  if (file.size === 0) throw new Error('附件内容不能为空')
  if (file.size > maximumAttachmentBytes) {
    throw new Error('单个附件不能超过 10 MB')
  }
  return mimeType
}

export function saveTeacherDownload(blob: Blob, originalName: string): void {
  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = originalName
  link.style.display = 'none'
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0)
}

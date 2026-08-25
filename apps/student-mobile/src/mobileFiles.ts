import type { FileSummary } from '@k12/shared'

import { mobileStudentClient, type MobileFileInput } from './mobileClient'
import { validateAttachment } from './mobilePresentation'

interface FileReaderResult {
  result: string | null
}

interface PlusFileReader {
  result: string | null
  onloadend: ((event: FileReaderResult) => void) | null
  onerror: (() => void) | null
  readAsDataURL(file: unknown): void
}

interface PlusRuntime {
  io: {
    FileReader: new () => PlusFileReader
    resolveLocalFileSystemURL(
      path: string,
      success: (entry: { file(callback: (file: unknown) => void): void }) => void,
      failure: () => void,
    ): void
  }
}

declare const plus: PlusRuntime
declare const wx: {
  chooseMessageFile(options: {
    count: number
    type: 'file'
    extension: string[]
    success(result: {
      tempFiles: Array<{ path: string; name: string; size: number }>
    }): void
    fail(): void
  }): void
  getFileSystemManager(): {
    readFile(options: {
      filePath: string
      encoding: 'base64'
      success(result: { data: string | ArrayBuffer }): void
      fail(): void
    }): void
  }
}

function mimeType(name: string): string {
  const extension = name.split('.').at(-1)?.toLowerCase()
  if (extension === 'pdf') return 'application/pdf'
  if (extension === 'docx') {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  }
  if (extension === 'png') return 'image/png'
  return 'image/jpeg'
}

function imageName(path: string, index: number): string {
  const suffix = path.toLowerCase().includes('.png') ? 'png' : 'jpg'
  return `作业照片-${index + 1}.${suffix}`
}

async function appFileBase64(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    plus.io.resolveLocalFileSystemURL(
      path,
      (entry) => {
        entry.file((file) => {
          const reader = new plus.io.FileReader()
          reader.onloadend = (event) => {
            const value = event.result ?? reader.result
            const comma = value?.indexOf(',') ?? -1
            if (!value || comma < 0) reject(new Error('无法读取所选图片'))
            else resolve(value.slice(comma + 1))
          }
          reader.onerror = () => reject(new Error('无法读取所选图片'))
          reader.readAsDataURL(file)
        })
      },
      () => reject(new Error('无法读取所选图片')),
    )
  })
}

async function miniProgramFileBase64(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    wx.getFileSystemManager().readFile({
      filePath: path,
      encoding: 'base64',
      success(result) {
        if (typeof result.data === 'string') resolve(result.data)
        else reject(new Error('无法读取所选文件'))
      },
      fail() {
        reject(new Error('无法读取所选文件'))
      },
    })
  })
}

async function readBase64(path: string): Promise<string> {
  // #ifdef APP-PLUS
  return appFileBase64(path)
  // #endif
  // #ifdef MP-WEIXIN
  return miniProgramFileBase64(path)
  // #endif
  throw new Error('当前平台暂不支持读取附件')
}

async function fileSize(path: string): Promise<number> {
  return new Promise((resolve, reject) => {
    uni.getFileInfo({
      filePath: path,
      success(result) {
        resolve(result.size)
      },
      fail() {
        reject(new Error('无法读取附件大小'))
      },
    })
  })
}

async function prepareFile(
  path: string,
  name: string,
  knownSize?: number,
): Promise<MobileFileInput> {
  const type = mimeType(name)
  const size = knownSize ?? (await fileSize(path))
  const error = validateAttachment(name, type, size)
  if (error) throw new Error(error)
  return {
    name,
    mimeType: type,
    byteSize: size,
    base64: await readBase64(path),
  }
}

export async function chooseImages(): Promise<MobileFileInput[]> {
  const paths = await new Promise<string[]>((resolve, reject) => {
    uni.chooseImage({
      count: 3,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success(result) {
        resolve(
          Array.isArray(result.tempFilePaths)
            ? result.tempFilePaths
            : [result.tempFilePaths],
        )
      },
      fail() {
        reject(new Error('没有选择图片'))
      },
    })
  })
  return Promise.all(
    paths.map((path, index) => prepareFile(path, imageName(path, index))),
  )
}

export async function chooseWechatFiles(): Promise<MobileFileInput[]> {
  // #ifdef MP-WEIXIN
  const files = await new Promise<
    Array<{ path: string; name: string; size: number }>
  >((resolve, reject) => {
    wx.chooseMessageFile({
      count: 3,
      type: 'file',
      extension: ['pdf', 'docx', 'jpg', 'jpeg', 'png'],
      success(result) {
        resolve(result.tempFiles)
      },
      fail() {
        reject(new Error('没有选择文件'))
      },
    })
  })
  return Promise.all(
    files.map((file) => prepareFile(file.path, file.name, file.size)),
  )
  // #endif
  throw new Error('请在微信小程序中选择聊天文件')
}

export async function uploadSelectedFiles(
  files: readonly MobileFileInput[],
): Promise<FileSummary[]> {
  const uploaded: FileSummary[] = []
  for (const file of files) {
    uploaded.push(await mobileStudentClient.uploadFile(file))
  }
  return uploaded
}

export async function downloadAndOpen(
  file: FileSummary,
): Promise<void> {
  const path = await mobileStudentClient.downloadFile(file.id)
  await new Promise<void>((resolve, reject) => {
    uni.openDocument({
      filePath: path,
      showMenu: true,
      success() {
        resolve()
      },
      fail() {
        reject(new Error('文件已下载，但暂时无法打开'))
      },
    })
  })
}

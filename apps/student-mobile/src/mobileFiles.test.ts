import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import {
  chooseImagePaths,
  imagePickerErrorMessage,
  type ImageSource,
} from './mobileFiles'

function picker(result: string | Error) {
  return {
    chooseImage(options: {
      count: number
      sourceType: ImageSource[]
      success(value: { tempFilePaths: string[] }): void
      fail(value: { errMsg: string }): void
    }) {
      if (result instanceof Error) options.fail({ errMsg: result.message })
      else options.success({ tempFilePaths: [result] })
    },
  }
}

test('拍照只打开相机且限制单张图片', async () => {
  let received: { count: number; sourceType: ImageSource[] } | null = null
  const paths = await chooseImagePaths('camera', {
    chooseImage(options) {
      received = { count: options.count, sourceType: options.sourceType }
      options.success({ tempFilePaths: ['camera-photo.jpg'] })
    },
  })
  assert.deepEqual(received, { count: 1, sourceType: ['camera'] })
  assert.deepEqual(paths, ['camera-photo.jpg'])
})

test('相册选择与拍照使用独立来源', async () => {
  const paths = await chooseImagePaths('album', picker('album-photo.png'))
  assert.deepEqual(paths, ['album-photo.png'])
})

test('相机取消和权限失败显示中文操作提示', async () => {
  assert.equal(imagePickerErrorMessage('camera', 'chooseImage:fail cancel'), '已取消拍照')
  await assert.rejects(
    chooseImagePaths('camera', picker(new Error('permission denied'))),
    /手机或微信设置中允许使用相机/,
  )
})

test('APP 打包配置同时包含相机原生模块和 Android 权限', () => {
  const manifest = JSON.parse(
    readFileSync(new URL('./manifest.json', import.meta.url), 'utf8'),
  ) as {
    'app-plus': {
      modules?: Record<string, unknown>
      distribute?: { android?: { permissions?: string[] } }
    }
  }
  const permissions = manifest['app-plus'].distribute?.android?.permissions ?? []
  assert.ok(manifest['app-plus'].modules?.Camera)
  assert.ok(permissions.some((item) => item.includes('android.permission.CAMERA')))
  assert.ok(permissions.some((item) => item.includes('android.hardware.camera.any')))
})

<script setup lang="ts">
import type { FileSummary } from '@k12/shared'
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'

import {
  chooseImages,
  chooseWechatFiles,
  downloadAndOpen,
  uploadSelectedFiles,
} from '../../mobileFiles'
import type { MobileFileInput } from '../../mobileClient'
import {
  assignmentStatusLabel,
  latestSubmission,
} from '../../mobilePresentation'
import { mobileSession } from '../../mobileSession'
import { mobileStudentClient } from '../../mobileClient'

const assignmentId = ref(0)
const content = ref('')
const selectedFiles = ref<MobileFileInput[]>([])
const submitting = ref(false)
const downloadingId = ref<number | null>(null)
const message = ref('')

onLoad(async (query) => {
  assignmentId.value = Number(query?.id ?? 0)
  if (!Number.isInteger(assignmentId.value) || assignmentId.value <= 0) {
    message.value = '作业编号无效'
    return
  }
  try { await mobileSession.loadOverview() } catch { /* visible state */ }
})

const assignment = computed(() => mobileSession.state.overview?.assignments
  .find((item) => item.id === assignmentId.value) ?? null)
const submissions = computed(() => (mobileSession.state.overview?.submissions ?? [])
  .filter((item) => item.assignmentId === assignmentId.value)
  .sort((left, right) => left.attempt - right.attempt))
const current = computed(() => latestSubmission(submissions.value, assignmentId.value))
const canSubmit = computed(() => !current.value || current.value.status === 'REVISION_REQUIRED')

async function addImages(): Promise<void> {
  message.value = ''
  try { selectedFiles.value.push(...await chooseImages()) }
  catch (error) { message.value = error instanceof Error ? error.message : '选择图片失败' }
}

async function addWechatFiles(): Promise<void> {
  message.value = ''
  try { selectedFiles.value.push(...await chooseWechatFiles()) }
  catch (error) { message.value = error instanceof Error ? error.message : '选择文件失败' }
}

async function openAttachment(file: FileSummary): Promise<void> {
  if (downloadingId.value !== null) return
  downloadingId.value = file.id
  message.value = ''
  try { await downloadAndOpen(file) }
  catch (error) { message.value = error instanceof Error ? error.message : '文件下载失败' }
  finally { downloadingId.value = null }
}

async function submit(): Promise<void> {
  if (!assignment.value || submitting.value) return
  if (!content.value.trim() && selectedFiles.value.length === 0) {
    message.value = '请填写作业内容或选择附件'
    return
  }
  submitting.value = true
  message.value = ''
  try {
    const attachments = await uploadSelectedFiles(selectedFiles.value)
    await mobileStudentClient.submitWork({
      assignmentId: assignment.value.id,
      content: content.value.trim(),
      attachments,
    })
    content.value = ''
    selectedFiles.value = []
    await mobileSession.loadOverview(true)
    message.value = '作业提交成功'
  } catch (error) {
    message.value = error instanceof Error ? error.message : '提交失败，请稍后重试'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <view class="page detail-page">
    <view v-if="!assignment" class="card empty-state">{{ message || '作业加载中…' }}</view>
    <template v-else>
      <view class="hero-card">
        <view class="hero-head"><text>作业 #{{ assignment.id }}</text><text class="status">{{ assignmentStatusLabel(current?.status ?? 'NOT_SUBMITTED') }}</text></view>
        <text class="detail-title">{{ assignment.title }}</text>
        <text class="detail-copy">{{ assignment.description }}</text>
        <view class="meta"><text>截止：{{ new Date(assignment.dueAt).toLocaleString('zh-CN') }}</text><text>{{ assignment.allowLate ? '允许迟交' : '截止后不可提交' }}</text></view>
      </view>

      <view v-if="assignment.attachments.length" class="card">
        <text class="section-title">老师提供的附件</text>
        <view v-for="file in assignment.attachments" :key="file.id" class="file-row"><view><strong>{{ file.originalName }}</strong><text>{{ Math.max(1, Math.ceil(file.byteSize / 1024)) }} KB</text></view><button @click="openAttachment(file)">{{ downloadingId === file.id ? '下载中…' : '打开' }}</button></view>
      </view>

      <view v-if="submissions.length" class="card">
        <text class="section-title">提交与批改记录</text>
        <view v-for="item in submissions" :key="item.id" class="history-item">
          <view class="history-head"><strong>第 {{ item.attempt }} 次提交</strong><text>{{ assignmentStatusLabel(item.status) }}</text></view>
          <text class="history-content">{{ item.content || '以附件形式提交' }}</text>
          <view v-for="file in item.attachments" :key="file.id" class="history-file" @click="openAttachment(file)">附件：{{ file.originalName }}</view>
          <view v-if="item.score != null" class="grade"><strong>{{ item.score }} 分</strong><text>{{ item.teacherComment || '老师暂未填写评语' }}</text></view>
        </view>
      </view>

      <view v-if="canSubmit" class="card submit-card">
        <text class="section-title">{{ current?.status === 'REVISION_REQUIRED' ? '提交订正' : '提交作业' }}</text>
        <textarea v-model="content" maxlength="4000" placeholder="填写解题过程、答案或学习说明" />
        <view class="file-actions"><button class="secondary-button" :disabled="submitting" @click="addImages">拍照或选择图片</button><!-- #ifdef MP-WEIXIN --><button class="secondary-button" :disabled="submitting" @click="addWechatFiles">选择微信文件</button><!-- #endif --></view>
        <view v-if="selectedFiles.length" class="selected-files"><view v-for="(file,index) in selectedFiles" :key="`${file.name}-${index}`"><text>{{ file.name }}</text><button @click="selectedFiles.splice(index,1)">移除</button></view></view>
        <view v-if="message" class="status-message">{{ message }}</view>
        <button class="primary-button submit-button" :disabled="submitting" @click="submit">{{ submitting ? '正在上传并提交…' : '确认提交' }}</button>
      </view>
      <view v-else-if="message" class="status-message">{{ message }}</view>
    </template>
  </view>
</template>

<style scoped>
.hero-card { padding: 34rpx; border-radius: 30rpx; color: #fff; background: linear-gradient(145deg,#6259df,#4640b6); }
.hero-head,.meta,.history-head { display: flex; justify-content: space-between; gap: 20rpx; }
.hero-head { font-size: 23rpx; opacity: .9; }
.status { padding: 8rpx 16rpx; border-radius: 999rpx; background: rgba(255,255,255,.18); font-weight: 700; }
.detail-title,.detail-copy,.section-title,.history-content,.grade text { display: block; }
.detail-title { margin-top: 28rpx; font-size: 42rpx; font-weight: 800; }
.detail-copy { margin-top: 18rpx; font-size: 27rpx; line-height: 1.7; opacity: .9; }
.meta { margin-top: 30rpx; padding-top: 22rpx; border-top: 1rpx solid rgba(255,255,255,.22); font-size: 22rpx; }
.section-title { margin-bottom: 22rpx; font-size: 31rpx; font-weight: 800; }
.file-row { display: flex; align-items: center; justify-content: space-between; gap: 20rpx; padding: 20rpx 0; border-top: 1rpx solid #edf0f5; }
.file-row view { display: flex; min-width: 0; flex-direction: column; gap: 8rpx; }
.file-row text { color: #8591a3; font-size: 22rpx; }
.file-row button,.selected-files button { flex: none; margin: 0; color: #5b52d9; background: #eeecff; font-size: 23rpx; }
.history-item { padding: 24rpx 0; border-top: 1rpx solid #edf0f5; }
.history-head text { color: #5b52d9; font-size: 23rpx; }
.history-content { margin-top: 14rpx; color: #66758b; font-size: 25rpx; line-height: 1.6; }
.history-file { margin-top: 12rpx; color: #5b52d9; font-size: 23rpx; }
.grade { display: flex; gap: 20rpx; margin-top: 18rpx; padding: 20rpx; border-radius: 18rpx; background: #f1f8f5; }
.grade strong { color: #1f7a62; font-size: 30rpx; }
.grade text { flex: 1; color: #5e6f82; font-size: 24rpx; }
.submit-card textarea { width: 100%; min-height: 220rpx; box-sizing: border-box; padding: 24rpx; border: 1rpx solid #dfe5ee; border-radius: 20rpx; background: #f8fafc; font-size: 26rpx; }
.file-actions { display: flex; gap: 16rpx; margin-top: 20rpx; }
.file-actions button { flex: 1; font-size: 24rpx; }
.selected-files { margin-top: 18rpx; }
.selected-files view { display: flex; align-items: center; justify-content: space-between; gap: 16rpx; padding: 14rpx 0; font-size: 23rpx; }
.submit-button { margin-top: 24rpx; }
</style>

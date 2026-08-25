<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'

import { downloadAndOpen } from '../../mobileFiles'
import { filterCourseware } from '../../mobilePresentation'
import { mobileSession } from '../../mobileSession'

const query = ref('')
const downloadingId = ref<number | null>(null)
const message = ref('')

onShow(async () => {
  if (!mobileSession.state.user) return uni.reLaunch({ url: '/pages/login/index' })
  try { await mobileSession.loadOverview() } catch { /* visible state */ }
})

const materials = computed(() => filterCourseware(
  mobileSession.state.overview?.courseware ?? [], query.value))

async function openFile(file: Parameters<typeof downloadAndOpen>[0]): Promise<void> {
  if (downloadingId.value !== null) return
  downloadingId.value = file.id
  message.value = ''
  try {
    await downloadAndOpen(file)
  } catch (error) {
    message.value = error instanceof Error ? error.message : '文件下载失败'
  } finally {
    downloadingId.value = null
  }
}
</script>

<template>
  <view class="page">
    <text class="eyebrow">随时复习</text>
    <text class="page-title">课程资料</text>
    <view class="search-box"><text>⌕</text><input v-model="query" placeholder="搜索课件标题或说明" /></view>
    <view v-if="message" class="status-message">{{ message }}</view>
    <view v-if="mobileSession.state.loading && !mobileSession.state.overview" class="card empty-state">课件加载中…</view>
    <view v-else-if="materials.length === 0" class="card empty-state">{{ query.trim() ? '没有匹配的课件' : '暂无课件，老师发布后会自动显示' }}</view>
    <view v-for="material in materials" :key="material.id" class="card material-card">
      <view class="material-head"><view><text class="course-tag">课程 #{{ material.courseId }}</text><strong>{{ material.title }}</strong></view><text class="date">{{ new Date(material.publishedAt).toLocaleDateString('zh-CN') }}</text></view>
      <text class="description">{{ material.description }}</text>
      <view v-if="material.attachments.length" class="attachments">
        <view v-for="file in material.attachments" :key="file.id" class="file-row">
          <view class="file-copy"><strong>{{ file.originalName }}</strong><text>{{ Math.max(1, Math.ceil(file.byteSize / 1024)) }} KB</text></view>
          <button class="download" :disabled="downloadingId !== null" @click="openFile(file)">{{ downloadingId === file.id ? '下载中…' : '打开' }}</button>
        </view>
      </view>
      <text v-else class="muted no-file">本课件没有附件</text>
    </view>
  </view>
</template>

<style scoped>
.page-title,.material-head text,.material-head strong,.description,.no-file { display: block; }
.search-box { display: flex; align-items: center; gap: 16rpx; height: 88rpx; margin-top: 32rpx; padding: 0 26rpx; border: 1rpx solid #dfe5ee; border-radius: 22rpx; background: #fff; }
.search-box input { flex: 1; font-size: 27rpx; }
.material-card { margin-top: 22rpx; }
.material-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 20rpx; }
.course-tag { margin-bottom: 10rpx; color: #5b52d9; font-size: 22rpx; font-weight: 700; }
.material-head strong { font-size: 32rpx; }
.date { color: #8793a4; font-size: 22rpx; }
.description { margin-top: 20rpx; color: #65748a; font-size: 26rpx; line-height: 1.7; }
.attachments { margin-top: 24rpx; border-top: 1rpx solid #edf0f5; }
.file-row { display: flex; align-items: center; justify-content: space-between; gap: 16rpx; padding-top: 22rpx; }
.file-copy { display: flex; min-width: 0; flex-direction: column; gap: 8rpx; }
.file-copy strong { overflow: hidden; font-size: 25rpx; text-overflow: ellipsis; white-space: nowrap; }
.file-copy text { color: #8a95a5; font-size: 22rpx; }
.download { flex: none; margin: 0; padding: 0 24rpx; color: #5b52d9; background: #eeecff; font-size: 24rpx; font-weight: 700; }
.no-file { margin-top: 22rpx; font-size: 24rpx; }
</style>

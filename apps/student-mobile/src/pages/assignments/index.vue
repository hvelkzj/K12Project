<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'

import {
  assignmentRows,
  assignmentStatusLabel,
  type MobileAssignmentStatus,
} from '../../mobilePresentation'
import { mobileSession } from '../../mobileSession'

type Filter = 'ALL' | MobileAssignmentStatus
const activeFilter = ref<Filter>('ALL')
const filters: Array<{ value: Filter; label: string }> = [
  { value: 'ALL', label: '全部' },
  { value: 'NOT_SUBMITTED', label: '待提交' },
  { value: 'SUBMITTED', label: '已提交' },
  { value: 'GRADED', label: '已批改' },
  { value: 'REVISION_REQUIRED', label: '待订正' },
]

onShow(async () => {
  if (!mobileSession.state.user) return uni.reLaunch({ url: '/pages/login/index' })
  try { await mobileSession.loadOverview(true) } catch { /* visible state */ }
})

const rows = computed(() => {
  const overview = mobileSession.state.overview
  if (!overview) return []
  const all = assignmentRows(overview)
  return activeFilter.value === 'ALL'
    ? all
    : all.filter((item) => item.status === activeFilter.value)
})

function openAssignment(assignmentId: number): void {
  uni.navigateTo({ url: `/pages/assignment-detail/index?id=${assignmentId}` })
}
</script>

<template>
  <view class="page">
    <text class="eyebrow">学习任务</text>
    <text class="page-title title">我的作业</text>
    <scroll-view scroll-x class="filter-scroll" :show-scrollbar="false">
      <view class="filters">
        <button v-for="filter in filters" :key="filter.value" class="filter" :class="{ active: activeFilter === filter.value }" @click="activeFilter = filter.value">{{ filter.label }}</button>
      </view>
    </scroll-view>
    <view v-if="mobileSession.state.loading && !mobileSession.state.overview" class="card empty-state">作业加载中…</view>
    <view v-else-if="mobileSession.state.error && !mobileSession.state.overview" class="card empty-state">{{ mobileSession.state.error }}</view>
    <view v-else-if="rows.length === 0" class="card empty-state">当前分类没有作业</view>
    <view v-for="row in rows" :key="row.assignment.id" class="card assignment-card" @click="openAssignment(row.assignment.id)">
      <view class="assignment-head"><text class="course">课程 #{{ row.assignment.courseId }}</text><text class="status">{{ assignmentStatusLabel(row.status) }}</text></view>
      <text class="assignment-title">{{ row.assignment.title }}</text>
      <text class="description">{{ row.assignment.description }}</text>
      <view class="assignment-foot"><text>{{ new Date(row.assignment.dueAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) }} 截止</text><text>查看详情 →</text></view>
    </view>
  </view>
</template>

<style scoped>
.title,.assignment-card text { display: block; }
.filter-scroll { width: 100%; margin-top: 30rpx; white-space: nowrap; }
.filters { display: inline-flex; gap: 14rpx; padding: 2rpx; }
.filter { min-width: 132rpx; margin: 0; padding: 0 24rpx; color: #6c7a90; background: #fff; font-size: 24rpx; font-weight: 700; }
.filter.active { color: #fff; background: #5b52d9; }
.assignment-card { margin-top: 22rpx; }
.assignment-head,.assignment-foot { display: flex; align-items: center; justify-content: space-between; }
.course { color: #5b52d9; font-size: 22rpx; font-weight: 700; }
.status { padding: 8rpx 16rpx; border-radius: 999rpx; color: #1f7a62; background: #e8f6f0; font-size: 22rpx; font-weight: 700; }
.assignment-title { margin-top: 18rpx; font-size: 32rpx; font-weight: 800; }
.description { margin-top: 14rpx; color: #68778c; font-size: 25rpx; line-height: 1.6; }
.assignment-foot { margin-top: 26rpx; padding-top: 22rpx; border-top: 1rpx solid #edf0f5; color: #8793a5; font-size: 22rpx; }
</style>

<script setup lang="ts">
import { computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'

import { mobileSession } from '../../mobileSession'
import {
  formatChinaDateTime,
  formatChinaShortDateTime,
} from '../../mobileDateTime'
import {
  assignmentRows,
  assignmentStatusLabel,
  attendanceStatusLabel,
  attendanceSummary,
} from '../../mobilePresentation'

onShow(async () => {
  if (!mobileSession.state.user) {
    uni.reLaunch({ url: '/pages/login/index' })
    return
  }
  try {
    await mobileSession.loadOverview()
  } catch {
    // The page renders the session error with a retry action.
  }
})

const overview = computed(() => mobileSession.state.overview)
const rows = computed(() => overview.value ? assignmentRows(overview.value) : [])
const pending = computed(() => rows.value.filter((item) =>
  item.status === 'NOT_SUBMITTED' || item.status === 'REVISION_REQUIRED').length)
const attendance = computed(() => attendanceSummary(overview.value?.attendance ?? []))
const recentAttendance = computed(() => [...(overview.value?.attendance ?? [])]
  .sort((left, right) => Date.parse(right.recordedAt) - Date.parse(left.recordedAt))
  .slice(0, 3))

async function retry(): Promise<void> {
  try { await mobileSession.loadOverview(true) } catch { /* visible error */ }
}

function openAssignment(assignmentId: number): void {
  uni.navigateTo({ url: `/pages/assignment-detail/index?id=${assignmentId}` })
}
</script>

<template>
  <view class="page home-page">
    <view class="welcome">
      <view>
        <text class="eyebrow">{{ overview?.student.campusName ?? 'K12 校区' }}</text>
        <text class="page-title">你好，{{ overview?.student.displayName ?? mobileSession.state.user?.displayName }}</text>
        <text class="welcome-copy">{{ overview?.student.className ?? '学习数据准备中' }} · 今天也要稳稳向前</text>
      </view>
      <view class="avatar">{{ overview?.student.displayName.slice(0, 1) ?? '同' }}</view>
    </view>

    <view v-if="mobileSession.state.loading && !overview" class="card empty-state">学习数据加载中…</view>
    <view v-else-if="mobileSession.state.error && !overview" class="card empty-state">
      <text>{{ mobileSession.state.error }}</text>
      <button class="secondary-button retry" @click="retry">重新加载</button>
    </view>

    <template v-else-if="overview">
      <view class="summary-grid">
        <view class="summary-card purple"><text>待完成</text><strong>{{ pending }}</strong><small>项作业</small></view>
        <view class="summary-card green"><text>已出勤</text><strong>{{ attendance.PRESENT }}</strong><small>次课堂</small></view>
        <view class="summary-card orange"><text>新课件</text><strong>{{ overview.courseware.length }}</strong><small>份资料</small></view>
      </view>

      <view class="section-heading"><text>近期作业</text><text class="muted">按截止时间</text></view>
      <view v-if="rows.length" class="card list-card">
        <view v-for="row in rows.slice(0, 3)" :key="row.assignment.id" class="list-row" @click="openAssignment(row.assignment.id)">
          <view class="row-main"><strong>{{ row.assignment.title }}</strong><text>{{ formatChinaShortDateTime(row.assignment.dueAt) }} 截止</text></view>
          <text class="status-chip">{{ assignmentStatusLabel(row.status) }}</text>
        </view>
      </view>
      <view v-else class="card empty-state">暂无作业，先复习今天的课件吧。</view>

      <view class="section-heading"><text>近期考勤</text><text class="muted">共 {{ overview.attendance.length }} 条</text></view>
      <view v-if="recentAttendance.length" class="card list-card">
        <view v-for="record in recentAttendance" :key="record.id" class="list-row">
          <view class="row-main"><strong>课次 #{{ record.scheduleId }}</strong><text>{{ formatChinaDateTime(record.recordedAt) }}</text></view>
          <text class="attendance-chip">{{ attendanceStatusLabel(record.status) }}</text>
        </view>
      </view>
      <view v-else class="card empty-state">暂无考勤记录</view>
    </template>
  </view>
</template>

<style scoped>
.home-page { padding-top: 26rpx; }
.welcome { display: flex; align-items: center; justify-content: space-between; }
.welcome text { display: block; }
.welcome-copy { margin-top: 14rpx; color: #75839a; font-size: 25rpx; }
.avatar { display: flex; width: 92rpx; height: 92rpx; align-items: center; justify-content: center; border-radius: 32rpx; color: #fff; background: linear-gradient(135deg,#ff9b68,#f27845); font-size: 38rpx; font-weight: 800; }
.summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16rpx; margin-top: 38rpx; }
.summary-card { min-height: 180rpx; padding: 24rpx 18rpx; border-radius: 26rpx; color: #fff; box-sizing: border-box; }
.summary-card text,.summary-card small { display: block; font-size: 22rpx; opacity: .88; }
.summary-card strong { display: block; margin: 14rpx 0 4rpx; font-size: 48rpx; }
.purple { background: linear-gradient(145deg,#7168e8,#5148c8); }
.green { background: linear-gradient(145deg,#43aa8b,#21856d); }
.orange { background: linear-gradient(145deg,#f6a25d,#e4773c); }
.section-heading { display: flex; justify-content: space-between; margin: 42rpx 4rpx 16rpx; font-size: 31rpx; font-weight: 800; }
.section-heading .muted { font-size: 23rpx; font-weight: 500; }
.list-card { padding: 0 26rpx; }
.list-row { display: flex; align-items: center; justify-content: space-between; gap: 20rpx; padding: 28rpx 0; border-bottom: 1rpx solid #edf0f5; }
.list-row:last-child { border-bottom: 0; }
.row-main { display: flex; min-width: 0; flex-direction: column; gap: 10rpx; }
.row-main strong { font-size: 28rpx; }
.row-main text { color: #8490a2; font-size: 23rpx; }
.status-chip,.attendance-chip { flex: none; padding: 10rpx 16rpx; border-radius: 999rpx; color: #5b52d9; background: #eeecff; font-size: 22rpx; font-weight: 700; }
.attendance-chip { color: #1f7a62; background: #e9f7f1; }
.retry { width: 240rpx; margin-top: 24rpx; }
</style>

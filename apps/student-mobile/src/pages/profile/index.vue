<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'

import { mobileSession } from '../../mobileSession'

const loggingOut = ref(false)
const overview = computed(() => mobileSession.state.overview)

onShow(() => {
  if (!mobileSession.state.user) uni.reLaunch({ url: '/pages/login/index' })
})

async function logout(): Promise<void> {
  if (loggingOut.value) return
  loggingOut.value = true
  try { await mobileSession.logout() }
  finally {
    loggingOut.value = false
    uni.reLaunch({ url: '/pages/login/index' })
  }
}
</script>

<template>
  <view class="page profile-page">
    <view class="profile-hero">
      <view class="avatar">{{ overview?.student.displayName.slice(0,1) ?? '同' }}</view>
      <text class="name">{{ overview?.student.displayName ?? mobileSession.state.user?.displayName }}</text>
      <text class="role">学生 · {{ overview?.student.className ?? '班级信息加载中' }}</text>
    </view>
    <view class="card info-card">
      <view><text>所属校区</text><strong>{{ overview?.student.campusName ?? mobileSession.state.user?.campusName ?? '—' }}</strong></view>
      <view><text>学生编号</text><strong>{{ overview?.student.id ?? mobileSession.state.user?.id }}</strong></view>
      <view><text>课程数量</text><strong>{{ overview?.courses.length ?? 0 }} 门</strong></view>
      <view><text>考勤记录</text><strong>{{ overview?.attendance.length ?? 0 }} 条</strong></view>
    </view>
    <view class="card help-card"><strong>学习提醒</strong><text>作业提交前确认正文和附件完整；老师要求订正后，可在原作业详情中再次提交。</text></view>
    <button class="secondary-button logout" :disabled="loggingOut" @click="logout">{{ loggingOut ? '正在退出…' : '退出登录' }}</button>
  </view>
</template>

<style scoped>
.profile-hero { display: flex; align-items: center; flex-direction: column; padding: 38rpx 0 20rpx; }
.avatar { display: flex; width: 124rpx; height: 124rpx; align-items: center; justify-content: center; border-radius: 42rpx; color: #fff; background: linear-gradient(145deg,#6f66e7,#4c45c2); font-size: 48rpx; font-weight: 800; box-shadow: 0 20rpx 48rpx rgba(91,82,217,.25); }
.name,.role,.help-card text { display: block; }
.name { margin-top: 24rpx; font-size: 40rpx; font-weight: 800; }
.role { margin-top: 10rpx; color: #78869a; font-size: 25rpx; }
.info-card { padding: 8rpx 30rpx; }
.info-card view { display: flex; align-items: center; justify-content: space-between; padding: 25rpx 0; border-bottom: 1rpx solid #edf0f5; }
.info-card view:last-child { border-bottom: 0; }
.info-card text { color: #7c899b; font-size: 25rpx; }
.info-card strong { font-size: 27rpx; }
.help-card strong { font-size: 29rpx; }
.help-card text { margin-top: 14rpx; color: #68778c; font-size: 25rpx; line-height: 1.7; }
.logout { margin-top: 30rpx; color: #a9433a; background: #fff0ed; }
</style>

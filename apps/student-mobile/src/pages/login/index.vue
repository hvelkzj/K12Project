<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'

import { mobileStudentClient } from '../../mobileClient'
import { mobileSession } from '../../mobileSession'

const form = reactive({ username: 'student_101', password: 'K12Demo123!' })
const serviceUrl = ref(mobileStudentClient.getServiceUrl())
const submitting = ref(false)
const progressText = ref('')
const message = ref('')

onMounted(async () => {
  if (mobileSession.state.initializing) {
    try {
      await mobileSession.restore()
    } catch {
      // The visible message below is more helpful than a startup exception.
    }
  }
  if (mobileSession.state.user) {
    uni.reLaunch({ url: '/pages/home/index' })
  }
})

async function submit(): Promise<void> {
  if (submitting.value) return
  if (!form.username.trim() || !form.password) {
    message.value = '请输入账号和密码'
    return
  }
  submitting.value = true
  progressText.value = '正在连接…'
  message.value = ''
  try {
    serviceUrl.value = mobileStudentClient.setServiceUrl(serviceUrl.value)
    await mobileStudentClient.checkConnection()
    progressText.value = '正在登录…'
    await mobileSession.login(form.username, form.password)
    uni.reLaunch({ url: '/pages/home/index' })
  } catch (error) {
    message.value = error instanceof Error ? error.message : '登录失败，请稍后重试'
  } finally {
    submitting.value = false
    progressText.value = ''
  }
}
</script>

<template>
  <view class="login-page">
    <view class="brand-mark">K</view>
    <view class="intro">
      <text class="eyebrow">K12 学习空间</text>
      <text class="page-title">每一次学习，\n都有清晰进步</text>
      <text class="intro-copy">查看课件、完成作业、跟进批改结果和课堂出勤。</text>
    </view>

    <view class="login-card">
      <text class="card-title">学生登录</text>
      <label class="field">
        <text>学生账号</text>
        <input v-model="form.username" autocomplete="username" placeholder="请输入学生账号" />
      </label>
      <label class="field">
        <text>登录密码</text>
        <input v-model="form.password" password autocomplete="current-password" placeholder="请输入密码" />
      </label>
      <view class="connection-box">
        <text class="connection-title">连接设置</text>
        <text class="connection-copy">手机和电脑需连接同一 Wi-Fi。请填写电脑启动项目后显示的“手机访问地址”。</text>
        <input v-model="serviceUrl" class="service-input" inputmode="url" placeholder="例如 http://192.168.1.20:3000" />
      </view>
      <view v-if="message || mobileSession.state.error" class="status-message">
        {{ message || mobileSession.state.error }}
      </view>
      <button class="primary-button login-button" :disabled="submitting" @click="submit">
        {{ submitting ? progressText : '进入学习空间' }}
      </button>
      <text class="login-tip">测试账号已预填，可直接体验完整学习流程。</text>
    </view>
  </view>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  box-sizing: border-box;
  padding: calc(var(--status-bar-height) + 40rpx) 38rpx 48rpx;
  background: linear-gradient(155deg, #edeaff 0%, #f7f8fc 48%, #fff1e8 100%);
}
.brand-mark {
  display: flex;
  width: 82rpx;
  height: 82rpx;
  align-items: center;
  justify-content: center;
  border-radius: 24rpx;
  color: #fff;
  background: #5b52d9;
  font-size: 42rpx;
  font-weight: 800;
  box-shadow: 0 18rpx 36rpx rgba(91, 82, 217, 0.25);
}
.intro { display: flex; flex-direction: column; margin-top: 62rpx; }
.page-title { white-space: pre-line; }
.intro-copy { margin-top: 24rpx; color: #65748a; font-size: 28rpx; line-height: 1.7; }
.login-card { margin-top: 52rpx; padding: 38rpx 32rpx; border-radius: 32rpx; background: rgba(255,255,255,.94); box-shadow: 0 24rpx 70rpx rgba(45,54,80,.12); }
.card-title { display: block; margin-bottom: 28rpx; font-size: 36rpx; font-weight: 800; }
.field { display: block; margin-top: 24rpx; color: #485972; font-size: 26rpx; font-weight: 700; }
.field input { height: 92rpx; margin-top: 12rpx; padding: 0 26rpx; border: 1rpx solid #dbe3ee; border-radius: 20rpx; background: #f8fafc; color: #1d2d45; font-weight: 500; }
.connection-box { margin-top: 28rpx; padding: 24rpx; border-radius: 20rpx; background: #f1f4fb; }
.connection-title { display: block; color: #243650; font-size: 27rpx; font-weight: 800; }
.connection-copy { display: block; margin-top: 10rpx; color: #65748a; font-size: 23rpx; line-height: 1.6; }
.service-input { height: 82rpx; margin-top: 18rpx; padding: 0 22rpx; border: 1rpx solid #cfd9e8; border-radius: 16rpx; background: #fff; color: #1d2d45; font-size: 25rpx; }
.login-button { margin-top: 30rpx; }
.login-tip { display: block; margin-top: 22rpx; color: #8995a7; font-size: 23rpx; text-align: center; }
</style>

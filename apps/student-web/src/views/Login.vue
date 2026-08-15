<script setup lang="ts">
import { ref } from 'vue';
import { authService } from '../services/authService';
import type { UserSummary } from '@k12/shared';

const emit = defineEmits<{
  (e: 'success', user: UserSummary): void;
}>();

const username = ref('student_101');
const password = ref('K12Demo123!');
const errorMessage = ref('');
const isLoading = ref(false);

const handleLogin = async () => {
  errorMessage.value = '';

  if (!username.value.trim() || !password.value.trim()) {
    errorMessage.value = '请输入账号和密码';
    return;
  }

  isLoading.value = true;
  try {
    const { accessToken, user } = await authService.login(username.value, password.value);

    if (user.role !== 'STUDENT') {
      throw new Error('权限不足：非学生角色不能进入此端');
    }

    sessionStorage.setItem('k12AccessToken', accessToken);
    emit('success', user);

  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '登录失败，请检查网络或后端状态';
    sessionStorage.removeItem('k12AccessToken');
  } finally {
    isLoading.value = false;
  }
};
</script>

<template>
  <div class="login-layout">
    <!-- 左侧品牌侧边栏 -->
    <div class="brand-sider">
      <div class="brand-header">
        <div class="logo-box">S</div>
        <div class="logo-text">
          <h2>K12 学习中心</h2>
          <p>学生 / 个人端</p>
        </div>
      </div>

      <div class="brand-nav">
        <div class="nav-item active">
          <span class="dot"></span>
          登录
          <span class="route-path">/login</span>
        </div>
      </div>

      <div class="brand-footer">
        <p class="status-label">访问状态</p>
        <h3>尚未登录</h3>
        <p class="status-desc">登录后显示个人课表与作业数据。</p>
      </div>
    </div>

    <!-- 右侧内容区 -->
    <div class="main-content">
      <div class="top-header">
        <span class="date-text">2026 年 8 月 15 日 · 星期六</span>
      </div>

      <div class="page-title">
        <h1>登录</h1>
      </div>

      <!-- 核心登录卡片 -->
      <div class="login-card-wrapper">
        <div class="login-card">
          <div class="card-left">
            <span class="tag">真实认证接入</span>
            <h2>进入<br/>学习空间</h2>
            <p class="desc">
              使用真实认证接口登录。学生仅能访问本人的课程、提交作业及查看批改反馈。
            </p>
            <div class="auth-hint">
              <p>✓ 学生：仅限本人数据<br/>(student_101)</p>
            </div>
          </div>

          <div class="card-right form-area">
            <div class="input-group">
              <label>学号 / 账号</label>
              <input
                v-model="username"
                type="text"
                placeholder="请输入学号"
                @keyup.enter="handleLogin"
              />
            </div>

            <div class="input-group">
              <label>密码</label>
              <input
                v-model="password"
                type="password"
                placeholder="••••••••"
                @keyup.enter="handleLogin"
              />
            </div>

            <div class="error-message" v-if="errorMessage">
              {{ errorMessage }}
            </div>

            <button
              class="login-btn"
              @click="handleLogin"
              :disabled="isLoading"
            >
              {{ isLoading ? '验证中...' : '登录并进入学习空间' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 全局布局 */
.login-layout {
  display: flex;
  height: 100vh;
  width: 100vw;
  background-color: #f4f6f8;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  margin: -8px; /* 抵消默认的 body margin */
}

/* 左侧侧边栏 (致敬队友风格) */
.brand-sider {
  width: 260px;
  background-color: #2f54eb; /* 青春蓝 */
  color: white;
  display: flex;
  flex-direction: column;
  padding: 32px 0;
  box-sizing: border-box;
}

.brand-header {
  display: flex;
  align-items: center;
  padding: 0 24px;
  margin-bottom: 40px;
  gap: 12px;
}

.logo-box {
  width: 40px;
  height: 40px;
  background-color: #faad14; /* 亮黄色点缀 */
  color: #fff;
  font-size: 24px;
  font-weight: bold;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.logo-text h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.5px;
}

.logo-text p {
  margin: 4px 0 0;
  font-size: 12px;
  color: rgba(255,255,255,0.7);
}

.brand-nav {
  flex: 1;
}

.nav-item {
  padding: 16px 24px;
  display: flex;
  align-items: center;
  font-size: 14px;
  color: rgba(255,255,255,0.9);
  background: rgba(0,0,0,0.15); /* 高亮当前项 */
  position: relative;
}

.nav-item .dot {
  width: 8px;
  height: 8px;
  background-color: #faad14;
  border-radius: 50%;
  margin-right: 12px;
}

.route-path {
  margin-left: auto;
  font-size: 12px;
  color: rgba(255,255,255,0.5);
}

.brand-footer {
  padding: 0 24px;
  background: rgba(0,0,0,0.1);
  margin: 0 16px;
  padding: 16px;
  border-radius: 8px;
}

.status-label {
  font-size: 12px;
  color: rgba(255,255,255,0.6);
  margin: 0 0 8px;
}

.brand-footer h3 {
  margin: 0 0 8px;
  font-size: 16px;
}

.status-desc {
  font-size: 12px;
  color: rgba(255,255,255,0.7);
  margin: 0;
  line-height: 1.5;
}

/* 右侧内容区 */
.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 32px 48px;
  overflow-y: auto;
}

.top-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 24px;
}

.date-text {
  font-size: 14px;
  color: #8c8c8c;
  font-weight: 500;
}

.page-title h1 {
  margin: 0 0 40px;
  font-size: 32px;
  color: #1f2937;
  font-weight: 800;
  letter-spacing: 1px;
}

/* 核心登录卡片 */
.login-card-wrapper {
  flex: 1;
  display: flex;
  align-items: flex-start;
}

.login-card {
  display: flex;
  background: #ffffff;
  border-radius: 16px;
  box-shadow: 0 10px 25px rgba(0,0,0,0.05);
  width: 100%;
  max-width: 760px;
  overflow: hidden;
}

.card-left {
  flex: 1;
  padding: 48px;
  background: linear-gradient(145deg, #ffffff 0%, #f9fafb 100%);
  border-right: 1px solid #f0f0f0;
}

.tag {
  display: inline-block;
  font-size: 12px;
  color: #2f54eb;
  font-weight: bold;
  margin-bottom: 16px;
}

.card-left h2 {
  font-size: 40px;
  line-height: 1.2;
  margin: 0 0 24px;
  color: #111827;
  letter-spacing: 2px;
}

.card-left .desc {
  font-size: 14px;
  color: #6b7280;
  line-height: 1.8;
  margin-bottom: 40px;
}

.auth-hint {
  font-size: 14px;
  color: #374151;
  line-height: 1.6;
}

.auth-hint p {
  margin: 0;
}

.card-right {
  flex: 1;
  padding: 48px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.input-group {
  margin-bottom: 24px;
}

.input-group label {
  display: block;
  font-size: 14px;
  color: #374151;
  margin-bottom: 8px;
  font-weight: 500;
}

input {
  width: 100%;
  padding: 12px 16px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 15px;
  color: #1f2937;
  transition: all 0.2s;
  box-sizing: border-box;
}

input:focus {
  border-color: #2f54eb;
  box-shadow: 0 0 0 3px rgba(47, 84, 235, 0.1);
  outline: none;
}

.error-message {
  color: #ef4444;
  font-size: 13px;
  margin-top: -12px;
  margin-bottom: 16px;
}

.login-btn {
  width: 100%;
  padding: 14px;
  background-color: #2f54eb;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s;
  margin-top: 8px;
}

.login-btn:hover:not(:disabled) {
  background-color: #1d39c4;
}

.login-btn:disabled {
  background-color: #9ca3af;
  cursor: not-allowed;
}

/* 响应式调整 */
@media (max-width: 900px) {
  .brand-sider { display: none; }
  .login-card { flex-direction: column; }
  .card-left { border-right: none; border-bottom: 1px solid #f0f0f0; padding: 32px; }
  .card-right { padding: 32px; }
}
</style>

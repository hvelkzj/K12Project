<script setup lang="ts">
import { ref, onMounted } from 'vue';
import Login from './views/Login.vue';
// 引入你上周创建的 Home 视图（里面可以放你的作业列表组件）
import Home from './views/Home.vue';
import { authService } from './services/authService';
import type { UserSummary } from '@k12/shared';

const currentUser = ref<UserSummary | null>(null);
const isInitializing = ref(true);

onMounted(async () => {
  // 页面刷新时，检查是否已经有 Token
  const token = sessionStorage.getItem('k12AccessToken');
  if (token) {
    try {
      // 携带 Token 去后端换取最新用户信息
      const user = await authService.getMe();
      // 再次校验角色，防止混入非学生账号
      if (user.role !== 'STUDENT') {
        throw new Error('权限不足');
      }
      currentUser.value = user;
    } catch {
      // 获取失败（Token过期或伪造），清理干净本地数据
      sessionStorage.removeItem('k12AccessToken');
      currentUser.value = null;
    }
  }
  isInitializing.value = false;
});

// 接收来自 Login 组件的成功事件
const handleLoginSuccess = (user: UserSummary) => {
  currentUser.value = user;
};

// 全局退出逻辑
const handleLogout = async () => {
  try {
    await authService.logout();
  } catch (error) {
    console.error('退出异常', error);
  } finally {
    // 无论后端请求是否成功，前端必须立刻清空状态并切回登录页
    currentUser.value = null;
    sessionStorage.removeItem('k12AccessToken');
  }
};
</script>

<template>
  <!-- 初始化屏幕，防止刷新时页面出现闪烁 -->
  <div v-if="isInitializing" class="loading-screen">
    系统加载中...
  </div>

  <template v-else>
    <!-- 如果没有当前用户，展示刚才写好的登录页 -->
    <Login v-if="!currentUser" @success="handleLoginSuccess" />

    <!-- 登录成功后，展示主页和顶部导航 -->
    <div v-else class="app-layout">
      <header class="app-header">
        <div class="logo">K12 学生端系统</div>
        <div class="user-actions">
          <span class="welcome-text">欢迎, {{ currentUser.displayName || '同学' }}</span>
          <button class="logout-btn" @click="handleLogout">退出登录</button>
        </div>
      </header>

      <main class="app-main">
        <!-- 这里渲染你的主页内容 -->
        <Home :current-user="currentUser" />
      </main>
    </div>
  </template>
</template>

<style scoped>
.loading-screen {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  font-size: 18px;
  color: #666;
}

.app-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: #f0f2f5;
}

.app-header {
  height: 60px;
  background-color: #fff;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 24px;
}

.logo {
  font-size: 20px;
  font-weight: bold;
  color: #1890ff;
}

.user-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.welcome-text {
  color: #333;
}

.logout-btn {
  background: none;
  border: 1px solid #d9d9d9;
  padding: 4px 12px;
  border-radius: 4px;
  cursor: pointer;
  color: #666;
}

.logout-btn:hover {
  color: #f5222d;
  border-color: #f5222d;
}

.app-main {
  flex: 1;
  padding: 24px;
}
</style>

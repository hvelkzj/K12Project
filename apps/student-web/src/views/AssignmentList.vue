<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { mockAssignments, calculateGlobalProgress, type Assignment } from '../mock/assignment';

const assignmentList = ref<Assignment[]>(mockAssignments);
const router = useRouter();

// 计算全局完成率 (Mock计算)
const globalProgressPercent = computed(() => calculateGlobalProgress(assignmentList.value));

// 页面跳转逻辑：点击卡片进入详情页
const goToDetail = (id: string) => {
  router.push(`/assignment/${id}`);
};

// 新增：顶部占位按钮的交互提示
const handlePlaceholderClick = (featureName: string) => {
  alert(`【${featureName}】功能模块正在开发中，敬请期待！`);
};

// 辅助函数：根据课程获取图标（Mock）
const getCourseIcon = (courseId: string) => {
  const icons: Record<string, string> = {
    MATH: '∫',
    ENG: '📖',
    PHY: '⚛️'
  };
  return icons[courseId] || '📚';
};

// 辅助函数：根据状态获取状态图标（Mock）
const getStatusIcon = (status: string) => {
  const icons: Record<string, string> = {
    未提交: '🕒',
    已提交: '✔️',
    已批改: '🟢',
    需订正: '⚠️'
  };
  return icons[status] || '📋';
};
</script>

<template>
  <div class="main-layout">
    <!-- 1. Header Bar (已绑定点击提示事件) -->
    <header class="top-header">
      <h1 class="page-title">我的作业本</h1>
      <div class="header-actions">
        <button class="header-btn dashboard-btn" @click="handlePlaceholderClick('作业统计')">
          <span>📊</span> 作业统计
        </button>
        <button class="header-btn calendar-btn" @click="handlePlaceholderClick('日历')">
          <span>📅</span>
        </button>
        <button class="header-btn message-btn" @click="handlePlaceholderClick('消息通知')">
          <span>🔔</span>
        </button>
        <!-- 增加 cursor: pointer 让鼠标放上去有点击手势 -->
        <div class="user-profile" @click="handlePlaceholderClick('个人中心')" style="cursor: pointer;">
          <img src="https://via.placeholder.com/40" alt="avatar" class="avatar" />
          <span class="user-name">我的</span>
        </div>
      </div>
    </header>

    <!-- 2. 全局完成率进度条 (保持不变) -->
    <div class="global-progress-bar-container">
      <div class="progress-bar-wrapper">
        <div class="progress-label">全局完成率</div>
        <div class="progress-track">
          <div
            class="progress-fill"
            :style="{ width: globalProgressPercent + '%' }"
          ></div>
        </div>
        <div class="progress-percent">{{ globalProgressPercent }}%</div>
      </div>
    </div>

    <!-- 3. 作业卡片列表 (已将跳转绑定到整个卡片上) -->
    <main class="assignment-content">
      <div
        v-for="item in assignmentList"
        :key="item.assignment_id"
        class="assignment-card"
        @click="goToDetail(item.assignment_id)"
      >
        <div class="card-body">
          <div class="card-meta">
            <span :class="['course-tag', item.course_id]">
              <span class="course-icon">{{ getCourseIcon(item.course_id) }}</span>
              {{ item.course_id }}
            </span>

            <span :class="['status-badge', item.status]">
              <span class="status-icon">{{ getStatusIcon(item.status) }}</span>
              {{ item.status }}
            </span>
          </div>

          <h3 class="assignment-title">{{ item.title }}</h3>

          <p class="countdown-row">
            倒计时时间: <span class="countdown-text">{{ item.countdown }}</span>
          </p>
          <p class="deadline-row">
            截止时间: <span class="deadline-text">{{ new Date(item.deadline).toLocaleString() }}</span>
          </p>

          <div v-if="item.score_grade" class="score-card">
            <div class="score-main">
              <span class="score-value" :style="{ color: item.score_color }">得分: {{ item.score }}</span>
              <span class="score-grade-icon">{{ item.score_grade }}</span>
            </div>
            <p v-if="item.teacher_feedback_preview" class="feedback-preview">{{ item.teacher_feedback_preview }}</p>
          </div>
        </div>

        <div class="card-footer">
          <div class="card-progress-bar-wrapper">
            <div class="card-progress-text">{{ item.visual_progress_text }}</div>
            <div class="card-progress-track">
              <div
                class="card-progress-fill"
                :style="{ width: (item.visual_progress * 100) + '%' }"
              ></div>
            </div>
          </div>

          <!-- 即使按钮被遮挡，点击整个卡片依然可以跳转 -->
          <button class="action-btn">
            {{ item.status === '未提交' || item.status === '需订正' ? '去提交' : '看结果' }}
          </button>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
/* ==================================
   全局布局与变量
   ================================== */
:root {
  --primary-color: #1890ff;
  --secondary-color: #1890ff;
  --bg-color: #f5f5f5;
  --text-color: #333;
  --meta-color: #888;
  --card-shadow: 0 4px 12px rgba(0,0,0,0.08);
  --border-radius: 12px;
  --transition: all 0.3s ease;
}

.main-layout {
  min-height: 100vh;
  background-color: #f5f7f9;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  padding-bottom: 40px;
}

/* ==================================
   1. Header Bar
   ================================== */
.top-header {
  background-color: #fff;
  padding: 16px 40px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 2px 8px rgba(0,0,0,0.03);
  position: sticky;
  top: 0;
  z-index: 100;
}

.page-title {
  margin: 0;
  font-size: 24px;
  color: var(--text-color);
  font-weight: 700;
}

.header-actions {
  display: flex;
  gap: 16px;
  align-items: center;
}

.header-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 16px;
  color: var(--text-color);
  padding: 8px 16px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.header-btn:hover { background-color: #f0f2f5; }

.dashboard-btn {
  background-color: #f0f7ff;
  color: var(--primary-color);
  font-weight: 600;
}

.user-profile {
  display: flex;
  align-items: center;
  gap: 10px;
}
.avatar { border-radius: 50%; }

/* ==================================
   2. 全局进度条
   ================================== */
.global-progress-bar-container {
  padding: 24px 40px 0 40px;
  max-width: 1200px;
  margin: 0 auto;
}

.progress-bar-wrapper {
  background-color: #fff;
  padding: 16px 20px;
  border-radius: var(--border-radius);
  box-shadow: var(--card-shadow);
  display: flex;
  align-items: center;
  gap: 16px;
}

.progress-label {
  font-weight: 700;
  color: var(--text-color);
  font-size: 16px;
}

.progress-track {
  flex-grow: 1;
  height: 10px;
  background-color: #e6e9ed;
  border-radius: 5px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background-color: #52c41a;
  border-radius: 5px;
  transition: width 0.3s ease;
}

.progress-percent {
  font-weight: 700;
  color: var(--meta-color);
  width: 40px;
  text-align: right;
}

/* ==================================
   3. 作业卡片区域
   ================================== */
.assignment-content {
  padding: 24px 40px;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); /* 稍微调小最小宽度防挤压 */
  gap: 24px;
  max-width: 1200px;
  margin: 0 auto;
}

.assignment-card {
  background-color: #fff;
  border-radius: var(--border-radius);
  box-shadow: var(--card-shadow);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: var(--transition);
  cursor: pointer; /* 鼠标悬浮时变成小手 */
}
.assignment-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 8px 20px rgba(0,0,0,0.12);
}

.card-body {
  padding: 24px;
  flex-grow: 1;
  display: flex;
  flex-direction: column;
}

.card-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.course-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 20px;
  font-weight: 700;
  font-size: 14px;
}

.course-tag.MATH { background-color: #e6f7ff; color: #1890ff; }
.course-tag.ENG { background-color: #f6ffed; color: #52c41a; }
.course-tag.PHY { background-color: #fff1f0; color: #f5222d; }

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 4px;
  font-weight: 600;
  font-size: 12px;
}

.status-badge.未提交 { background-color: #fffbe6; color: #faad14; }
.status-badge.已提交 { background-color: #e6f7ff; color: #1890ff; }
.status-badge.已批改 { background-color: #f6ffed; color: #52c41a; }
.status-badge.需订正 { background-color: #fff1f0; color: #f5222d; }

.assignment-title {
  margin: 0 0 16px 0;
  font-size: 18px;
  color: var(--text-color);
  font-weight: 700;
}

.countdown-row, .deadline-row {
  margin: 0 0 6px 0;
  color: var(--meta-color);
  font-size: 14px;
}

.countdown-text, .deadline-text {
  font-weight: 600;
  color: var(--text-color);
}

.score-card {
  margin-top: 16px;
  border-top: 1px solid #f0f0f0;
  padding-top: 16px;
}

.score-main {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 8px;
}

.score-value {
  font-size: 18px;
  font-weight: 700;
}

.score-grade-icon {
  font-size: 24px;
  font-weight: 800;
  color: #52c41a;
}

.feedback-preview {
  margin: 0;
  font-size: 12px;
  color: #999;
  line-height: 1.4;
}

.card-footer {
  padding: 16px 24px;
  border-top: 1px solid #f0f0f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-progress-bar-wrapper {
  flex-grow: 1;
  max-width: 150px;
}

.card-progress-text {
  font-size: 12px;
  color: #999;
  margin-bottom: 4px;
}

.card-progress-track {
  height: 6px;
  background-color: #f0f0f0;
  border-radius: 3px;
  overflow: hidden;
}

.card-progress-fill {
  height: 100%;
  background-color: #52c41a;
  border-radius: 3px;
}

.action-btn {
  background-color: var(--primary-color);
  color: white;
  border: none;
  padding: 8px 24px;
  border-radius: var(--border-radius);
  cursor: pointer;
  font-weight: 600;
  font-size: 14px;
  transition: var(--transition);
}

.action-btn:hover { background-color: #40a9ff; }
</style>

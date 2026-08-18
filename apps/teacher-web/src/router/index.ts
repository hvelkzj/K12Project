import { createRouter, createWebHistory } from 'vue-router'
import { getToken } from '@/utils/auth'

const routes = [
  // 登录页面（独立页面，不套layout布局）
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/login/index.vue')
  },
  // 主布局外壳，所有业务页面都放在children里面
  {
    path: '/',
    component: () => import('@/layout/index.vue'),
    redirect: '/schedule/today', // 默认跳转到今日课表
    children: [
      {
        path: 'schedule/today',
        name: 'TodaySchedule',
        component: () => import('@/views/schedule/today.vue')
      },
      {
        path: 'schedule/change',
        name: 'ChangeSchedule',
        component: () => import('@/views/schedule/change.vue')
      },
      {
        path: 'attendance',
        name: 'Attendance',
        component: () => import('@/views/attendance/index.vue')
      },
      {
        path: 'assignment',
        name: 'Assignment',
        component: () => import('@/views/assignment/list.vue')
      },
      {
        path: 'feedback',
        name: 'Feedback',
        component: () => import('@/views/feedback/index.vue')
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// 全局路由守卫：没有token强制跳登录页
router.beforeEach((to, from, next) => {
  const token = getToken()
  if (to.path === '/login') {
    // 如果已经登录还访问登录页，直接跳首页
    if (token) next('/')
    else next()
  } else {
    // 非登录页，没有token就跳登录
    if (!token) next('/login')
    else next()
  }
})

export default router
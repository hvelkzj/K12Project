import { createRouter, createWebHistory } from 'vue-router'
import Login from '@/views/Login.vue'
import Home from '@/views/Home.vue'
import { createTeacherAuthClient } from '@/authClient'

const authClient = createTeacherAuthClient(fetch)

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: Login
    },
    {
      path: '/',
      name: 'home',
      component: Home,
      meta: { requireAuth: true }
    }
  ]
})

// 全局路由守卫
router.beforeEach(async (to, from, next) => {
  // 需要鉴权的页面
  if (to.meta.requireAuth) {
    try {
      const user = await authClient.restoreCurrentUser()
      // 不是教师角色直接打回登录页
      if (!user || !(user.role === 'TEACHER' || user.role === 'HOMEROOM_TEACHER')) {
        sessionStorage.removeItem('k12AccessToken')
        return next('/login')
      }
      next()
    } catch (err) {
      // token失效401，跳登录
      sessionStorage.removeItem('k12AccessToken')
      return next('/login')
    }
  } else {
    next()
  }
})

export default router
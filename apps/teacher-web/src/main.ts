
import { createApp } from 'vue'
import App from './App.vue'
import './style.css'
import router from './router' //新增：导入路由

createApp(App)
  .use(router) //新增：挂载路由
  .mount('#app')
  
 
 import { createTeacherAuthClient } from './authClient'
import { TeacherApiClient } from './teacherApiClient'

// 认证客户端实例
export const authClient = createTeacherAuthClient()

// 业务API客户端，复用authClient拿token
export const teacherApiClient = new TeacherApiClient({
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL,
  getAccessToken: () => authClient.getAccessToken(),
})
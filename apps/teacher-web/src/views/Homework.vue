<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { TeacherApiClient } from '@/teacherApiClient'
import { createTeacherAuthClient } from '@/authClient'
import { useRouter } from 'vue-router'

const router = useRouter()
const apiClient = new TeacherApiClient(fetch)
const authClient = createTeacherAuthClient(fetch)

const listData = ref<any>([])
const loading = ref(false)
const errorMsg = ref('')
//作业发布表单
const homeworkForm = ref({
  title: '',
  content: '',
  courseId: ''
})
const submitLoading = ref(false)

async function submitHomework() {
  submitLoading.value = true
  try {
    await apiClient.createHomework(homeworkForm.value)
    await loadData()
    homeworkForm.value = { title: '', content: '', courseId: '' }
  } catch (err: any) {
    errorMsg.value = err?.message || '发布作业失败'
  } finally {
    submitLoading.value = false
  }
}

async function loadData() {
  loading.value = true
  errorMsg.value = ''
  try {
    // ==========只改这里接口，其他代码几乎不动==========
    const data = await apiClient.getHomeworkList()
    listData.value = data
  } catch(err:any) {
    if(err?.status === 401) {
      sessionStorage.removeItem('k12AccessToken')
      router.push('/login')
      return
    }
    errorMsg.value = err?.message || '获取签到列表失败'
  } finally {
    loading.value = false
  }
}

onMounted(()=>{
  loadData()
})
</script>

<template>
  <div class="checkin-page">
    <h2>作业列表</h2>
    <div v-if="loading">加载中...</div>
    <div v-if="errorMsg" style="color:red">{{ errorMsg }}</div>
    <div v-if="!loading && !errorMsg && listData.length === 0">暂无签到数据</div>
    <div v-if="listData">
      <pre>{{ listData }}</pre>
    </div>
  </div>
  <div style="margin-top:20px;border-top:1px solid #ccc;padding-top:16px;">
  <h3>发布新作业</h3>
  <div>
    <label>课程ID：</label>
    <input v-model="homeworkForm.courseId" placeholder="填写课程ID"/>
  </div>
  <div style="margin:8px 0;">
    <label>作业标题：</label>
    <input v-model="homeworkForm.title" placeholder="作业标题"/>
  </div>
  <div style="margin:8px 0;">
    <label>作业内容：</label>
    <textarea v-model="homeworkForm.content" rows="4" placeholder="填写作业要求"></textarea>
  </div>
  <button @click="submitHomework" :disabled="submitLoading">
    {{ submitLoading ? '提交中...' : '发布作业' }}
  </button>
</div>
</template>
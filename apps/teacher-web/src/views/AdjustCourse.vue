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
//课程调整表单
const courseForm = ref({
  courseId: '',
  newTitle: '',
  newDesc: ''
})
const submitLoading = ref(false)

async function submitAdjustCourse() {
  submitLoading.value = true
  try {
    await apiClient.adjustCourse(courseForm.value)
    await loadData()
    courseForm.value = { courseId: '', newTitle: '', newDesc: '' }
  } catch (err: any) {
    errorMsg.value = err?.message || '修改课程失败'
  } finally {
    submitLoading.value = false
  }
}

async function loadData() {
  loading.value = true
  errorMsg.value = ''
  try {
    // ==========只改这里接口，其他代码几乎不动==========
    const data = await apiClient.getAdjustCourseList()
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
    <h2>调课申请列表</h2>
    <div v-if="loading">加载中...</div>
    <div v-if="errorMsg" style="color:red">{{ errorMsg }}</div>
    <div v-if="!loading && !errorMsg && listData.length === 0">暂无签到数据</div>
    <div v-if="listData">
      <pre>{{ listData }}</pre>
    </div>
  </div>
  <div style="margin-top:20px;border-top:1px solid #ccc;padding-top:16px;">
  <h3>调整课程信息</h3>
  <div>
    <label>课程ID：</label>
    <input v-model="courseForm.courseId" placeholder="填写要修改的课程ID"/>
  </div>
  <div style="margin:8px 0;">
    <label>新课程名称：</label>
    <input v-model="courseForm.newTitle" placeholder="输入新课程名称"/>
  </div>
  <div style="margin:8px 0;">
    <label>课程描述：</label>
    <textarea v-model="courseForm.newDesc" rows="4" placeholder="填写课程描述"></textarea>
  </div>
  <button @click="submitAdjustCourse" :disabled="submitLoading">
    {{ submitLoading ? '提交中...' : '保存修改' }}
  </button>
</div>
</template>
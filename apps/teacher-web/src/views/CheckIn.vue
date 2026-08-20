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
//签到表单
const checkInForm = ref({
  lessonId: '',
  status: 'PRESENT'
})
const submitLoading = ref(false)

async function submitAttendance() {
  submitLoading.value = true
  try {
    await apiClient.saveAttendance(checkInForm.value)
    await loadData()
    checkInForm.value = { lessonId: '', status: 'PRESENT' }
  } catch (err: any) {
    errorMsg.value = err?.message || '保存签到失败'
  } finally {
    submitLoading.value = false
  }
}

async function loadData() {
  loading.value = true
  errorMsg.value = ''
  try {
    // ==========只改这里接口，其他代码几乎不动==========
    const data = await apiClient.getCheckInList()
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
    <h2>签到列表</h2>
    <div v-if="loading">加载中...</div>
    <div v-if="errorMsg" style="color:red">{{ errorMsg }}</div>
    <div v-if="!loading && !errorMsg && listData.length === 0">暂无签到数据</div>
    <div v-if="listData">
      <pre>{{ listData }}</pre>
    </div>
  </div>
  <div style="margin-top:20px;border-top:1px solid #ccc;padding-top:16px;">
  <h3>执行签到</h3>
  <div>
    <label>课次ID：</label>
    <input v-model="checkInForm.lessonId" placeholder="输入课次ID"/>
  </div>
  <div style="margin:8px 0">
    <label>签到状态：</label>
    <select v-model="checkInForm.status">
      <option value="PRESENT">正常出勤</option>
      <option value="ABSENT">缺席</option>
    </select>
  </div>
  <button @click="submitAttendance" :disabled="submitLoading">
    {{ submitLoading ? '提交中...' : '保存签到' }}
  </button>
</div>
</template>
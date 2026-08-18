<template>
  <div class="login-page">
    <div class="login-box">
      <h2>K12教师登录</h2>
      <div class="item">
        <label>账号</label>
        <input v-model="form.username" placeholder="请输入账号"/>
      </div>
      <div class="item">
        <label>密码</label>
        <input v-model="form.password" type="password" placeholder="请输入密码"/>
      </div>
      <button @click="handleLogin" :disabled="loading">
        {{ loading?'登录中...':'登录' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { teacherLogin } from '@/api/auth'
import { setToken } from '@/utils/auth'

const router = useRouter()
const loading = ref(false)
const form = ref({
  username:'',
  password:''
})

const handleLogin = async ()=>{
  if(!form.value.username || !form.value.password){
    alert('账号密码不能为空')
    return
  }
  loading.value = true
  try{
    const res = await teacherLogin(form.value)
    setToken(res.token)
    router.push('/')
  }catch(err){
    console.error(err)
    alert('登录失败，请检查账号密码')
  }finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page{
  height:100vh;
  background:#f5f7fa;
  display:flex;
  align-items:center;
  justify-content:center;
}
.login-box{
  width:360px;
  background:#fff;
  padding:32px;
  border-radius:8px;
}
.item{
  margin-bottom:16px;
}
label{display:block;margin-bottom:4px;}
input{width:100%;box-sizing:border-box;padding:8px 10px;}
button{width:100%;padding:10px;background:#2478ff;color:white;border:none;border-radius:4px;cursor:pointer;}
</style>
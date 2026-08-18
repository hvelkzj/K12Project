import request from '@/utils/request'

export function teacherLogin(data:{username:string,password:string}){
  return request.post('/teacher/login', data)
}
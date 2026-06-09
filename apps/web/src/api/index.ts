import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
})

// 响应拦截器
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response) {
      const msg = error.response.data?.message
      console.error('API Error:', error.response.status, msg || error.message)
    } else if (error.request) {
      console.error('网络错误: 无法连接到服务器')
    }
    return Promise.reject(error)
  },
)

export default api

export type { ApiResponse } from '@/types'

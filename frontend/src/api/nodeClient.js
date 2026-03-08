import axios from 'axios'
import { useStore } from '../store/useStore'

const nodeClient = axios.create({
  baseURL: import.meta.env.VITE_NODE_API_URL || 'http://localhost:3001/api',
  withCredentials: true,
})

nodeClient.interceptors.request.use((config) => {
  const token = useStore.getState().accessToken
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

nodeClient.interceptors.response.use(
  (res) => res,
  async (err) => {
    const requestUrl = err?.config?.url || ''
    const isAuthRoute = requestUrl.includes('/auth/login') || requestUrl.includes('/auth/register') || requestUrl.includes('/auth/refresh')

    if (isAuthRoute) {
      return Promise.reject(err)
    }

    if (err.response?.status === 401) {
      try {
        const { data } = await axios.post(
          (import.meta.env.VITE_NODE_API_URL || 'http://localhost:3001/api') + '/auth/refresh',
          {},
          { withCredentials: true }
        )
        useStore.getState().setAuth(useStore.getState().user, data.accessToken)
        err.config.headers.Authorization = `Bearer ${data.accessToken}`
        return axios(err.config)
      } catch {
        useStore.getState().logout()
        window.location.href = '/login'
        return Promise.reject(err)
      }
    }
    return Promise.reject(err)
  }
)

export default nodeClient

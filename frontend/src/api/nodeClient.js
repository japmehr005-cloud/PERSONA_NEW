import axios from 'axios'
import { useStore } from '../store/useStore'

const nodeClient = axios.create({
  baseURL: import.meta.env.VITE_NODE_API_URL || 'http://localhost:3001/api',
  withCredentials: true,
})

function emitIntentCheck(detail) {
  setTimeout(() => {
    window.dispatchEvent(new CustomEvent('intentCheckRequired', { detail }))
  }, 100)
}

nodeClient.interceptors.request.use((config) => {
  const token = useStore.getState().accessToken
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

nodeClient.interceptors.response.use(
  (res) => {
    if (res?.status === 202 && res?.data?.requiresIntentCheck) {
      const pendingRequest = {
        url: res.config?.url,
        method: res.config?.method,
        data: res.config?.data,
        headers: res.config?.headers || {},
        params: res.config?.params
      }
      const intentData = {
        ...res.data,
        pendingRequest
      }
      emitIntentCheck(intentData)
      return Promise.resolve({
        ...res,
        data: {
          ...res.data,
          intentCheckDeferred: true
        }
      })
    }
    return res
  },
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

    if (err.response?.status === 202 && err.response?.data?.requiresIntentCheck) {
      const pendingRequest = {
        url: err.config?.url,
        method: err.config?.method,
        data: err.config?.data,
        headers: err.config?.headers || {},
        params: err.config?.params
      }
      const intentData = {
        ...err.response.data,
        pendingRequest
      }
      emitIntentCheck(intentData)
      return Promise.resolve({
        ...err.response,
        data: {
          ...err.response.data,
          intentCheckDeferred: true
        }
      })
    }
    return Promise.reject(err)
  }
)

export default nodeClient

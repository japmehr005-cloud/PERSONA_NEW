import axios from 'axios'

const pythonClient = axios.create({
  baseURL: import.meta.env.VITE_PYTHON_API_URL || 'http://localhost:8000',
})

export default pythonClient

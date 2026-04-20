import { useCallback, useEffect, useState } from 'react'
import nodeClient from '../api/nodeClient'

export default function useIntentCheck() {
  const [intentCheckActive, setIntentCheckActive] = useState(false)
  const [intentData, setIntentData] = useState(null)
  const [pendingRequest, setPendingRequest] = useState(null)

  useEffect(() => {
    const onIntentCheckRequired = (event) => {
      const detail = event?.detail || {}
      setIntentData(detail)
      setPendingRequest(detail.pendingRequest || null)
      setIntentCheckActive(true)
    }

    window.addEventListener('intentCheckRequired', onIntentCheckRequired)
    return () => window.removeEventListener('intentCheckRequired', onIntentCheckRequired)
  }, [])

  const confirmAndRetry = useCallback(async () => {
    if (!pendingRequest?.url || !pendingRequest?.method) return null
    const method = String(pendingRequest.method).toLowerCase()
    const headers = {
      ...(pendingRequest.headers || {}),
      'X-Intent-Confirmed': 'true'
    }
    return nodeClient.request({
      url: pendingRequest.url,
      method,
      data: pendingRequest.data,
      headers
    })
  }, [pendingRequest])

  const cancelIntent = useCallback(() => {
    setIntentCheckActive(false)
    setIntentData(null)
    setPendingRequest(null)
  }, [])

  return {
    intentCheckActive,
    intentData,
    confirmAndRetry,
    cancelIntent
  }
}

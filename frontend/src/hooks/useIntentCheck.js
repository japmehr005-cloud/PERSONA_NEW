import { useCallback, useEffect, useState } from 'react'
import nodeClient from '../api/nodeClient'

export default function useIntentCheck() {
  const [intentCheckActive, setIntentCheckActive] = useState(false)
  const [intentData, setIntentData] = useState(null)
  const [pendingRequest, setPendingRequest] = useState(null)

  useEffect(() => {
    const onIntentCheckRequired = (event) => {
      const detail = event?.detail || {}
      setTimeout(() => {
        setIntentData(detail)
        setPendingRequest(detail.pendingRequest || null)
        setIntentCheckActive(true)
      }, 100)
    }

    window.addEventListener('intentCheckRequired', onIntentCheckRequired)
    return () => window.removeEventListener('intentCheckRequired', onIntentCheckRequired)
  }, [])

  const confirmAndRetry = useCallback(async () => {
    if (!pendingRequest?.url || !pendingRequest?.method) {
      window.dispatchEvent(new CustomEvent('intentCheckResolved', {
        detail: { confirmed: true, intentData, response: null }
      }))
      return null
    }
    const method = String(pendingRequest.method).toLowerCase()
    const headers = {
      ...(pendingRequest.headers || {}),
      'X-Intent-Confirmed': 'true',
      'X-Confirmed-At': new Date().toISOString()
    }
    const response = await nodeClient.request({
      url: pendingRequest.url,
      method,
      data: pendingRequest.data,
      headers,
      params: pendingRequest.params
    })
    window.dispatchEvent(new CustomEvent('intentCheckResolved', {
      detail: { confirmed: true, intentData, response }
    }))
    return response
  }, [pendingRequest])

  const cancelIntent = useCallback(() => {
    window.dispatchEvent(new CustomEvent('intentCheckResolved', {
      detail: { confirmed: false, intentData, response: null }
    }))
    setIntentCheckActive(false)
    setIntentData(null)
    setPendingRequest(null)
  }, [intentData])

  return {
    intentCheckActive,
    intentData,
    confirmAndRetry,
    cancelIntent
  }
}

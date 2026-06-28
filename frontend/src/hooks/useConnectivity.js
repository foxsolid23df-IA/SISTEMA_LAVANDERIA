import { useState, useEffect } from 'react'
import { Network } from '@capacitor/network'
import { platform } from '../utils/platform'
import { offlineQueue } from '../services/offlineQueue'

const isNative = platform.isCapacitor

export const useConnectivity = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  useEffect(() => {
    const handleOnline = async () => {
      console.log('[Connectivity] Internet restaurado')
      setIsOnline(true)
      const pending = await offlineQueue.getAll()
      if (pending.length > 0) {
        console.log(`[Connectivity] Procesando ${pending.length} operaciones pendientes...`)
        await processQueue()
      }
    }

    const handleOffline = () => {
      console.warn('[Connectivity] Sin conexión a internet')
      setIsOnline(false)
    }

    if (isNative) {
      Network.addListener('networkStatusChange', (status) => {
        if (status.connected) {
          handleOnline()
        } else {
          handleOffline()
        }
      })
      Network.getStatus().then((status) => {
        setIsOnline(status.connected)
      })
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return isOnline
}

async function processQueue() {
  const pending = await offlineQueue.getAll()
  for (const op of pending) {
    try {
      const response = await fetch(op.url, {
        method: op.method || 'POST',
        headers: { 'Content-Type': 'application/json', ...op.headers },
        body: op.body ? JSON.stringify(op.body) : undefined
      })
      if (response.ok) {
        await offlineQueue.remove(op.id)
        console.log(`[OfflineQueue] Operación ${op.id} completada`)
      } else {
        await offlineQueue.incrementRetry(op.id)
        const removed = await offlineQueue.removeFailed(op.id)
        if (removed) {
          console.warn(`[OfflineQueue] Operación ${op.id} eliminada por exceder reintentos`)
        }
      }
    } catch (err) {
      console.error(`[OfflineQueue] Error en operación ${op.id}:`, err)
      await offlineQueue.incrementRetry(op.id)
      await offlineQueue.removeFailed(op.id)
    }
  }
}

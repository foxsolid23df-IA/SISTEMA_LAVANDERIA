import { useEffect, useRef, useState, useCallback } from 'react'

const isNative = typeof window !== 'undefined' && window.Capacitor?.isNativePlatform()

export const useNativeScanner = ({ onScan, onError } = {}) => {
  const [isScanning, setIsScanning] = useState(false)
  const [hasPermission, setHasPermission] = useState(null)
  const scannerRef = useRef(null)
  const listenerRef = useRef(null)

  const requestPermission = useCallback(async () => {
    if (!isNative) return true
    try {
      const { BarcodeScanner } = await import('@capacitor-mlkit/barcode-scanning')
      const { camera } = await BarcodeScanner.requestPermissions()
      const granted = camera === 'granted'
      setHasPermission(granted)
      return granted
    } catch {
      setHasPermission(false)
      return false
    }
  }, [])

  const startScan = useCallback(async () => {
    if (!isNative) return
    try {
      const { BarcodeScanner } = await import('@capacitor-mlkit/barcode-scanning')
      await BarcodeScanner.startScan()
      setIsScanning(true)

      listenerRef.current = await BarcodeScanner.addListener(
        'barcodeScanned',
        (result) => {
          if (result?.barcode?.rawValue) {
            BarcodeScanner.stopScan()
            setIsScanning(false)
            onScan?.(result.barcode.rawValue)
          }
        }
      )
    } catch (err) {
      console.error('[NativeScanner] Error starting scan:', err)
      onError?.(err)
      setIsScanning(false)
    }
  }, [onScan, onError])

  const stopScan = useCallback(async () => {
    if (!isNative) return
    try {
      const { BarcodeScanner } = await import('@capacitor-mlkit/barcode-scanning')
      await BarcodeScanner.stopScan()
      listenerRef.current?.remove()
      listenerRef.current = null
      setIsScanning(false)
    } catch (err) {
      console.error('[NativeScanner] Error stopping scan:', err)
    }
  }, [])

  const toggleTorch = useCallback(async () => {
    if (!isNative) return
    try {
      const { BarcodeScanner } = await import('@capacitor-mlkit/barcode-scanning')
      await BarcodeScanner.toggleTorch()
    } catch (err) {
      console.error('[NativeScanner] Error toggling torch:', err)
    }
  }, [])

  useEffect(() => {
    return () => {
      if (listenerRef.current) {
        listenerRef.current.remove()
        listenerRef.current = null
      }
    }
  }, [])

  return {
    isScanning,
    hasPermission,
    isNative,
    requestPermission,
    startScan,
    stopScan,
    toggleTorch,
  }
}

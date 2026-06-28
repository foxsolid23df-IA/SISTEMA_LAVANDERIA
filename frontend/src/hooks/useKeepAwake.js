import { useEffect, useRef } from 'react'

const isNative = typeof window !== 'undefined' && window.Capacitor?.isNativePlatform()

export function useKeepAwake(active = true) {
  const activeRef = useRef(active)

  useEffect(() => {
    activeRef.current = active
  }, [active])

  useEffect(() => {
    if (!isNative) return

    let keepAwakePlugin

    async function init() {
      const mod = await import('@capacitor-community/keep-awake')
      keepAwakePlugin = mod.KeepAwake

      if (activeRef.current) {
        try {
          await keepAwakePlugin.keepAwake()
        } catch (err) {
          console.warn('[KeepAwake] Error keeping awake:', err)
        }
      }
    }

    init()

    return () => {
      if (keepAwakePlugin) {
        keepAwakePlugin.allowSleep().catch(() => {})
      }
    }
  }, [])
}

import { Preferences } from '@capacitor/preferences'
import { platform } from './platform'

const isNative = platform.isCapacitor

export const storage = {
  async get(key) {
    if (isNative) {
      const { value } = await Preferences.get({ key })
      return value
    }
    return localStorage.getItem(key)
  },

  async set(key, value) {
    if (isNative) {
      await Preferences.set({ key, value: String(value) })
    } else {
      localStorage.setItem(key, value)
    }
  },

  async remove(key) {
    if (isNative) {
      await Preferences.remove({ key })
    } else {
      localStorage.removeItem(key)
    }
  },

  async getObject(key) {
    const raw = await this.get(key)
    if (!raw) return null
    try {
      return JSON.parse(raw)
    } catch {
      return null
    }
  },

  async setObject(key, obj) {
    await this.set(key, JSON.stringify(obj))
  },

  async clear() {
    if (isNative) {
      await Preferences.clear()
    } else {
      localStorage.clear()
    }
  }
}

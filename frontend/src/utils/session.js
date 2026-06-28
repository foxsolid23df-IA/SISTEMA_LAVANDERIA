import { storage } from './storage'

const SESSION_PREFIX = 'session_'

export const sessionStore = {
  async get(key) {
    return storage.get(SESSION_PREFIX + key)
  },

  async set(key, value) {
    await storage.set(SESSION_PREFIX + key, value)
  },

  async remove(key) {
    await storage.remove(SESSION_PREFIX + key)
  }
}

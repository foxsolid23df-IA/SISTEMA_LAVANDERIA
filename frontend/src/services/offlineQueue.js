import { storage } from '../utils/storage'

const QUEUE_KEY = 'offline_queue'
const MAX_RETRIES = 3

export const offlineQueue = {
  async enqueue(operation) {
    const queue = (await storage.getObject(QUEUE_KEY)) || []
    queue.push({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      ...operation,
      createdAt: new Date().toISOString(),
      retries: 0
    })
    await storage.setObject(QUEUE_KEY, queue)
  },

  async dequeue() {
    const queue = (await storage.getObject(QUEUE_KEY)) || []
    if (queue.length === 0) return null
    const [next, ...rest] = queue
    await storage.setObject(QUEUE_KEY, rest)
    return next
  },

  async peek() {
    const queue = (await storage.getObject(QUEUE_KEY)) || []
    return queue[0] || null
  },

  async getAll() {
    return (await storage.getObject(QUEUE_KEY)) || []
  },

  async remove(id) {
    const queue = (await storage.getObject(QUEUE_KEY)) || []
    const filtered = queue.filter(op => op.id !== id)
    await storage.setObject(QUEUE_KEY, filtered)
  },

  async incrementRetry(id) {
    const queue = (await storage.getObject(QUEUE_KEY)) || []
    const updated = queue.map(op =>
      op.id === id ? { ...op, retries: op.retries + 1 } : op
    )
    await storage.setObject(QUEUE_KEY, updated)
  },

  async removeFailed(id) {
    const queue = (await storage.getObject(QUEUE_KEY)) || []
    const op = queue.find(o => o.id === id)
    if (op && op.retries >= MAX_RETRIES) {
      await this.remove(id)
      console.warn(`[OfflineQueue] Operación ${id} eliminada tras ${MAX_RETRIES} intentos`)
      return true
    }
    return false
  },

  async clear() {
    await storage.remove(QUEUE_KEY)
  }
}

/**
 * Least Recently Used (LRU) Cache implementation
 * Efficiently manages memory by removing least recently accessed items
 */
export class LRUCache<K, V> {
  private capacity: number
  private cache: Map<K, V>

  constructor(capacity: number) {
    if (capacity <= 0) {
      throw new Error('Cache capacity must be greater than 0')
    }
    this.capacity = capacity
    this.cache = new Map()
  }

  /**
   * Get value from cache and mark it as recently used
   */
  get(key: K): V | undefined {
    if (this.cache.has(key)) {
      // Remove and re-add to move to end (most recent)
      const value = this.cache.get(key)!
      this.cache.delete(key)
      this.cache.set(key, value)
      return value
    }
    return undefined
  }

  /**
   * Set value in cache, evicting least recently used if at capacity
   */
  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      // Update existing key - remove and re-add to move to end
      this.cache.delete(key)
    } else if (this.cache.size >= this.capacity) {
      // At capacity - remove least recently used (first item)
      const firstKey = this.cache.keys().next().value
      if (firstKey !== undefined) {
        this.cache.delete(firstKey)
      }
    }

    this.cache.set(key, value)
  }

  /**
   * Check if key exists in cache
   */
  has(key: K): boolean {
    return this.cache.has(key)
  }

  /**
   * Get current cache size
   */
  get size(): number {
    return this.cache.size
  }

  /**
   * Clear all items from cache
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Get all keys in access order (oldest to newest)
   */
  keys(): IterableIterator<K> {
    return this.cache.keys()
  }

  /**
   * Get all values in access order (oldest to newest)
   */
  values(): IterableIterator<V> {
    return this.cache.values()
  }
}
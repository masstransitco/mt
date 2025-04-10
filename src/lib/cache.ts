type CacheEntry = {
  data: string
  timestamp: number
}

// Simple in-memory cache
const cache: Record<string, CacheEntry> = {}

// Cache expiration time (in milliseconds)
const CACHE_EXPIRATION = 30 * 60 * 1000 // 30 minutes

export function getCachedData(key: string): string | null {
  const entry = cache[key]

  if (!entry) {
    return null
  }

  // Check if cache has expired
  if (Date.now() - entry.timestamp > CACHE_EXPIRATION) {
    delete cache[key]
    return null
  }

  return entry.data
}

export function setCachedData(key: string, data: string): void {
  cache[key] = {
    data,
    timestamp: Date.now(),
  }
}


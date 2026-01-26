import { kv } from '@vercel/kv';

export const CACHE_TTL = {
  PROFILE: 60 * 60,           // 1 hour
  GAMES_LIST: 30 * 60,        // 30 minutes
  GAME_DETAILS: 24 * 60 * 60, // 24 hours
  COVERS: 7 * 24 * 60 * 60,   // 7 days
} as const;

const memoryCache = new Map<string, { value: unknown; expiry: number }>();

function isKVConfigured(): boolean {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

function getMemoryCache<T>(key: string): T | null {
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiry) {
    memoryCache.delete(key);
    return null;
  }
  return entry.value as T;
}

function setMemoryCache<T>(key: string, value: T, ttlSeconds: number): void {
  memoryCache.set(key, {
    value,
    expiry: Date.now() + ttlSeconds * 1000,
  });
}

function deleteMemoryCache(key: string): void {
  memoryCache.delete(key);
}

export async function getCache<T>(key: string): Promise<T | null> {
  try {
    if (isKVConfigured()) {
      return await kv.get<T>(key);
    }
    return getMemoryCache<T>(key);
  } catch (error) {
    console.error(`Cache get error for key ${key}:`, error);
    return getMemoryCache<T>(key);
  }
}

export async function setCache<T>(
  key: string,
  value: T,
  ttlSeconds: number = CACHE_TTL.GAME_DETAILS
): Promise<void> {
  try {
    if (isKVConfigured()) {
      await kv.set(key, value, { ex: ttlSeconds });
    }
    setMemoryCache(key, value, ttlSeconds);
  } catch (error) {
    console.error(`Cache set error for key ${key}:`, error);
    setMemoryCache(key, value, ttlSeconds);
  }
}

export async function deleteCache(key: string): Promise<void> {
  try {
    if (isKVConfigured()) {
      await kv.del(key);
    }
    deleteMemoryCache(key);
  } catch (error) {
    console.error(`Cache delete error for key ${key}:`, error);
    deleteMemoryCache(key);
  }
}

export async function getCacheMany<T>(keys: string[]): Promise<(T | null)[]> {
  if (keys.length === 0) return [];

  try {
    if (isKVConfigured()) {
      const results = await kv.mget<T[]>(...keys);
      return results;
    }
    return keys.map(key => getMemoryCache<T>(key));
  } catch (error) {
    console.error('Cache mget error:', error);
    return keys.map(key => getMemoryCache<T>(key));
  }
}

export async function setCacheMany<T>(
  entries: Array<{ key: string; value: T; ttl?: number }>
): Promise<void> {
  if (entries.length === 0) return;

  try {
    if (isKVConfigured()) {
      const pipeline = kv.pipeline();
      for (const { key, value, ttl = CACHE_TTL.GAME_DETAILS } of entries) {
        pipeline.set(key, value, { ex: ttl });
      }
      await pipeline.exec();
    }

    for (const { key, value, ttl = CACHE_TTL.GAME_DETAILS } of entries) {
      setMemoryCache(key, value, ttl);
    }
  } catch (error) {
    console.error('Cache mset error:', error);
    for (const { key, value, ttl = CACHE_TTL.GAME_DETAILS } of entries) {
      setMemoryCache(key, value, ttl);
    }
  }
}

export const cacheKeys = {
  profile: (username: string) => `profile:${username.toLowerCase()}`,
  gamesList: (username: string) => `games:${username.toLowerCase()}`,
  gameDetails: (gameId: string) => `game:${gameId}`,
  cover: (title: string) => `cover:${title.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
  coverBatch: (hash: string) => `covers:batch:${hash}`,
};

export function getCacheHeaders(ttlSeconds: number, isImmutable = false): HeadersInit {
  if (isImmutable) {
    return {
      'Cache-Control': `public, max-age=${ttlSeconds}, immutable`,
      'CDN-Cache-Control': `public, max-age=${ttlSeconds}`,
      'Vercel-CDN-Cache-Control': `public, max-age=${ttlSeconds}`,
    };
  }

  return {
    'Cache-Control': `public, s-maxage=${ttlSeconds}, stale-while-revalidate=${ttlSeconds * 2}`,
    'CDN-Cache-Control': `public, s-maxage=${ttlSeconds}`,
    'Vercel-CDN-Cache-Control': `public, s-maxage=${ttlSeconds}`,
  };
}

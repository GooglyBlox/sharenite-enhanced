interface CacheEntry {
  url: string | null;
  timestamp: number;
  manuallySet: boolean;
}

class CoverCache {
  private static instance: CoverCache;
  private cache: Map<string, CacheEntry>;
  private readonly MAX_CACHE_SIZE = 200;
  private readonly CACHE_DURATION = 24 * 60 * 60 * 1000;

  private constructor() {
    this.cache = new Map();
    this.loadFromStorage();

    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  public static getInstance(): CoverCache {
    if (!CoverCache.instance) {
      CoverCache.instance = new CoverCache();
    }
    return CoverCache.instance;
  }

  private cleanup() {
    const now = Date.now();
    let deleted = 0;

    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.CACHE_DURATION) {
        this.cache.delete(key);
        deleted++;
      }
    }

    if (this.cache.size > this.MAX_CACHE_SIZE) {
      const sortedEntries = Array.from(this.cache.entries()).sort(
        (a, b) => b[1].timestamp - a[1].timestamp
      );

      while (sortedEntries.length > this.MAX_CACHE_SIZE) {
        const [key] = sortedEntries.pop()!;
        this.cache.delete(key);
        deleted++;
      }
    }

    if (deleted > 0) {
      this.saveToStorage();
    }
  }

  private loadFromStorage() {
    try {
      const stored = localStorage.getItem("game-covers-cache");
      if (stored) {
        const parsed = JSON.parse(stored) as Record<string, CacheEntry>;
        const now = Date.now();

        Object.entries(parsed).forEach(([key, value]) => {
          if (now - value.timestamp < this.CACHE_DURATION) {
            const entry: CacheEntry = {
              url: value.url,
              timestamp: value.timestamp,
              manuallySet: value.manuallySet ?? false,
            };
            this.cache.set(key, entry);
          }
        });
      }
    } catch (error) {
      console.error("Error loading cache:", error);
    }
  }

  private saveToStorage() {
    try {
      const obj = Object.fromEntries(this.cache.entries());
      localStorage.setItem("game-covers-cache", JSON.stringify(obj));
    } catch (error) {
      console.error("Error saving cache:", error);
    }
  }

  public get(key: string): string | null {
    const item = this.cache.get(key);
    if (!item) return null;
    return item.url;
  }

  public set(key: string, url: string | null, manuallySet = false) {
    this.cache.set(key, { url, timestamp: Date.now(), manuallySet });
    this.saveToStorage();
  }

  public isManuallySet(key: string): boolean {
    const item = this.cache.get(key);
    return item?.manuallySet || false;
  }

  public clear() {
    this.cache.clear();
    localStorage.removeItem("game-covers-cache");
  }
}

export default CoverCache;

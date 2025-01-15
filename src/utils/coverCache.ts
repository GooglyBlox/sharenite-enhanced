interface CacheEntry {
  url: string | null;
  timestamp: number;
  manuallySet: boolean;
  fetched: boolean;
}

class CoverCache {
  private static instance: CoverCache;
  private cache: Map<string, CacheEntry>;
  private readonly MAX_CACHE_SIZE = 500;

  private constructor() {
    this.cache = new Map();
    this.loadFromStorage();
  }

  public static getInstance(): CoverCache {
    if (!CoverCache.instance) {
      CoverCache.instance = new CoverCache();
    }
    return CoverCache.instance;
  }

  private cleanup() {
    if (this.cache.size <= this.MAX_CACHE_SIZE) return;

    const sortedEntries = Array.from(this.cache.entries())
      .filter(([, value]) => !value.manuallySet)
      .sort((a, b) => a[1].timestamp - b[1].timestamp);

    while (this.cache.size > this.MAX_CACHE_SIZE && sortedEntries.length > 0) {
      const [key] = sortedEntries.shift()!;
      this.cache.delete(key);
    }

    this.saveToStorage();
  }

  private loadFromStorage() {
    try {
      const stored = localStorage.getItem("game-covers-cache");
      if (stored) {
        const parsed = JSON.parse(stored) as Record<string, CacheEntry>;
        Object.entries(parsed).forEach(([key, value]) => {
          const entry: CacheEntry = {
            url: value.url,
            timestamp: value.timestamp,
            manuallySet: value.manuallySet ?? false,
            fetched: value.fetched ?? false
          };
          this.cache.set(key, entry);
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
    const existing = this.cache.get(key);

    if (existing && (existing.fetched || existing.manuallySet) && !manuallySet) {
      return;
    }

    this.cache.set(key, {
      url,
      timestamp: Date.now(),
      manuallySet,
      fetched: manuallySet || (existing?.fetched || false)
    });

    this.saveToStorage();
    this.cleanup();
  }

  public isManuallySet(key: string): boolean {
    const item = this.cache.get(key);
    return item?.manuallySet || false;
  }

  public hasBeenFetched(key: string): boolean {
    const item = this.cache.get(key);
    return item?.fetched || false;
  }

  public markAsFetched(key: string) {
    const existing = this.cache.get(key);
    if (existing && !existing.fetched) {
      this.cache.set(key, {
        ...existing,
        fetched: true
      });
      this.saveToStorage();
    }
  }

  public clear() {
    this.cache.clear();
    localStorage.removeItem("game-covers-cache");
  }
}

export default CoverCache;

/* eslint-disable @typescript-eslint/no-explicit-any */
class CoverCache {
  private static instance: CoverCache;
  private cache: Map<string, { url: string | null; timestamp: number }>;
  private readonly MAX_CACHE_SIZE = 200;
  private readonly CACHE_DURATION = 24 * 60 * 60 * 1000;

  private constructor() {
    this.cache = new Map();
    this.loadFromStorage();
    
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
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
      const sortedEntries = Array.from(this.cache.entries())
        .sort((a, b) => b[1].timestamp - a[1].timestamp);
      
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
  
    static getInstance(): CoverCache {
      if (!CoverCache.instance) {
        CoverCache.instance = new CoverCache();
      }
      return CoverCache.instance;
    }
  
    private loadFromStorage() {
      try {
        const stored = localStorage.getItem('game-covers-cache');
        if (stored) {
          const parsed = JSON.parse(stored);
          const now = Date.now();
          
          Object.entries(parsed).forEach(([key, value]: [string, any]) => {
            if (now - value.timestamp < this.CACHE_DURATION) {
              this.cache.set(key, value);
            }
          });
        }
      } catch (error) {
        console.error('Error loading cache:', error);
      }
    }
  
    private saveToStorage() {
      try {
        const obj = Object.fromEntries(this.cache.entries());
        localStorage.setItem('game-covers-cache', JSON.stringify(obj));
      } catch (error) {
        console.error('Error saving cache:', error);
      }
    }
  
    get(key: string): string | null {
      const item = this.cache.get(key);
      if (!item) return null;
  
      if (Date.now() - item.timestamp > this.CACHE_DURATION) {
        this.cache.delete(key);
        this.saveToStorage();
        return null;
      }
  
      return item.url;
    }
  
    set(key: string, url: string | null) {
      this.cache.set(key, { url, timestamp: Date.now() });
      this.saveToStorage();
    }
  
    clear() {
      this.cache.clear();
      localStorage.removeItem('game-covers-cache');
    }
  }
  
  export default CoverCache;
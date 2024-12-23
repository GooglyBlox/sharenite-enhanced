/* eslint-disable @typescript-eslint/no-explicit-any */
class CoverCache {
    private static instance: CoverCache;
    private cache: Map<string, { url: string | null; timestamp: number }>;
    private CACHE_DURATION = 24 * 60 * 60 * 1000;
  
    private constructor() {
      this.cache = new Map();
      this.loadFromStorage();
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
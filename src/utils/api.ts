import * as cheerio from 'cheerio';
import { GameBasic, GameDetailed, ShareniteProfile } from '@/types';

const CACHE_KEY = 'sharenite-data';
const PREFERENCES_KEY = 'sharenite-preferences';
const UPDATE_INTERVAL = 1000 * 60 * 60 * 2;
const STALE_TIME = 1000 * 60 * 60 * 24;

interface CacheData {
  games: GameDetailed[];
  timestamp: number;
  lastUpdated: Date;
  profile?: ShareniteProfile;
}

interface GamePreferences {
  isFavorite: boolean;
  isCompleted: boolean;
}

interface GameDetails {
  platform: string;
  playTime: string | null;
  playCount: number;
  added: string | null;
  modified: string | null;
}

type UpdateCallback = (games: GameDetailed[]) => void;

const BATCH_SIZE = 50;
const UPDATE_DEBOUNCE_MS = 500;

export class ShareniteAPI {
  private baseUrl: string;
  private username: string;
  private updateCallbacks: UpdateCallback[] = [];
  private isUpdating = false;
  private pendingUpdates: GameDetailed[] = [];
  private updateDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(username: string, fullUrl?: string) {
    if (fullUrl) {
      try {
        const url = new URL(fullUrl);
        const match = url.pathname.match(/\/profiles\/(.+?)\/games/);
        if (match) {
          this.username = match[1];
          this.baseUrl = `${url.origin}/profiles/${this.username}`;
        } else {
          this.username = username;
          this.baseUrl = `https://www.sharenite.link/profiles/${username}`;
        }
      } catch {
        this.username = username;
        this.baseUrl = `https://www.sharenite.link/profiles/${username}`;
      }
    } else {
      this.username = username;
      this.baseUrl = `https://www.sharenite.link/profiles/${username}`;
    }
  }

  onUpdate(callback: UpdateCallback) {
    this.updateCallbacks.push(callback);
    return () => {
      this.updateCallbacks = this.updateCallbacks.filter(cb => cb !== callback);
    };
  }

  private notifyUpdates(games: GameDetailed[]) {
    this.updateCallbacks.forEach(callback => callback(games));
  }

  private queueUpdate(games: GameDetailed[]) {
    this.pendingUpdates = games;

    if (this.updateDebounceTimer) {
      clearTimeout(this.updateDebounceTimer);
    }

    this.updateDebounceTimer = setTimeout(() => {
      if (this.pendingUpdates.length > 0) {
        this.notifyUpdates(this.pendingUpdates);
      }
      this.updateDebounceTimer = null;
    }, UPDATE_DEBOUNCE_MS);
  }

  private flushUpdates() {
    if (this.updateDebounceTimer) {
      clearTimeout(this.updateDebounceTimer);
      this.updateDebounceTimer = null;
    }
    if (this.pendingUpdates.length > 0) {
      this.notifyUpdates(this.pendingUpdates);
      this.pendingUpdates = [];
    }
  }

  private getPreferences(): Record<string, GamePreferences> {
    try {
      const stored = localStorage.getItem(PREFERENCES_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  }

  private savePreferences(preferences: Record<string, GamePreferences>) {
    try {
      localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
    } catch {
      // Ignore storage errors
    }
  }

  public updateGamePreferences(gameId: string, updates: Partial<GamePreferences>) {
    const preferences = this.getPreferences();
    preferences[gameId] = {
      ...preferences[gameId],
      ...updates
    };
    this.savePreferences(preferences);

    const cached = this.getCache();
    if (cached) {
      const updatedGames = cached.games.map(game =>
        game.id === gameId ? { ...game, ...updates } : game
      );
      this.setCache(updatedGames, cached.profile);
    }
  }

  private async fetchProfilePage(page = 1): Promise<string> {
    const response = await fetch(`${this.baseUrl}/games?page=${page}`, {
      headers: {
        'Accept': 'text/html',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch profile page: ${response.status}`);
    }

    return response.text();
  }

  private parseGamesList(html: string): {
    games: GameBasic[];
    hasNextPage: boolean;
  } {
    const $ = cheerio.load(html);
    const games: GameBasic[] = [];

    $('.list-group-item').each((_, element) => {
      const id = $(element).attr('id')?.replace('game_', '');
      if (!id || id === 'header') return;

      const title = $(element).find('strong').first().text().trim();
      const lastActivityElement = $(element).find('abbr').first();
      const lastActivity = lastActivityElement.text().trim();
      const lastActivityDate = lastActivityElement.attr('title')?.trim() || '';

      if (title) {
        games.push({
          id,
          title,
          lastActivity,
          lastActivityDate,
          platform: null,
          url: `${this.baseUrl}/games/${id}`
        });
      }
    });

    const hasNextPage = $('a.page-link[rel="next"]').length > 0;
    return { games, hasNextPage };
  }

  private async fetchGameDetailsBatch(games: GameBasic[]): Promise<Map<string, GameDetails>> {
    const results = new Map<string, GameDetails>();

    if (games.length === 0) return results;

    const baseUrl = typeof window === 'undefined'
      ? process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      : '';

    for (let i = 0; i < games.length; i += BATCH_SIZE) {
      const batch = games.slice(i, i + BATCH_SIZE);
      const urls = batch.map(g => g.url);

      try {
        const response = await fetch(`${baseUrl}/api/sharenite/games/batch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ urls })
        });

        if (response.ok) {
          const data = await response.json() as { games: Record<string, GameDetails> };
          for (const [url, details] of Object.entries(data.games)) {
            results.set(url, details);
          }
        }
      } catch {
        // Continue with other batches on error
      }
    }

    return results;
  }

  private getCache(): CacheData | null {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (!cached) return null;

      const data = JSON.parse(cached);
      return {
        games: data.games,
        timestamp: data.timestamp,
        lastUpdated: new Date(data.lastUpdated),
        profile: data.profile
      };
    } catch {
      return null;
    }
  }

  private setCache(games: GameDetailed[], profile?: ShareniteProfile, partial = false) {
    try {
      if (partial) {
        const existingCache = this.getCache();
        if (existingCache) {
          const existingGamesMap = new Map(existingCache.games.map(g => [g.id, g]));

          games.forEach(game => {
            existingGamesMap.set(game.id, game);
          });

          games = Array.from(existingGamesMap.values());
        }
      }

      const cacheData = {
        games,
        timestamp: Date.now(),
        lastUpdated: new Date(),
        profile
      };
      localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
    } catch {
      // Ignore storage errors
    }
  }

  private async fetchAndUpdateGames(existingGames: GameDetailed[] = []): Promise<GameDetailed[]> {
    this.isUpdating = true;
    const isInitialLoad = existingGames.length === 0;

    try {
      const existingGamesMap = new Map(existingGames.map(game => [game.id, game]));
      const preferences = this.getPreferences();
      const allBasicGames: GameBasic[] = [];

      let currentPage = 1;
      let hasNextPage = true;
      let unchangedPages = 0;

      while (hasNextPage) {
        const html = await this.fetchProfilePage(currentPage);
        const { games, hasNextPage: nextPage } = this.parseGamesList(html);

        const hasNewGames = games.some(g => !existingGamesMap.has(g.id));
        if (!hasNewGames && !isInitialLoad) {
          unchangedPages++;
          if (unchangedPages >= 2) break;
        } else {
          unchangedPages = 0;
        }

        allBasicGames.push(...games);
        hasNextPage = nextPage;
        currentPage++;
      }

      const detailsMap = await this.fetchGameDetailsBatch(allBasicGames);

      const updatedGames: GameDetailed[] = allBasicGames.map(game => {
        const existing = existingGamesMap.get(game.id);
        const details = detailsMap.get(game.url);
        const prefs = preferences[game.id] || {};

        if (details) {
          return {
            ...game,
            playTime: details.playTime || "00:00:00",
            playCount: details.playCount || 0,
            platform: details.platform || null,
            added: details.added || null,
            modified: details.modified || null,
            isCustomGame: false,
            isInstalled: false,
            isInstalling: false,
            isLaunching: false,
            isRunning: false,
            isUninstalling: false,
            userScore: null,
            communityScore: null,
            criticScore: null,
            version: null,
            notes: null,
            isFavorite: prefs.isFavorite || false,
            isCompleted: prefs.isCompleted || false
          };
        }

        if (existing) {
          return { ...existing, ...prefs };
        }

        return {
          ...game,
          playTime: "00:00:00",
          playCount: 0,
          isCustomGame: false,
          isInstalled: false,
          isInstalling: false,
          isLaunching: false,
          isRunning: false,
          isUninstalling: false,
          userScore: null,
          communityScore: null,
          criticScore: null,
          version: null,
          notes: null,
          isFavorite: prefs.isFavorite || false,
          isCompleted: prefs.isCompleted || false
        };
      });

      this.setCache(updatedGames);
      this.flushUpdates();

      return updatedGames;

    } catch (error) {
      console.error('Error in fetchAndUpdateGames:', error);
      throw error;
    } finally {
      this.isUpdating = false;
    }
  }

  async fetchAllGames(useCache = true): Promise<{
    games: GameDetailed[];
    lastUpdated: Date | null;
    profile?: ShareniteProfile;
  }> {
    const cached = this.getCache();
    const preferences = this.getPreferences();

    const profile = await this.validateProfile();

    if (useCache && cached?.games) {
      const gamesWithPreferences = cached.games.map(game => ({
        ...game,
        ...preferences[game.id]
      }));

      const cacheAge = Date.now() - cached.timestamp;

      if (cacheAge > UPDATE_INTERVAL && cacheAge < STALE_TIME && !this.isUpdating) {
        this.fetchAndUpdateGames(gamesWithPreferences).catch(console.error);
      }

      return {
        games: gamesWithPreferences,
        lastUpdated: cached.lastUpdated,
        profile
      };
    }

    const games = await this.fetchAndUpdateGames();
    const gamesWithPreferences = games.map(game => ({
      ...game,
      ...preferences[game.id]
    }));

    return { games: gamesWithPreferences, lastUpdated: new Date(), profile };
  }

  async validateProfile(): Promise<ShareniteProfile | undefined> {
    try {
      const html = await this.fetchProfilePage();
      const $ = cheerio.load(html);

      const totalGamesText = $('p:contains("Total games listed:")').text();
      const totalGames = parseInt(totalGamesText.match(/\d+/)?.[0] || '0');

      if (totalGames === 0) {
        return undefined;
      }

      const lastGameElement = $('.list-group-item').eq(1);
      const lastUpdated = lastGameElement.find('abbr').attr('title') || new Date().toISOString();

      return {
        username: this.username,
        totalGames,
        lastUpdated
      };
    } catch {
      return undefined;
    }
  }
}

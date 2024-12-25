import * as cheerio from 'cheerio';
import { GameBasic, GameDetailed, ShareniteProfile } from '@/types';

const CACHE_KEY = 'sharenite-data';
const PREFERENCES_KEY = 'sharenite-preferences';
const UPDATE_INTERVAL = 1000 * 60 * 30;

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

type UpdateCallback = (games: GameDetailed[]) => void;

export class ShareniteAPI {
  private baseUrl: string;
  private updateCallbacks: UpdateCallback[] = [];
  private isUpdating = false;

  constructor(username: string) {
    this.baseUrl = `https://www.sharenite.link/profiles/${username}`;
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

  private getPreferences(): Record<string, GamePreferences> {
    try {
      const stored = localStorage.getItem(PREFERENCES_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.error('Error loading preferences:', error);
      return {};
    }
  }

  private savePreferences(preferences: Record<string, GamePreferences>) {
    try {
      localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
    } catch (error) {
      console.error('Error saving preferences:', error);
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

  private async parseGameDetails(game: GameBasic): Promise<GameDetailed | null> {
    try {
      const baseUrl = typeof window === 'undefined' 
        ? process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
        : '';
      
      const response = await fetch(
        `${baseUrl}/api/sharenite/game?url=${encodeURIComponent(game.url)}`,
        { 
          headers: {
            'Accept': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch game details: ${response.status}`);
      }

      const details = await response.json();
      const preferences = this.getPreferences()[game.id] || {};

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
        isFavorite: preferences.isFavorite || false,
        isCompleted: preferences.isCompleted || false
      };
    } catch (error) {
      console.error(`Error fetching details for game ${game.id}:`, error);
      return null;
    }
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
    } catch (error) {
      console.error('Error reading cache:', error);
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
    } catch (error) {
      console.error('Error setting cache:', error);
    }
  }

  private async fetchAndUpdateGames(existingGames: GameDetailed[] = []): Promise<GameDetailed[]> {
    this.isUpdating = true;
    const updatedGames: GameDetailed[] = [...existingGames];
    let currentPage = 1;
    let hasNextPage = true;
    let unchangedCount = 0;
    const isInitialLoad = existingGames.length === 0;
    let cacheUpdateTimeout: NodeJS.Timeout | null = null;
  
    const debouncedCacheUpdate = (games: GameDetailed[]) => {
      if (cacheUpdateTimeout) {
        clearTimeout(cacheUpdateTimeout);
      }
      cacheUpdateTimeout = setTimeout(() => {
        this.setCache(games, undefined, true);
      }, 1000);
    };
  
    try {
      while (hasNextPage) {
        const html = await this.fetchProfilePage(currentPage);
        const { games, hasNextPage: nextPage } = this.parseGamesList(html);
        let pageUnchanged = true;
        const pageUpdates: GameDetailed[] = [];
        
        for (const game of games) {
          const existingGame = updatedGames.find(g => g.id === game.id);
          
          if (!existingGame) {
            const details = await this.parseGameDetails(game);
            if (details) {
              updatedGames.push(details);
              pageUpdates.push(details);
              if (isInitialLoad) {
                this.notifyUpdates(updatedGames);
              }
            }
            pageUnchanged = false;
            continue;
          }
  
          const details = await this.parseGameDetails(game);
          if (!details) continue;
  
          const hasChanged = 
            details.playTime !== existingGame.playTime ||
            details.lastActivityDate !== existingGame.lastActivityDate ||
            details.playCount !== existingGame.playCount;
  
          if (hasChanged) {
            const index = updatedGames.findIndex(g => g.id === details.id);
            if (index >= 0) {
              updatedGames[index] = details;
              pageUpdates.push(details);
              this.notifyUpdates(updatedGames);
            }
            pageUnchanged = false;
          }
        }
  
        if (pageUpdates.length > 0) {
          debouncedCacheUpdate(updatedGames);
        }
  
        if (pageUnchanged) {
          unchangedCount++;
        } else {
          unchangedCount = 0;
        }
  
        if (!isInitialLoad && unchangedCount >= 3) {
          break;
        }
  
        hasNextPage = nextPage;
        currentPage++;
      }
  
      if (cacheUpdateTimeout) {
        clearTimeout(cacheUpdateTimeout);
      }
      this.setCache(updatedGames);
      return updatedGames;
    } finally {
      this.isUpdating = false;
      if (cacheUpdateTimeout) {
        clearTimeout(cacheUpdateTimeout);
      }
    }
  }

  async fetchAllGames(useCache = true): Promise<{ 
    games: GameDetailed[]; 
    lastUpdated: Date | null;
    profile?: ShareniteProfile;
  }> {
    const cached = this.getCache();
    const preferences = this.getPreferences();
    
    if (useCache && cached?.games) {
      const gamesWithPreferences = cached.games.map(game => ({
        ...game,
        ...preferences[game.id]
      }));

      if (Date.now() - cached.timestamp > UPDATE_INTERVAL && !this.isUpdating) {
        this.fetchAndUpdateGames(gamesWithPreferences).catch(console.error);
      }
      return { 
        games: gamesWithPreferences, 
        lastUpdated: cached.lastUpdated,
        profile: cached.profile 
      };
    }
  
    const games = await this.fetchAndUpdateGames();
    const gamesWithPreferences = games.map(game => ({
      ...game,
      ...preferences[game.id]
    }));
    const profile = await this.validateProfile();
    return { games: gamesWithPreferences, lastUpdated: new Date(), profile };
  }

  async validateProfile(): Promise<ShareniteProfile | undefined> {
    try {
      const html = await this.fetchProfilePage();
      const $ = cheerio.load(html);
      
      const totalGamesText = $('p:contains("Total games listed:")').text();
      const totalGames = parseInt(totalGamesText.match(/\d+/)?.[0] || '0');
      
      if (totalGames > 0) {
        const games = $('.list-group-item').toArray();
        const latestGame = games[1];
        const lastUpdated = $(latestGame).find('abbr').attr('title') || '';
        
        return {
          username: this.baseUrl.split('/').pop() || '',
          totalGames,
          lastUpdated
        };
      }

      return undefined;
    } catch (error) {
      console.error('Error validating profile:', error);
      return undefined;
    }
  }

  async fetchGamePage(page: number, pageSize: number): Promise<{
    games: GameDetailed[];
    hasMore: boolean;
  }> {
    const html = await this.fetchProfilePage(page);
    const { games, hasNextPage } = this.parseGamesList(html);
    
    const detailedGames: GameDetailed[] = [];
    for (const game of games.slice(0, pageSize)) {
      const details = await this.parseGameDetails(game);
      if (details) {
        detailedGames.push(details);
      }
    }
  
    return {
      games: detailedGames,
      hasMore: hasNextPage
    };
  }
}
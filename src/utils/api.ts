import { GameBasic, GameDetailed, ShareniteProfile, ShareniteGameData } from '@/types';

const CACHE_KEY = 'sharenite-data';
const UPDATE_INTERVAL = 1000 * 60 * 30; // 30 minutes

interface CacheData {
  games: GameDetailed[];
  timestamp: number;
  lastUpdated: Date;
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

  private async fetchHTML(url: string): Promise<string> {
    const response = await fetch(url);
    const html = await response.text();
    return html;
  }

  private formatLastActivity(date: Date): string {
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 30) {
      return `${diffDays} days ago`;
    } else if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      return `${months} month${months > 1 ? 's' : ''} ago`;
    } else {
      const years = Math.floor(diffDays / 365);
      return `${years} year${years > 1 ? 's' : ''} ago`;
    }
  }

  private parseGamesList(html: string): GameBasic[] {
    const gamesMap = new Map<string, GameBasic>();
    
    const jsonPattern = /{(?:&quot;|\").*?(?:&quot;|\")}/g;
    const matches = html.match(jsonPattern);
    
    if (matches) {
      matches.forEach(jsonStr => {
        try {
          const game = JSON.parse(jsonStr.replace(/&quot;/g, '"')
            .replace(/&amp;/g, '&')
            .replace(/&#39;/g, "'")
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>'));
          
          const lastActivityDate = game.updated_at ? new Date(game.updated_at) : new Date(0);
          const lastActivity = this.formatLastActivity(lastActivityDate);
          
          const newGame = {
            id: game.id,
            title: game.name,
            lastActivity,
            lastActivityDate: game.updated_at || '',
            platform: null,
            created_at: game.created_at || '',
            updated_at: game.updated_at || '',
            url: game.url
          };
  
          const existingGame = gamesMap.get(game.id);
          if (!existingGame || 
              (newGame.updated_at && existingGame.updated_at && 
               new Date(newGame.updated_at) > new Date(existingGame.updated_at))) {
            gamesMap.set(game.id, newGame);
          }
        } catch (e) {
          console.error('Error parsing game JSON:', e);
        }
      });
    }
  
    return Array.from(gamesMap.values());
  }

  private async parseGameDetails(game: GameBasic): Promise<GameDetailed | null> {
    try {
      const html = await this.fetchHTML(`${this.baseUrl}/games/${game.id}`);
  
      const jsonPattern = /{(?:&quot;|\").*?(?:&quot;|\")}/g;
      const matches = html.match(jsonPattern);
      
      if (!matches || matches.length === 0) {
        console.warn(`No JSON data found for game ${game.id}`);
        return null;
      }
  
      const jsonStr = matches[0]
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>');
  
      try {
        const gameData = JSON.parse(jsonStr);
  
        return {
          ...game,
          playTime: null,
          playCount: 0,
          added: gameData.created_at,
          modified: gameData.updated_at,
          platform: null,
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
          notes: null
        };
      } catch (parseError) {
        console.error(`Error parsing JSON for game ${game.id}:`, parseError);
        return null;
      }
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
        lastUpdated: new Date(data.lastUpdated)
      };
    } catch (error) {
      console.error('Error reading cache:', error);
      return null;
    }
  }

  private setCache(games: GameDetailed[]) {
    try {
      const cacheData: CacheData = {
        games,
        timestamp: Date.now(),
        lastUpdated: new Date()
      };
      localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
    } catch (error) {
      console.error('Error setting cache:', error);
    }
  }

  private async fetchAndUpdateGames(existingGames: GameDetailed[] = []): Promise<GameDetailed[]> {
    this.isUpdating = true;
    const uniqueGames = new Map<string, GameBasic>();
    let page = 1;
    let hasNextPage = true;
    const updatedGames: GameDetailed[] = [...existingGames];

    try {
      while (hasNextPage) {
        const html = await this.fetchHTML(`${this.baseUrl}/games?page=${page}`);
        const pageGames = this.parseGamesList(html);
        
        for (const game of pageGames) {
          const existing = uniqueGames.get(game.id);
          if (!existing || (game.lastActivityDate && (!existing.lastActivityDate || 
              new Date(game.lastActivityDate) > new Date(existing.lastActivityDate)))) {
            uniqueGames.set(game.id, game);
            
            const details = await this.parseGameDetails(game);
            if (details) {
              const index = updatedGames.findIndex(g => g.id === details.id);
              if (index >= 0) {
                updatedGames[index] = details;
              } else {
                updatedGames.push(details);
              }
              this.notifyUpdates(updatedGames);
            }
          }
        }

        hasNextPage = html.includes('rel="next"');
        page++;
      }

      this.setCache(updatedGames);
      return updatedGames;
    } finally {
      this.isUpdating = false;
    }
  }

  async fetchAllGames(useCache = true): Promise<{ games: GameDetailed[]; lastUpdated: Date | null }> {
    const cached = this.getCache();
    
    if (useCache && cached?.games) {
      if (Date.now() - cached.timestamp > UPDATE_INTERVAL && !this.isUpdating) {
        this.fetchAndUpdateGames(cached.games).catch(console.error);
      }
      return { games: cached.games, lastUpdated: cached.lastUpdated };
    }

    const games = await this.fetchAndUpdateGames();
    return { games, lastUpdated: new Date() };
  }

  async validateProfile(): Promise<ShareniteProfile | null> {
    try {
      const html = await this.fetchHTML(`${this.baseUrl}/games`);
      const games = this.extractJsonFromHtml(html);
  
      if (games.length > 0) {
        const lastGame = games[0];
        return {
          username: this.baseUrl.split('/').pop() || '',
          totalGames: games.length,
          lastUpdated: lastGame.updated_at
        };
      }
  
      return null;
    } catch (error) {
      console.error('Error validating profile:', error);
      return null;
    }
  }

  private extractJsonFromHtml(html: string): ShareniteGameData[] {
    try {
      const matches = html.match(/\{(?:&quot;|\").*?(?:&quot;|\")\}/g);
      if (!matches) return [];
  
      return matches.map(jsonStr => {
        try {
          const decodedStr = jsonStr
            .replace(/&quot;/g, '"')
            .replace(/&amp;/g, '&')
            .replace(/&#39;/g, "'")
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>');
  
          const parsed = JSON.parse(decodedStr);
          if (
            parsed.id && 
            parsed.name && 
            parsed.created_at && 
            parsed.updated_at && 
            parsed.url
          ) {
            return parsed as ShareniteGameData;
          }
          return null;
        } catch (e) {
          console.error('Error parsing individual JSON object:', e);
          return null;
        }
      }).filter((obj): obj is ShareniteGameData => obj !== null);
    } catch (error) {
      console.error('Error extracting JSON from HTML:', error);
      return [];
    }
  }
}
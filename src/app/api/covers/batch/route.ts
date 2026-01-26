import { NextResponse } from 'next/server';
import { getCacheMany, setCacheMany, cacheKeys, getCacheHeaders, CACHE_TTL } from '@/lib/cache';

const IGDB_CLIENT_ID = process.env.IGDB_CLIENT_ID;
const IGDB_CLIENT_SECRET = process.env.IGDB_CLIENT_SECRET;

let tokenCache: { token: string; expiry: number } | null = null;

interface GameImages {
  screenshot: string | null;
  cover: string | null;
}

interface BatchRequest {
  games: string[];
  type?: 'screenshot' | 'cover';
}

interface BatchResponse {
  covers: Record<string, string | null>;
  notFound: string[];
}

const MAX_BATCH_SIZE = 10;

async function getAccessToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiry) {
    return tokenCache.token;
  }

  const response = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${IGDB_CLIENT_ID}&client_secret=${IGDB_CLIENT_SECRET}&grant_type=client_credentials`,
    { method: 'POST' }
  );

  if (!response.ok) {
    throw new Error(`Token request failed: ${response.status}`);
  }

  const data = await response.json();
  tokenCache = {
    token: data.access_token,
    expiry: Date.now() + (data.expires_in * 1000) - 300000
  };

  return tokenCache.token;
}

async function searchGamesIGDB(gameNames: string[], retryCount = 0): Promise<Map<string, GameImages>> {
  const results = new Map<string, GameImages>();

  if (gameNames.length === 0) return results;

  try {
    const token = await getAccessToken();

    const searchConditions = gameNames
      .map(name => `name ~ *"${name.replace(/"/g, '\\"')}"*`)
      .join(' | ');

    const response = await fetch('https://api.igdb.com/v4/games', {
      method: 'POST',
      headers: {
        'Client-ID': IGDB_CLIENT_ID!,
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        'Content-Type': 'text/plain'
      },
      body: `fields name,cover.image_id,screenshots.image_id;
             where cover != null & (${searchConditions});
             limit ${Math.min(gameNames.length * 2, 50)};`
    });

    if (response.status === 429 && retryCount < 3) {
      await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
      return searchGamesIGDB(gameNames, retryCount + 1);
    }

    if (!response.ok) {
      throw new Error(`IGDB request failed: ${response.status}`);
    }

    const games = await response.json() as Array<{
      name: string;
      cover?: { image_id: string };
      screenshots?: Array<{ image_id: string }>;
    }>;

    const normalizedSearchNames = new Map(
      gameNames.map(name => [name.toLowerCase(), name])
    );

    for (const game of games) {
      const normalizedName = game.name.toLowerCase();

      for (const [searchLower, originalName] of normalizedSearchNames) {
        if (normalizedName.includes(searchLower) || searchLower.includes(normalizedName)) {
          if (!results.has(originalName)) {
            results.set(originalName, {
              screenshot: game.screenshots?.[0]?.image_id
                ? `https://images.igdb.com/igdb/image/upload/t_screenshot_big/${game.screenshots[0].image_id}.jpg`
                : null,
              cover: game.cover?.image_id
                ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${game.cover.image_id}.jpg`
                : null
            });
          }
          break;
        }
      }
    }

    return results;
  } catch (error) {
    if (retryCount < 3) {
      await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
      return searchGamesIGDB(gameNames, retryCount + 1);
    }
    throw error;
  }
}

export async function POST(request: Request) {
  try {
    if (!IGDB_CLIENT_ID || !IGDB_CLIENT_SECRET) {
      return NextResponse.json(
        { error: 'IGDB API credentials not configured' },
        { status: 500 }
      );
    }

    const body = await request.json() as BatchRequest;
    const gameNames = body.games?.slice(0, MAX_BATCH_SIZE) || [];
    const type = body.type || 'screenshot';

    if (gameNames.length === 0) {
      return NextResponse.json({ covers: {}, notFound: [] });
    }

    const cacheKeyList = gameNames.map(name => cacheKeys.cover(name));
    const cachedResults = await getCacheMany<GameImages>(cacheKeyList);

    const covers: Record<string, string | null> = {};
    const notFound: string[] = [];
    const uncachedNames: string[] = [];

    gameNames.forEach((name, index) => {
      const cached = cachedResults[index];
      if (cached) {
        const url = type === 'cover' ? cached.cover : cached.screenshot;
        covers[name] = url;
        if (!url) notFound.push(name);
      } else {
        uncachedNames.push(name);
      }
    });

    if (uncachedNames.length > 0) {
      const igdbResults = await searchGamesIGDB(uncachedNames);
      const toCache: Array<{ key: string; value: GameImages; ttl: number }> = [];

      for (const name of uncachedNames) {
        const images = igdbResults.get(name) || { screenshot: null, cover: null };
        const url = type === 'cover' ? images.cover : images.screenshot;
        covers[name] = url;

        if (!url) {
          notFound.push(name);
        }

        toCache.push({
          key: cacheKeys.cover(name),
          value: images,
          ttl: CACHE_TTL.COVERS
        });
      }

      if (toCache.length > 0) {
        await setCacheMany(toCache);
      }
    }

    const response: BatchResponse = { covers, notFound };

    return NextResponse.json(response, {
      headers: getCacheHeaders(CACHE_TTL.COVERS, true),
    });
  } catch (error) {
    console.error('Batch covers error:', error);
    return NextResponse.json(
      { error: 'Error processing batch request' },
      { status: 500 }
    );
  }
}

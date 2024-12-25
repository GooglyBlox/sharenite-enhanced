import { NextResponse } from 'next/server';

const IGDB_CLIENT_ID = process.env.IGDB_CLIENT_ID;
const IGDB_CLIENT_SECRET = process.env.IGDB_CLIENT_SECRET;

let tokenCache: { token: string; expiry: number } | null = null;

interface IGDBGame {
  id: number;
  cover?: {
    image_id: string;
  };
  screenshots?: Array<{
    image_id: string;
  }>;
}

interface GameImages {
  screenshot: string | null;
  cover: string | null;
}

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

async function searchGame(gameName: string, retryCount = 0): Promise<GameImages> {
  try {
    const token = await getAccessToken();

    const response = await fetch('https://api.igdb.com/v4/games', {
      method: 'POST',
      headers: {
        'Client-ID': IGDB_CLIENT_ID!,
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        'Content-Type': 'text/plain'
      },
      body: `search "${gameName}";
            fields name,cover.image_id,screenshots.image_id;
            where cover != null;
            limit 1;`
    });

    if (response.status === 429 && retryCount < 3) {
      await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
      return searchGame(gameName, retryCount + 1);
    }

    if (!response.ok) {
      throw new Error(`IGDB request failed: ${response.status}`);
    }

    const games = await response.json() as IGDBGame[];

    if (!games.length) {
      return { screenshot: null, cover: null };
    }

    const game = games[0];
    
    const screenshot = game.screenshots?.[0]?.image_id
      ? `https://images.igdb.com/igdb/image/upload/t_screenshot_big/${game.screenshots[0].image_id}.jpg`
      : null;

    const cover = game.cover?.image_id
      ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${game.cover.image_id}.jpg`
      : null;

    return { screenshot, cover };
  } catch (error) {
    if (retryCount < 3) {
      await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
      return searchGame(gameName, retryCount + 1);
    }
    throw error;
  }
}

const cache = new Map<string, { images: GameImages; timestamp: number }>();
const CACHE_DURATION = 24 * 60 * 60 * 1000;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const gameName = searchParams.get('name');
    const type = searchParams.get('type') || 'screenshot';

    if (!IGDB_CLIENT_ID || !IGDB_CLIENT_SECRET) {
      return NextResponse.json(
        { error: 'IGDB API credentials not configured' },
        { status: 500 }
      );
    }

    if (!gameName) {
      return NextResponse.json(
        { error: 'Game name is required' },
        { status: 400 }
      );
    }

    const cached = cache.get(gameName);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      const url = type === 'cover' ? cached.images.cover : cached.images.screenshot;
      return NextResponse.json(
        url ? { coverUrl: url } : { error: 'Cover not found' },
        { status: url ? 200 : 404 }
      );
    }

    const images = await searchGame(gameName);
    cache.set(gameName, { images, timestamp: Date.now() });

    const url = type === 'cover' ? images.cover : images.screenshot;
    if (!url) {
      return NextResponse.json(
        { error: 'Cover not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ coverUrl: url });
  } catch (error) {
    console.error('API route error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error fetching game cover' },
      { status: 500 }
    );
  }
}
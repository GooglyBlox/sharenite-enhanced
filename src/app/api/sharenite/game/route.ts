import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { getCache, setCache, cacheKeys, getCacheHeaders, CACHE_TTL } from '@/lib/cache';

interface GameDetails {
  platform: string;
  playTime: string | null;
  playCount: number;
  added: string | null;
  modified: string | null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'Game URL is required' }, { status: 400 });
  }

  const gameId = url.split('/').pop() || url;
  const cacheKey = cacheKeys.gameDetails(gameId);

  const cached = await getCache<GameDetails>(cacheKey);
  if (cached) {
    return NextResponse.json(cached, {
      headers: getCacheHeaders(CACHE_TTL.GAME_DETAILS),
    });
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    });

    const html = await response.text();
    const $ = cheerio.load(html);

    const details: GameDetails = {
      platform: $('.game-details .row.justify-content-around .text-muted')
        .first()
        .text()
        .trim(),

      playTime: $('.card-text .text-muted:contains("Playtime:")')
        .text()
        .replace('Playtime:', '')
        .trim() || null,

      playCount: parseInt(
        $('.card-text .text-muted:contains("Play count:")')
          .text()
          .replace('Play count:', '')
          .trim() || '0'
      ),

      added: $('.card .card-body p:contains("Added:") abbr').attr('title') || null,

      modified: $('.card .card-body p:contains("Modified:")')
        .text()
        .includes('Never.') ? null :
        $('.card .card-body p:contains("Modified:") abbr').attr('title') || null
    };

    await setCache(cacheKey, details, CACHE_TTL.GAME_DETAILS);

    return NextResponse.json(details, {
      headers: getCacheHeaders(CACHE_TTL.GAME_DETAILS),
    });
  } catch (error) {
    console.error('Error fetching game details:', error);
    return NextResponse.json({ error: 'Error fetching game details' }, { status: 500 });
  }
}

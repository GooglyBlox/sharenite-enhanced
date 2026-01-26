import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { getCacheMany, setCacheMany, cacheKeys, getCacheHeaders, CACHE_TTL } from '@/lib/cache';

interface GameDetails {
  platform: string;
  playTime: string | null;
  playCount: number;
  added: string | null;
  modified: string | null;
}

interface BatchRequest {
  urls: string[];
}

interface BatchResponse {
  games: Record<string, GameDetails>;
  errors: string[];
}

const MAX_BATCH_SIZE = 50;
const CONCURRENT_LIMIT = 10;

function parseGameHtml(html: string): GameDetails {
  const $ = cheerio.load(html);

  return {
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
}

async function fetchGameDetails(url: string): Promise<GameDetails> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html',
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch: ${response.status}`);
  }

  const html = await response.text();
  return parseGameHtml(html);
}

async function processBatch<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  concurrency: number
): Promise<Array<{ item: T; result: R | null; error?: string }>> {
  const results: Array<{ item: T; result: R | null; error?: string }> = [];

  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(
      batch.map(item => processor(item))
    );

    batch.forEach((item, index) => {
      const result = batchResults[index];
      if (result.status === 'fulfilled') {
        results.push({ item, result: result.value });
      } else {
        results.push({ item, result: null, error: result.reason?.message || 'Unknown error' });
      }
    });
  }

  return results;
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as BatchRequest;
    const urls = body.urls?.slice(0, MAX_BATCH_SIZE) || [];

    if (urls.length === 0) {
      return NextResponse.json({ games: {}, errors: [] });
    }

    const gameIds = urls.map(url => url.split('/').pop() || url);
    const cacheKeyList = gameIds.map(id => cacheKeys.gameDetails(id));
    const cachedResults = await getCacheMany<GameDetails>(cacheKeyList);

    const urlToGameId = new Map(urls.map((url, i) => [url, gameIds[i]]));
    const games: Record<string, GameDetails> = {};
    const errors: string[] = [];
    const uncachedUrls: string[] = [];

    urls.forEach((url, index) => {
      const cached = cachedResults[index];
      if (cached) {
        games[url] = cached;
      } else {
        uncachedUrls.push(url);
      }
    });

    if (uncachedUrls.length > 0) {
      const fetchResults = await processBatch(
        uncachedUrls,
        fetchGameDetails,
        CONCURRENT_LIMIT
      );

      const toCache: Array<{ key: string; value: GameDetails; ttl: number }> = [];

      for (const { item: url, result, error } of fetchResults) {
        if (result) {
          games[url] = result;
          const gameId = urlToGameId.get(url)!;
          toCache.push({
            key: cacheKeys.gameDetails(gameId),
            value: result,
            ttl: CACHE_TTL.GAME_DETAILS
          });
        } else if (error) {
          errors.push(`${url}: ${error}`);
        }
      }

      if (toCache.length > 0) {
        await setCacheMany(toCache);
      }
    }

    const response: BatchResponse = { games, errors };

    return NextResponse.json(response, {
      headers: getCacheHeaders(CACHE_TTL.GAME_DETAILS),
    });
  } catch (error) {
    console.error('Batch game details error:', error);
    return NextResponse.json(
      { error: 'Error processing batch request' },
      { status: 500 }
    );
  }
}

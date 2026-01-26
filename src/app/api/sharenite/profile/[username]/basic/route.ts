import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { GameBasic } from '@/types';
import { getCache, setCache, cacheKeys, getCacheHeaders, CACHE_TTL } from '@/lib/cache';

interface BasicProfile {
  username: string;
  totalGames: number;
  recentGames: GameBasic[];
}

export async function GET(
  request: Request,
  context: { params: { username: string } }
) {
  const { params } = context;
  const cacheKey = cacheKeys.profile(params.username);

  const cached = await getCache<BasicProfile>(cacheKey);
  if (cached) {
    return NextResponse.json(cached, {
      headers: getCacheHeaders(CACHE_TTL.PROFILE),
    });
  }

  try {
    const response = await fetch(`https://www.sharenite.link/profiles/${params.username}/games`);
    const html = await response.text();
    const $ = cheerio.load(html);

    const totalGamesText = $('p:contains("Total games listed:")').text();
    const totalGames = parseInt(totalGamesText.match(/\d+/)?.[0] || '0');

    if (totalGames === 0) {
      return NextResponse.json(
        { error: 'Profile not found or not public' },
        { status: 404 }
      );
    }

    const recentGames: GameBasic[] = [];
    $('.list-group-item').each((_, element) => {
      const id = $(element).attr('id')?.replace('game_', '');
      if (!id || id === 'header') return;

      const title = $(element).find('strong').first().text().trim();
      const lastActivityElement = $(element).find('abbr').first();
      const lastActivity = lastActivityElement.text().trim();
      const lastActivityDate = lastActivityElement.attr('title')?.trim() || new Date().toISOString();

      if (title && lastActivity) {
        recentGames.push({
          id,
          title,
          lastActivity,
          lastActivityDate,
          platform: null,
          url: `https://www.sharenite.link/profiles/${params.username}/games/${id}`
        });
      }
    });

    const result: BasicProfile = {
      username: params.username,
      totalGames,
      recentGames: recentGames.slice(0, 5)
    };

    await setCache(cacheKey, result, CACHE_TTL.PROFILE);

    return NextResponse.json(result, {
      headers: getCacheHeaders(CACHE_TTL.PROFILE),
    });
  } catch (error) {
    console.error('Error fetching basic profile:', error);
    return NextResponse.json(
      { error: 'Error fetching profile' },
      { status: 500 }
    );
  }
}

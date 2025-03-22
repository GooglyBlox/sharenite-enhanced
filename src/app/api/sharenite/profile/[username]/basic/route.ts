import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { GameBasic } from '@/types';

export async function GET(
  request: Request,
  context: { params: { username: string } }
) {
  const { params } = context;
  
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

    return NextResponse.json({
      username: params.username,
      totalGames,
      recentGames: recentGames.slice(0, 5)
    });
  } catch (error) {
    console.error('Error fetching basic profile:', error);
    return NextResponse.json(
      { error: 'Error fetching profile' },
      { status: 500 }
    );
  }
}
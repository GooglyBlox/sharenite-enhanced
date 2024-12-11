/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get('username');
  const page = searchParams.get('page') || '1';

  if (!username) {
    return NextResponse.json({ error: 'Username is required' }, { status: 400 });
  }

  try {
    const response = await fetch(`https://www.sharenite.link/profiles/${username}/games?page=${page}`);
    const html = await response.text();
    const $ = cheerio.load(html);

    const totalGamesText = $('p:contains("Total games listed:")').text();
    const totalGames = parseInt(totalGamesText.match(/\d+/)?.[0] || '0');

    if (totalGames === 0) {
      return NextResponse.json({ error: 'Profile not found or not public' }, { status: 404 });
    }

    const games: any[] = [];
    $('.list-group-item').each((_, element) => {
      const id = $(element).attr('id')?.replace('game_', '');
      if (!id || id === 'header') return;

      const title = $(element).find('strong').first().text().trim();
      const lastActivity = $(element).find('abbr').first().text().trim();
      const lastActivityDate = $(element).find('abbr').first().attr('title')?.trim();

      if (title && lastActivity) {
        games.push({
          id,
          title,
          lastActivity,
          lastActivityDate,
          url: `https://www.sharenite.link/profiles/${username}/games/${id}`
        });
      }
    });

    const lastPage = $('a.page-link').last().text().trim();
    const hasNextPage = $('a.page-link[rel="next"]').length > 0;

    return NextResponse.json({
      games,
      pagination: {
        currentPage: parseInt(page),
        totalPages: parseInt(lastPage.replace('Last »', '')) || 1,
        hasNextPage
      },
      totalGames
    });
  } catch (error) {
    console.error('Error fetching Sharenite profile:', error);
    return NextResponse.json({ error: 'Error fetching profile' }, { status: 500 });
  }
}
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

export async function GET(
  request: Request,
  context: { params: { username: string; page: string } }
) {
  const { params } = context;
  
  try {
    const url = `https://www.sharenite.link/profiles/${params.username}/games?page=${params.page}&query=`;

    const response = await fetch(url, {
      headers: {
        'Accept': 'text/html',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch page ${params.page}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const games: any[] = [];
    $('.list-group-item').each((_, element) => {
      const id = $(element).attr('id')?.replace('game_', '');
      if (!id || id === 'header') return;

      const title = $(element).find('strong').first().text().trim();
      const lastActivityCol = $(element).find('.col-3').first();

      const lastActivity = lastActivityCol.find('abbr').length > 0
        ? lastActivityCol.find('abbr').first().text().trim()
        : lastActivityCol.text().trim();

      const lastActivityDate = lastActivityCol.find('abbr').attr('title') || new Date().toISOString();

      if (title) {
        games.push({
          id,
          title,
          lastActivity,
          lastActivityDate,
          url: `https://www.sharenite.link/profiles/${params.username}/games/${id}`
        });
      }
    });

    let totalPages = 1;
    $('.pagination .page-link').each((_, element) => {
      const linkText = $(element).text();
      if (linkText.includes('Last »')) {
        const href = $(element).attr('href');
        const pageNumMatch = href?.match(/page=(\d+)/);
        if (pageNumMatch) {
          totalPages = parseInt(pageNumMatch[1]);
        }
      }
    });

    console.log(`Page ${params.page}: Found ${games.length} games. Total pages: ${totalPages}`);

    const currentPage = parseInt(params.page);
    const hasMore = currentPage < totalPages;

    return NextResponse.json({
      games,
      pagination: {
        currentPage,
        totalPages,
        hasMore
      }
    });
  } catch (error) {
    console.error(`Error fetching page ${params.page}:`, error);
    return NextResponse.json({ error: 'Error fetching games' }, { status: 500 });
  }
}
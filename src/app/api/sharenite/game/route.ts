import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');
  
    if (!url) {
      return NextResponse.json({ error: 'Game URL is required' }, { status: 400 });
    }
  
    try {
      const response = await fetch(url);
      const html = await response.text();
      const $ = cheerio.load(html);
  
      const details = {
        playTime: $('.text-muted:contains("Playtime:")').text().split(':')[1]?.trim() || null,
        playCount: parseInt($('.text-muted:contains("Play count:")').text().split(':')[1]?.trim() || '0'),
        added: $('strong:contains("Added:")').parent().find('abbr').attr('title') || null,
        modified: $('strong:contains("Modified:")').parent().find('abbr').attr('title') || null,
        platform: $('.text-muted:contains("PC")').first().text().trim() || null
      };
  
      return NextResponse.json(details);
    } catch (error) {
      console.error('Error fetching game details:', error);
      return NextResponse.json({ error: 'Error fetching game details' }, { status: 500 });
    }
  }
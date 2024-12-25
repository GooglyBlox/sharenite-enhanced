import { NextResponse } from 'next/server';
import { ShareniteAPI } from '@/utils/api';

export async function GET(
  request: Request,
  { params }: { params: { username: string } }
) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const pageSize = parseInt(searchParams.get('pageSize') || '20');

  try {
    const api = new ShareniteAPI(params.username);
    const games = await api.fetchGamePage(page, pageSize);
    
    return NextResponse.json(games);
  } catch (error) {
    console.error('Error fetching games page:', error);
    return NextResponse.json(
      { error: 'Error fetching games' },
      { status: 500 }
    );
  }
}
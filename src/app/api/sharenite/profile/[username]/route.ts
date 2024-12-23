import { NextResponse } from 'next/server';
import { ShareniteAPI } from '@/utils/api';

export async function GET(
  request: Request,
  { params }: { params: { username: string } }
) {
  try {
    const api = new ShareniteAPI(params.username);
    const { games, lastUpdated } = await api.fetchAllGames();

    const profile = await api.validateProfile();
    if (!profile) {
      return NextResponse.json(
        { error: 'Profile not found or not public' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      username: params.username,
      games,
      lastUpdated,
      profile
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    return NextResponse.json(
      { error: 'Error fetching profile' },
      { status: 500 }
    );
  }
}
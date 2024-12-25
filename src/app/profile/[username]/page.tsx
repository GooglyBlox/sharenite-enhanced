/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { GameDetailed } from '@/types';
import ProfileModal from '@/components/ProfileModal';

interface BasicProfile {
  username: string;
  totalGames: number;
  recentGames: GameDetailed[];
}

export default function SharedProfilePage() {
  const params = useParams();
  const [basicProfile, setBasicProfile] = useState<BasicProfile | null>(null);
  const [allGames, setAllGames] = useState<GameDetailed[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadedCount, setLoadedCount] = useState(0);

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const fetchPage = async (page: number): Promise<any> => {
    const response = await fetch(`/api/sharenite/profile/${params.username}/games/${page}?chunk=50`);
    if (!response.ok) throw new Error(`Failed to fetch page ${page}`);
    return await response.json();
  };

  const fetchGameDetails = async (url: string): Promise<any> => {
    const response = await fetch(`/api/sharenite/game?url=${encodeURIComponent(url)}`);
    if (!response.ok) throw new Error('Failed to fetch game details');
    return await response.json();
  };

  const fetchPageWithRetry = async (page: number, retries = 3): Promise<any> => {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await fetchPage(page);
      } catch (error) {
        if (attempt === retries) throw error;
        await sleep(1000 * (attempt + 1));
      }
    }
  };

  const fetchGameDetailsWithRetry = async (url: string, retries = 3): Promise<any> => {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await fetchGameDetails(url);
      } catch (error) {
        if (attempt === retries) throw error;
        await sleep(1000 * (attempt + 1));
      }
    }
  };

  const processBatch = async (games: any[], updateProgress = true) => {
    const batchSize = 5;
    const processedGames: GameDetailed[] = [];

    for (let i = 0; i < games.length; i += batchSize) {
      const batch = games.slice(i, i + batchSize);
      const detailedGames = await Promise.all(
        batch.map(async game => ({
          ...game,
          ...await fetchGameDetailsWithRetry(game.url)
        }))
      );

      processedGames.push(...detailedGames);

      if (updateProgress) {
        setAllGames(prev => [...prev, ...detailedGames]);
        setLoadedCount(prev => prev + detailedGames.length);
      }

      await sleep(100);
    }

    return processedGames;
  };

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const basicResponse = await fetch(`/api/sharenite/profile/${params.username}/basic`);
        if (!basicResponse.ok) throw new Error('Failed to load profile');
        const basicData = await basicResponse.json();
        setBasicProfile(basicData);

        setAllGames([]);
        setLoadedCount(0);
        
        let currentPage = 1;
        let hasMore = true;
        const allFetchedGames: GameDetailed[] = [];

        while (hasMore) {
          const pageData = await fetchPageWithRetry(currentPage);
          if (!pageData.games.length) break;

          console.log(`Processing page ${currentPage} (${pageData.games.length} games)`);
          
          const processedGames = await processBatch(pageData.games);
          allFetchedGames.push(...processedGames);
          
          hasMore = pageData.pagination.hasMore;
          currentPage++;

          setAllGames([...allFetchedGames]);
          setLoadedCount(allFetchedGames.length);
        }

        console.log(`Finished loading ${allFetchedGames.length} games`);
      } catch (err) {
        console.error('Error in fetchProfile:', err);
        setError(err instanceof Error ? err.message : 'Failed to load profile');
      } finally {
        setIsLoading(false);
      }
    };

    if (params.username) {
      fetchProfile();
    }
  }, [params.username]);

  if (!basicProfile) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="relative">
          <div className="w-16 h-16 rounded-full border-[3px] border-zinc-800">
            <div className="absolute inset-0 rounded-full border-t-3 border-zinc-100 animate-[spin_800ms_linear_infinite]" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      <ProfileModal
        username={basicProfile.username}
        totalGames={basicProfile.totalGames}
        loadedGames={loadedCount}
        recentGames={allGames
          .filter(game => {
            return game.lastActivity !== 'Never.' && game.playTime && game.playTime !== "00:00:00";
          })
          .sort((a, b) => {
            if (a.lastActivity === 'Never.') return 1;
            if (b.lastActivity === 'Never.') return -1;
            
            const dateA = a.lastActivityDate ? new Date(a.lastActivityDate) : new Date(0);
            const dateB = b.lastActivityDate ? new Date(b.lastActivityDate) : new Date(0);
            return dateB.getTime() - dateA.getTime();
          })
          .slice(0, 5)}
        allGames={allGames}
        onClose={() => window.close()}
        isShared
        isLoading={isLoading}
      />

    </div>
  );
}
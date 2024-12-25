/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { GameDetailed } from '@/types';
import ProfileModal from '@/components/ProfileModal';
import { useInView } from 'react-intersection-observer';

export default function SharedProfilePage() {
  const params = useParams();
  const [basicProfile, setBasicProfile] = useState<{
    username: string;
    totalGames: number;
    recentGames: GameDetailed[];
  } | null>(null);
  const [allGames, setAllGames] = useState<GameDetailed[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadedCount, setLoadedCount] = useState(0);

  const { ref, inView } = useInView({
    threshold: 0,
  });

  useEffect(() => {
    const fetchBasicProfile = async () => {
      try {
        const response = await fetch(
          `/api/sharenite/profile/${params.username}/basic`
        );
        
        if (!response.ok) {
          throw new Error('Failed to load profile');
        }
        
        const data = await response.json();
        setBasicProfile(data);
        setLoadedCount(0);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load profile');
      } finally {
        setIsLoading(false);
      }
    };

    if (params.username) {
      fetchBasicProfile();
    }
  }, [params.username]);

  useEffect(() => {
    const loadMoreGames = async () => {
      if (!hasMore || !basicProfile) return;

      try {
        const response = await fetch(
          `/api/sharenite/profile/${params.username}/games?page=${page}&pageSize=20`
        );
        
        if (!response.ok) {
          throw new Error('Failed to load games');
        }
        
        const data = await response.json();
        setAllGames(prev => [...prev, ...data.games]);
        setHasMore(data.hasMore);
        setLoadedCount(prev => prev + data.games.length);
        setPage(prev => prev + 1);
      } catch (error) {
        console.error('Error loading more games:', error);
      }
    };

    if (inView && !isLoading) {
      loadMoreGames();
    }
  }, [inView, page, hasMore, isLoading, params.username, basicProfile]);

  if (!basicProfile) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-zinc-100 mb-4">Loading Profile</h1>
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-zinc-100 mx-auto" />
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
        recentGames={basicProfile.recentGames}
        allGames={allGames}
        onClose={() => window.close()}
        isShared
        isLoading={isLoading}
      />
      {hasMore && (
        <div ref={ref} className="w-full h-20 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-zinc-100" />
        </div>
      )}
    </div>
  );
}
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { GameDetailed, ShareniteProfile } from '@/types';
import ProfileModal from '@/components/ProfileModal';

export default function SharedProfilePage() {
  const params = useParams();
  const [mounted, setMounted] = useState(false);
  const [profileData, setProfileData] = useState<{
    username: string;
    games: GameDetailed[];
    lastUpdated: string;
    profile: ShareniteProfile;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setMounted(true);
    
    const fetchProfile = async () => {
      try {        
        const response = await fetch(
          `/api/sharenite/profile/${params.username}`,
          { 
            cache: 'force-cache',
            headers: {
              'Accept': 'application/json'
            }
          }
        );
                
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to load profile');
        }
        
        const data = await response.json();
        setProfileData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load profile');
      } finally {
        setIsLoading(false);
      }
    };

    if (params.username) {
      fetchProfile();
    }
  }, [params.username]);

  if (!mounted || isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-zinc-100" />
      </div>
    );
  }

  if (error || !profileData) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-zinc-100 mb-4">Profile Not Found</h1>
          <p className="text-zinc-400">{error || 'Unable to load profile'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      <ProfileModal
        username={profileData.username}
        games={profileData.games}
        onClose={() => window.close()}
        isShared
      />
    </div>
  );
}
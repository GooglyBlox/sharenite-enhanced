'use client';

import { useState, useEffect } from 'react';
import Onboarding from '../components/Onboarding';
import MainLayout from '../components/MainLayout';

export default function Home() {
  const [username, setUsername] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const savedUsername = localStorage.getItem('sharenite-username');
    setUsername(savedUsername);
    setIsLoading(false);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-zinc-100" />
      </div>
    );
  }

  if (!username) {
    return <Onboarding onComplete={setUsername} />;
  }

  return <MainLayout username={username} />;
}
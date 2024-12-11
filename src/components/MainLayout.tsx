/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useState, useEffect, useRef } from 'react';
import { Menu, Grid, List, RefreshCw } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import GameCover from './GameCover';
import { ShareniteAPI } from '@/utils/api';
import { GameDetailed, ShareniteState } from '@/types';

interface MainLayoutState extends ShareniteState {
  isUpdating: boolean;
  lastUpdated: Date | null;
}

interface MainLayoutProps {
  username: string;
}

export default function MainLayout({ username }: MainLayoutProps) {
  const [state, setState] = useState<MainLayoutState>({
    games: [],
    isLoading: true,
    viewMode: 'list',
    isUpdating: false,
    lastUpdated: null
  });

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'recent' | 'alphabetical'>('recent');
  const apiRef = useRef<ShareniteAPI | null>(null);

  useEffect(() => {
    apiRef.current = new ShareniteAPI(username);
    
    const unsubscribe = apiRef.current.onUpdate(updatedGames => {
      setState(prev => ({
        ...prev,
        games: updatedGames,
        isUpdating: true,
        lastUpdated: new Date()
      }));
    });

    loadGames();

    return () => {
      unsubscribe();
    };
  }, [username]);

  const normalizeTitle = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const loadGames = async () => {
    if (!apiRef.current) return;

    setState(prev => ({ ...prev, isLoading: true }));

    try {
      const { games, lastUpdated } = await apiRef.current.fetchAllGames();
      setState(prev => ({
        ...prev,
        games,
        lastUpdated,
        isLoading: false,
        error: undefined,
        isUpdating: false
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: 'Error loading games',
        isLoading: false,
        isUpdating: false
      }));
    }
  };

  const getFilteredAndSortedGames = (
    games: GameDetailed[],
    searchQuery: string,
    sortOrder: 'recent' | 'alphabetical'
  ): GameDetailed[] => {
    const filtered = [...games].filter(game => {
      if (!searchQuery) return true;

      const normalizedQuery = normalizeTitle(searchQuery);
      const normalizedTitle = normalizeTitle(game.title);

      return normalizedTitle.includes(normalizedQuery);
    });

    return filtered.sort((a, b) => {
      if (sortOrder === 'alphabetical') {
        const titleA = normalizeTitle(a.title);
        const titleB = normalizeTitle(b.title);
        return titleA.localeCompare(titleB);
      } else {
        const dateA = a.lastActivityDate ? new Date(a.lastActivityDate) : new Date(0);
        const dateB = b.lastActivityDate ? new Date(b.lastActivityDate) : new Date(0);
        return dateB.getTime() - dateA.getTime();
      }
    });
  };

  const filteredGames = getFilteredAndSortedGames(state.games, searchQuery, sortOrder);

  const formatLastUpdated = (date: Date) => {
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  const GameCard = ({ game }: { game: GameDetailed }) => (
    <Card className="bg-zinc-800 border-zinc-700 hover:border-zinc-600 transition-all">
      <CardContent className="p-4">
        <div className="aspect-video bg-zinc-700 rounded mb-4 relative overflow-hidden">
          <GameCover title={game.title} />
        </div>
        <h3 className="text-lg font-semibold mb-2 text-zinc-100 line-clamp-1">{game.title}</h3>
        {game.platform && (
          <p className="text-sm text-zinc-400">{game.platform}</p>
        )}
        <p className="text-sm text-zinc-400 mt-1">Last played: {game.lastActivity}</p>
        {game.playTime && (
          <p className="text-sm text-zinc-400 mt-1">Playtime: {game.playTime}</p>
        )}
      </CardContent>
    </Card>
  );

  const GameListItem = ({ game }: { game: GameDetailed }) => (
    <div className="bg-zinc-800 p-4 rounded hover:bg-zinc-700 transition-all">
      <div className="flex justify-between items-center">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-zinc-100 line-clamp-1">{game.title}</h3>
          {game.platform && (
            <p className="text-sm text-zinc-400">{game.platform}</p>
          )}
        </div>
        <div className="text-right ml-4">
          <p className="text-sm text-zinc-300">{game.lastActivity}</p>
          {game.playTime && (
            <p className="text-sm text-zinc-400">{game.playTime}</p>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="flex">
        <aside
          className={`${isSidebarOpen ? 'w-64' : 'w-20'
            } bg-zinc-900 h-screen fixed left-0 top-0 transition-all duration-300`}
        >
          <div className="p-4">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="w-full text-left px-4 py-2 text-zinc-100 hover:bg-zinc-800 rounded flex items-center gap-2"
            >
              <Menu size={20} />
              {isSidebarOpen && <span>Menu</span>}
            </button>

            <nav className="mt-8 space-y-2">
              <button className="w-full text-left px-4 py-2 text-zinc-100 hover:bg-zinc-800 rounded flex items-center gap-2">
                <Grid size={20} />
                {isSidebarOpen && <span>All Games</span>}
              </button>
            </nav>

            {isSidebarOpen && (
              <div className="absolute bottom-4 left-4 right-4">
                <div className="bg-zinc-800 rounded p-4">
                  <p className="text-sm text-zinc-400">Logged in as</p>
                  <p className="font-semibold">{username}</p>
                </div>
              </div>
            )}
          </div>
        </aside>

        <main className={`flex-1 transition-all duration-300 ${isSidebarOpen ? 'ml-64' : 'ml-20'}`}>
          <header className="bg-zinc-900 p-4 sticky top-0 z-10">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex items-center space-x-4">
                <h1 className="text-xl font-bold">All Games</h1>
                {state.lastUpdated && (
                  <div className="flex items-center space-x-2 text-sm text-zinc-400">
                    {state.isUpdating && (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    )}
                    <span>Updated {formatLastUpdated(state.lastUpdated)}</span>
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
                <input
                  type="text"
                  placeholder="Search games..."
                  className="px-3 py-2 bg-zinc-800 rounded border border-zinc-700 focus:border-zinc-600 focus:outline-none"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />

                <div className="flex gap-2">
                  <select
                    className="px-3 py-2 bg-zinc-800 rounded border border-zinc-700"
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value as 'recent' | 'alphabetical')}
                  >
                    <option value="recent">Recently Played</option>
                    <option value="alphabetical">Alphabetical</option>
                  </select>

                  <button
                    onClick={() => setState(prev => ({ ...prev, viewMode: 'grid' }))}
                    className={`p-2 rounded ${state.viewMode === 'grid' ? 'bg-zinc-700' : 'bg-zinc-800'}`}
                  >
                    <Grid size={20} />
                  </button>
                  <button
                    onClick={() => setState(prev => ({ ...prev, viewMode: 'list' }))}
                    className={`p-2 rounded ${state.viewMode === 'list' ? 'bg-zinc-700' : 'bg-zinc-800'}`}
                  >
                    <List size={20} />
                  </button>
                </div>
              </div>
            </div>
          </header>

          <div className="p-4">
            {state.isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-pulse">
                {[...Array(12)].map((_, i) => (
                  <div key={i} className="bg-zinc-800 rounded aspect-video" />
                ))}
              </div>
            ) : state.error ? (
              <div className="text-center py-12">
                <p className="text-red-400">{state.error}</p>
                <button
                  onClick={loadGames}
                  className="mt-4 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                >
                  Retry
                </button>
              </div>
            ) : filteredGames.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-zinc-400">No games found</p>
              </div>
            ) : state.viewMode === 'grid' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredGames.map(game => (
                  <GameCard key={game.id} game={game} />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredGames.map(game => (
                  <GameListItem key={game.id} game={game} />
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
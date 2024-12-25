/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useState, useEffect, useRef } from 'react';
import { Menu, Grid, List, RefreshCw, Clock, Plus, Trophy } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import GameCover from './GameCover';
import ProfileModal from './ProfileModal';
import Dropdown from './ui/dropdown';
import SearchBar from './ui/searchbar';
import { ShareniteAPI } from '@/utils/api';
import { GameDetailed, ShareniteState } from '@/types';

interface MainLayoutState extends ShareniteState {
  isUpdating: boolean;
  lastUpdated: Date | null;
  currentView: 'all' | 'recent' | 'not-started';
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
    lastUpdated: null,
    currentView: 'all'
  });

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'recent' | 'alphabetical'>('recent');
  const apiRef = useRef<ShareniteAPI | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

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
    let filtered = [...games];

    switch (state.currentView) {
      case 'recent':
        filtered = filtered.filter(game => 
          game.playTime && game.playTime !== "00:00:00"
        );
        break;
      case 'not-started':
        filtered = filtered.filter(game => 
          !game.playTime || game.playTime === "00:00:00"
        );
        break;
    }

    if (searchQuery) {
      const normalizedQuery = normalizeTitle(searchQuery);
      filtered = filtered.filter(game => {
        const normalizedTitle = normalizeTitle(game.title);
        return normalizedTitle.includes(normalizedQuery);
      });
    }

    return filtered.sort((a, b) => {
      if (sortOrder === 'alphabetical') {
        const titleA = normalizeTitle(a.title);
        const titleB = normalizeTitle(b.title);
        return titleA.localeCompare(titleB);
      } else {
        const hasZeroPlaytimeA = a.playTime === "00:00:00";
        const hasZeroPlaytimeB = b.playTime === "00:00:00";
        
        if (hasZeroPlaytimeA !== hasZeroPlaytimeB) {
          return hasZeroPlaytimeA ? 1 : -1;
        }
        
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

  const formatPlaytime = (totalMinutes: number): string => {
    if (totalMinutes < 60) {
      return `${totalMinutes} mins`;
    }
  
    const days = Math.floor(totalMinutes / (24 * 60));
    const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
    const minutes = totalMinutes % 60;
  
    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0 && days === 0) parts.push(`${minutes}m`);
  
    return parts.join(' ');
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
        <p className="text-sm text-zinc-400 mt-1">Last activity: {game.lastActivity}</p>
        {game.playTime && game.playTime !== "00:00:00" ? (
        <p className="text-sm text-zinc-400 mt-1">Playtime: {game.playTime}</p>
        ) : (
        <p className="text-sm text-zinc-400 mt-1">Never played</p>
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
          {game.playTime && game.playTime !== "00:00:00" ? (
          <p className="text-sm text-zinc-400">{game.playTime}</p>
          ) : (
          <p className="text-sm text-zinc-400">Never played</p>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="flex">
        <aside
          className={`${isSidebarOpen ? 'w-64' : 'w-20'} bg-zinc-900 h-screen fixed left-0 top-0 transition-all duration-300`}
        >
          <div className="p-4 flex flex-col h-full">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="w-full text-left px-4 py-2 text-zinc-100 hover:bg-zinc-800 rounded flex items-center gap-2"
            >
              <Menu size={20} />
              {isSidebarOpen && <span>Menu</span>}
            </button>

            <nav className="mt-8 space-y-6">
              <div>
                <div className="px-4 mb-2">
                  {isSidebarOpen && (
                    <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                      Library
                    </span>
                  )}
                </div>
                <div className="space-y-1">
                  <button
                    onClick={() => setState(prev => ({ ...prev, currentView: 'all' }))}
                    className={`w-full text-left px-4 py-2 rounded flex items-center gap-2
                      ${state.currentView === 'all' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'}`}
                  >
                    <Grid size={20} />
                    {isSidebarOpen && <span>All Games</span>}
                  </button>
                  <button
                    onClick={() => setState(prev => ({ ...prev, currentView: 'recent' }))}
                    className={`w-full text-left px-4 py-2 rounded flex items-center gap-2
                      ${state.currentView === 'recent' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'}`}
                  >
                    <Clock size={20} />
                    {isSidebarOpen && <span>Recently Played</span>}
                  </button>
                  <button
                    onClick={() => setState(prev => ({ ...prev, currentView: 'not-started' }))}
                    className={`w-full text-left px-4 py-2 rounded flex items-center gap-2
                      ${state.currentView === 'not-started' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'}`}
                  >
                    <Plus size={20} />
                    {isSidebarOpen && <span>Not Started</span>}
                  </button>
                </div>
              </div>

              {isSidebarOpen && (
                <div>
                    <div className="px-4 mb-2">
                    <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                        Statistics
                    </span>
                    </div>
                    <div className="bg-zinc-800 rounded p-4 space-y-3">
                    <div>
                        <div className="text-sm text-zinc-400">Total Games</div>
                        <div className="text-xl font-semibold text-zinc-100">
                        {state.games.length}
                        </div>
                    </div>
                    <div>
                        <div className="text-sm text-zinc-400">Games Played</div>
                        <div className="text-xl font-semibold text-zinc-100">
                        {state.games.filter(game => game.playTime && game.playTime !== "00:00:00").length}
                        </div>
                    </div>
                    <div>
                        <div className="text-sm text-zinc-400">Total Playtime</div>
                        {(() => {
                        const totalMinutes = state.games.reduce((total, game) => {
                            if (!game.playTime || game.playTime === "00:00:00") return total;
                            const [hours, minutes] = game.playTime.split(':').map(Number);
                            return total + (hours * 60) + minutes;
                        }, 0);

                        return (
                            <div 
                            className="text-xl font-semibold text-zinc-100"
                            title={`${totalMinutes} minutes`}
                            >
                            {formatPlaytime(totalMinutes)}
                            </div>
                        );
                        })()}
                    </div>
                    </div>
                </div>
                )}
            </nav>

            <div className="mt-auto">
            {isSidebarOpen ? (
                <div className="rounded p-4">
                <div className="flex items-center gap-3 cursor-pointer" onClick={() => setIsProfileModalOpen(true)}>
                    <div className="w-10 h-10 rounded bg-zinc-700 flex items-center justify-center">
                    <span className="text-lg font-semibold text-zinc-300">
                        {username[0].toUpperCase()}
                    </span>
                    </div>
                    <div>
                    <div className="font-semibold text-zinc-100">{username}</div>
                    <div className="text-sm text-zinc-400">View Profile</div>
                    </div>
                </div>
                </div>
            ) : (
                <div 
                className="flex justify-center w-full cursor-pointer"
                onClick={() => setIsProfileModalOpen(true)}
                >
                <div className="w-10 h-10 rounded bg-zinc-800 flex items-center justify-center">
                    <span className="text-lg font-semibold text-zinc-300">
                    {username[0].toUpperCase()}
                    </span>
                </div>
                </div>
            )}
            </div>
          </div>
        </aside>

        <main className={`flex-1 transition-all duration-300 ${isSidebarOpen ? 'ml-64' : 'ml-20'}`}>
          <header className="bg-zinc-900 p-4 sticky top-0 z-10">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex items-center space-x-4">
                <h1 className="text-xl font-bold">
                  {state.currentView === 'all' && 'All Games'}
                  {state.currentView === 'recent' && 'Recently Played'}
                  {state.currentView === 'not-started' && 'Not Started'}
                </h1>
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
                <SearchBar
                  value={searchQuery}
                  onChange={setSearchQuery}
                  placeholder="Search games..."
                  className="w-full sm:w-auto min-w-[250px]"
                />

                <div className="flex gap-2">
                  <Dropdown
                    value={sortOrder}
                    onChange={(value) => setSortOrder(value as 'recent' | 'alphabetical')}
                    options={[
                      { value: 'recent', label: 'Recently Played' },
                      { value: 'alphabetical', label: 'Alphabetical' }
                    ]}
                    className="w-50"
                  />

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

        {isProfileModalOpen && (
            <ProfileModal
              username={username}
              totalGames={state.profile?.totalGames || state.games.length}
              loadedGames={state.games.length}
              recentGames={state.games
                .filter(game => game.playTime && game.playTime !== "00:00:00")
                .sort((a, b) => {
                  const dateA = a.lastActivityDate ? new Date(a.lastActivityDate) : new Date(0);
                  const dateB = b.lastActivityDate ? new Date(b.lastActivityDate) : new Date(0);
                  return dateB.getTime() - dateA.getTime();
                })
                .slice(0, 5)}
              allGames={state.games}
              onClose={() => setIsProfileModalOpen(false)}
              isLoading={state.isLoading}
            />
        )}
      </div>
    );
  }
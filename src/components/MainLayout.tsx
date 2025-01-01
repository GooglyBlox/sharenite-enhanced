/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Menu, Grid, List, Clock, Plus, Play, Heart, CheckSquare, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import GameCover from './GameCover';
import ProfileModal from './ProfileModal';
import GameActions from './GameActions';
import GameThumbnail from './GameThumbnail';
import UpdateIndicator from './UpdateIndicator';
import Dropdown from './ui/dropdown';
import SearchBar from './ui/searchbar';
import { ShareniteAPI } from '@/utils/api';
import { GameDetailed, ShareniteState } from '@/types';

interface MainLayoutState extends ShareniteState {
  isUpdating: boolean;
  lastUpdated: Date | null;
  currentView: 'all' | 'recent' | 'not-started' | 'favorites' | 'current' | 'completed';
  sortOrder: 'last-played' | 'most-played' | 'alphabetical' | 'recently-added' | 'platform' | 'playtime';
  totalGames: number;
  nextUpdateTime: number | null;
  currentPage: number;
  itemsPerPage: number;
}

interface MainLayoutProps {
  username: string;
}

const UPDATE_INTERVAL = 30 * 60 * 1000;

export default function MainLayout({ username }: MainLayoutProps) {
  const [state, setState] = useState<MainLayoutState>({
    games: [],
    isLoading: true,
    viewMode: 'list',
    isUpdating: false,
    lastUpdated: null,
    currentView: 'all',
    sortOrder: 'last-played',
    totalGames: 0,
    nextUpdateTime: null,
    currentPage: 1,
    itemsPerPage: 100
  });

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const apiRef = useRef<ShareniteAPI | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [nickname, setNickname] = useState<string | null>(
    localStorage.getItem('sharenite-nickname')
  );

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

  const handleToggleFavorite = useCallback((gameId: string) => {
    setState(prev => {
      const updatedGames = prev.games.map(game =>
        game.id === gameId
          ? { ...game, isFavorite: !game.isFavorite }
          : game
      );
  
      if (apiRef.current) {
        const game = updatedGames.find(g => g.id === gameId);
        if (game) {
          apiRef.current.updateGamePreferences(gameId, { isFavorite: game.isFavorite });
        }
      }
  
      return {
        ...prev,
        games: updatedGames
      };
    });
  }, []);
  
  const handleToggleCompleted = (gameId: string) => {
    setState(prev => {
      const updatedGames = prev.games.map(game =>
        game.id === gameId
          ? { ...game, isCompleted: !game.isCompleted }
          : game
      );
  
      if (apiRef.current) {
        const game = updatedGames.find(g => g.id === gameId);
        if (game) {
          apiRef.current.updateGamePreferences(gameId, { isCompleted: game.isCompleted });
        }
      }
  
      return {
        ...prev,
        games: updatedGames
      };
    });
  };

  const handleRequestUpdate = async () => {
    if (state.isUpdating || !apiRef.current) return;
  
    setState(prev => ({ ...prev, isUpdating: true }));
    
    try {
      const { games, lastUpdated, profile } = await apiRef.current.fetchAllGames(false);
      setState(prev => ({
        ...prev,
        games,
        lastUpdated,
        totalGames: profile?.totalGames || games.length,
        isUpdating: false,
        error: undefined,
        nextUpdateTime: Date.now() + UPDATE_INTERVAL
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: 'Error updating games',
        isUpdating: false
      }));
    }
  };

  const loadGames = async () => {
    if (!apiRef.current) return;

    setState(prev => ({ ...prev, isLoading: true }));

    try {
      const { games, lastUpdated, profile } = await apiRef.current.fetchAllGames();
      setState(prev => ({
        ...prev,
        games,
        lastUpdated,
        totalGames: profile?.totalGames || games.length,
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
  
  const timeToMinutes = (timeStr: string): number => {
    if (!timeStr || timeStr === "00:00:00") return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return (hours * 60) + minutes;
  };

  const getFilteredAndSortedGames = useCallback((
    games: GameDetailed[],
    searchQuery: string,
    sortOrder: MainLayoutState['sortOrder'],
    currentView: MainLayoutState['currentView']
  ): GameDetailed[] => {
    let filtered = [...games];
  
    switch (currentView) {
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
      case 'favorites':
        filtered = filtered.filter(game => game.isFavorite);
        break;
      case 'current':
        filtered = filtered.filter(game => {
          if (!game.lastActivityDate) return false;
          const lastPlayed = new Date(game.lastActivityDate);
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          return lastPlayed >= sevenDaysAgo;
        });
        break;
      case 'completed':
        filtered = filtered.filter(game => game.isCompleted);
        break;
    }
  
    if (searchQuery) {
      const normalizedQuery = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(game => 
        game.title.toLowerCase().includes(normalizedQuery)
      );
    }
  
    return filtered.sort((a, b) => {
      switch (sortOrder) {
        case 'most-played':
          const timeA = timeToMinutes(a.playTime || "00:00:00");
          const timeB = timeToMinutes(b.playTime || "00:00:00");
          return timeB - timeA;
        
        case 'alphabetical':
          return a.title.localeCompare(b.title);
        
        case 'last-played':
          const dateA = a.lastActivityDate ? new Date(a.lastActivityDate) : new Date(0);
          const dateB = b.lastActivityDate ? new Date(b.lastActivityDate) : new Date(0);
          return dateB.getTime() - dateA.getTime();
        
        case 'recently-added':
          const addedA = a.added ? new Date(a.added) : new Date(0);
          const addedB = b.added ? new Date(b.added) : new Date(0);
          return addedB.getTime() - addedA.getTime();
        
        case 'platform':
          return (a.platform || '').localeCompare(b.platform || '');
        
        case 'playtime':
          const playtimeA = timeToMinutes(a.playTime || "00:00:00");
          const playtimeB = timeToMinutes(b.playTime || "00:00:00");
          return playtimeA - playtimeB;
        
        default:
          return 0;
      }
    });
  }, []);

  const filteredGames = useMemo(() => 
    getFilteredAndSortedGames(
      state.games, 
      searchQuery, 
      state.sortOrder,
      state.currentView
    ),
    [state.games, searchQuery, state.sortOrder, state.currentView, getFilteredAndSortedGames]
  );

  const paginatedGames = useMemo(() => {
    const startIndex = (state.currentPage - 1) * state.itemsPerPage;
    return filteredGames.slice(startIndex, startIndex + state.itemsPerPage);
  }, [filteredGames, state.currentPage, state.itemsPerPage]);

  const totalPages = Math.ceil(filteredGames.length / state.itemsPerPage);

  const handlePageChange = (page: number) => {
    setState(prev => ({ ...prev, currentPage: page }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    setState(prev => ({ ...prev, currentPage: 1 }));
  }, [searchQuery, state.currentView, state.sortOrder]);

  const Pagination = () => {
    if (totalPages <= 1) return null;

    const visiblePages = 5;
    let startPage = Math.max(1, state.currentPage - Math.floor(visiblePages / 2));
    const endPage = Math.min(totalPages, startPage + visiblePages - 1);

    if (endPage - startPage + 1 < visiblePages) {
      startPage = Math.max(1, endPage - visiblePages + 1);
    }

    const pages = Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i);

    return (
      <div className="flex justify-center items-center gap-2 my-6">
        <button
          onClick={() => handlePageChange(state.currentPage - 1)}
          disabled={state.currentPage === 1}
          className="p-2 rounded bg-zinc-800 text-zinc-300 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronLeft size={20} />
        </button>

        {startPage > 1 && (
          <>
            <button
              onClick={() => handlePageChange(1)}
              className={`w-10 h-10 rounded ${
                state.currentPage === 1 ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-300'
              }`}
            >
              1
            </button>
            {startPage > 2 && <span className="text-zinc-500">...</span>}
          </>
        )}

        {pages.map(page => (
          <button
            key={page}
            onClick={() => handlePageChange(page)}
            className={`w-10 h-10 rounded ${
              state.currentPage === page ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-300'
            }`}
          >
            {page}
          </button>
        ))}

        {endPage < totalPages && (
          <>
            {endPage < totalPages - 1 && <span className="text-zinc-500">...</span>}
            <button
              onClick={() => handlePageChange(totalPages)}
              className={`w-10 h-10 rounded ${
                state.currentPage === totalPages ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-300'
              }`}
            >
              {totalPages}
            </button>
          </>
        )}

        <button
          onClick={() => handlePageChange(state.currentPage + 1)}
          disabled={state.currentPage === totalPages}
          className="p-2 rounded bg-zinc-800 text-zinc-300 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronRight size={20} />
        </button>
      </div>
    );
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
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-lg font-semibold text-zinc-100 line-clamp-1">{game.title}</h3>
          <GameActions 
            game={game}
            onToggleFavorite={handleToggleFavorite}
            onToggleCompleted={handleToggleCompleted}
            showAll={true}
          />
        </div>
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
  
  const GameListItem = ({ game }: { game: GameDetailed }) => {
    const [isHovered, setIsHovered] = useState(false);
  
    return (
      <div 
        className="bg-zinc-800 p-4 rounded hover:bg-zinc-700 transition-all"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="flex gap-4">
          <div className="w-16 h-24 flex-shrink-0">
            <GameThumbnail title={game.title} className="w-full h-full" />
          </div>
          <div className="flex-1 flex justify-between items-center">
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-semibold text-zinc-100 line-clamp-1">{game.title}</h3>
                <div className={`transition-opacity duration-200 ${isHovered ? 'opacity-100' : 'opacity-100'}`}>
                  <GameActions 
                    game={game}
                    onToggleFavorite={handleToggleFavorite}
                    onToggleCompleted={handleToggleCompleted}
                    showAll={isHovered}
                  />
                </div>
              </div>
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
      </div>
    );
  };

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
                    onClick={() => setState(prev => ({ ...prev, currentView: 'current' }))}
                    className={`w-full text-left px-4 py-2 rounded flex items-center gap-2
                      ${state.currentView === 'current' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'}`}
                  >
                    <Play size={20} />
                    {isSidebarOpen && <span>Currently Playing</span>}
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
                    onClick={() => setState(prev => ({ ...prev, currentView: 'favorites' }))}
                    className={`w-full text-left px-4 py-2 rounded flex items-center gap-2
                      ${state.currentView === 'favorites' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'}`}
                  >
                    <Heart size={20} />
                    {isSidebarOpen && <span>Favorites</span>}
                  </button>
                  <button
                    onClick={() => setState(prev => ({ ...prev, currentView: 'completed' }))}
                    className={`w-full text-left px-4 py-2 rounded flex items-center gap-2
                      ${state.currentView === 'completed' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'}`}
                  >
                    <CheckSquare size={20} />
                    {isSidebarOpen && <span>Completed</span>}
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
                          {state.totalGames}
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
                                {(nickname || username)[0].toUpperCase()}
                            </span>
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="font-semibold text-zinc-100 truncate">{nickname || username}</div>
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
                            {(nickname || username)[0].toUpperCase()}
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
                  {state.currentView === 'current' && 'Currently Playing'}
                  {state.currentView === 'recent' && 'Recently Played'}
                  {state.currentView === 'favorites' && 'Favorites'}
                  {state.currentView === 'completed' && 'Completed'}
                  {state.currentView === 'not-started' && 'Not Started'}
                </h1>
                {state.lastUpdated && (
                  <UpdateIndicator
                    isUpdating={state.isUpdating}
                    lastUpdated={state.lastUpdated}
                    onRequestUpdate={handleRequestUpdate}
                    updateInterval={UPDATE_INTERVAL}
                  />
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
                    value={state.sortOrder}
                    onChange={(value) => setState(prev => ({ ...prev, sortOrder: value as MainLayoutState['sortOrder'] }))}
                    options={[
                      { value: 'last-played', label: 'Last Played' },
                      { value: 'most-played', label: 'Most Played' },
                      { value: 'alphabetical', label: 'Alphabetical' },
                      { value: 'recently-added', label: 'Recently Added' },
                      { value: 'platform', label: 'Platform' },
                      { value: 'playtime', label: 'Playtime (Low to High)' }
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
              ) : (
                <>
                  {state.viewMode === 'grid' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {paginatedGames.map(game => (
                        <GameCard key={game.id} game={game} />
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {paginatedGames.map(game => (
                        <GameListItem key={game.id} game={game} />
                      ))}
                    </div>
                  )}
                  <Pagination />
                </>
              )}
            </div>
          </main>
        </div>

        {isProfileModalOpen && (
            <ProfileModal
              username={username}
              nickname={nickname}
              onNicknameChange={(newNickname) => setNickname(newNickname)}
              totalGames={state.totalGames}
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
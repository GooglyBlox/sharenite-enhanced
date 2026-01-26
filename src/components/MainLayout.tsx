import React, { useState, useEffect, useRef, useCallback, useMemo, useDeferredValue, memo } from 'react';
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
import { GameDetailed } from '@/types';

type ViewType = 'all' | 'recent' | 'not-started' | 'favorites' | 'current' | 'completed';
type SortOrder = 'last-played' | 'most-played' | 'alphabetical' | 'recently-added' | 'platform' | 'playtime';
type ViewMode = 'grid' | 'list';

interface MainLayoutProps {
  username: string;
}

const UPDATE_INTERVAL = 30 * 60 * 1000;

function formatPlaytime(totalMinutes: number): string {
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
}

function timeToMinutes(timeStr: string): number {
  if (!timeStr || timeStr === "00:00:00") return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return (hours * 60) + minutes;
}

interface GameCardProps {
  game: GameDetailed;
  onToggleFavorite: (id: string) => void;
  onToggleCompleted: (id: string) => void;
}

const GameCard = memo(function GameCard({ game, onToggleFavorite, onToggleCompleted }: GameCardProps) {
  return (
    <Card className="bg-zinc-800 border-zinc-700 hover:border-zinc-600 transition-all">
      <CardContent className="p-4">
        <div className="aspect-video bg-zinc-700 rounded mb-4 relative overflow-hidden">
          <GameCover title={game.title} />
        </div>
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-lg font-semibold text-zinc-100 line-clamp-1">{game.title}</h3>
          <GameActions
            game={game}
            onToggleFavorite={onToggleFavorite}
            onToggleCompleted={onToggleCompleted}
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
});

interface GameListItemProps {
  game: GameDetailed;
  onToggleFavorite: (id: string) => void;
  onToggleCompleted: (id: string) => void;
}

const GameListItem = memo(function GameListItem({ game, onToggleFavorite, onToggleCompleted }: GameListItemProps) {
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
                  onToggleFavorite={onToggleFavorite}
                  onToggleCompleted={onToggleCompleted}
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
});

interface StatisticsProps {
  games: GameDetailed[];
  totalGames: number;
}

const Statistics = memo(function Statistics({ games, totalGames }: StatisticsProps) {
  const stats = useMemo(() => {
    const gamesPlayed = games.filter(game => game.playTime && game.playTime !== "00:00:00").length;
    const totalMinutes = games.reduce((total, game) => {
      if (!game.playTime || game.playTime === "00:00:00") return total;
      const [hours, minutes] = game.playTime.split(':').map(Number);
      return total + (hours * 60) + minutes;
    }, 0);

    return { gamesPlayed, totalMinutes };
  }, [games]);

  return (
    <div className="bg-zinc-800 rounded p-4 space-y-3">
      <div>
        <div className="text-sm text-zinc-400">Total Games</div>
        <div className="text-xl font-semibold text-zinc-100">{totalGames}</div>
      </div>
      <div>
        <div className="text-sm text-zinc-400">Games Played</div>
        <div className="text-xl font-semibold text-zinc-100">{stats.gamesPlayed}</div>
      </div>
      <div>
        <div className="text-sm text-zinc-400">Total Playtime</div>
        <div className="text-xl font-semibold text-zinc-100" title={`${stats.totalMinutes} minutes`}>
          {formatPlaytime(stats.totalMinutes)}
        </div>
      </div>
    </div>
  );
});

export default function MainLayout({ username }: MainLayoutProps) {
  const [games, setGames] = useState<GameDetailed[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [totalGames, setTotalGames] = useState(0);

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [currentView, setCurrentView] = useState<ViewType>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('last-played');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 100;

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const apiRef = useRef<ShareniteAPI | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [nickname, setNickname] = useState<string | null>(
    typeof window !== 'undefined' ? localStorage.getItem('sharenite-nickname') : null
  );

  useEffect(() => {
    apiRef.current = new ShareniteAPI(username);

    const unsubscribe = apiRef.current.onUpdate(updatedGames => {
      setGames(updatedGames);
      setIsUpdating(true);
      setLastUpdated(new Date());
    });

    loadGames();

    return () => {
      unsubscribe();
    };
  }, [username]);

  const handleToggleFavorite = useCallback((gameId: string) => {
    setGames(prev => prev.map(game =>
      game.id === gameId ? { ...game, isFavorite: !game.isFavorite } : game
    ));

    if (apiRef.current) {
      const game = games.find(g => g.id === gameId);
      if (game) {
        apiRef.current.updateGamePreferences(gameId, { isFavorite: !game.isFavorite });
      }
    }
  }, [games]);

  const handleToggleCompleted = useCallback((gameId: string) => {
    setGames(prev => prev.map(game =>
      game.id === gameId ? { ...game, isCompleted: !game.isCompleted } : game
    ));

    if (apiRef.current) {
      const game = games.find(g => g.id === gameId);
      if (game) {
        apiRef.current.updateGamePreferences(gameId, { isCompleted: !game.isCompleted });
      }
    }
  }, [games]);

  const handleRequestUpdate = useCallback(async () => {
    if (isUpdating || !apiRef.current) return;

    setIsUpdating(true);

    try {
      const { games: newGames, lastUpdated: newLastUpdated, profile } = await apiRef.current.fetchAllGames(false);
      setGames(newGames);
      setLastUpdated(newLastUpdated);
      setTotalGames(profile?.totalGames || newGames.length);
      setIsUpdating(false);
      setError(undefined);
    } catch {
      setError('Error updating games');
      setIsUpdating(false);
    }
  }, [isUpdating]);

  const loadGames = async () => {
    if (!apiRef.current) return;

    setIsLoading(true);

    try {
      const { games: newGames, lastUpdated: newLastUpdated, profile } = await apiRef.current.fetchAllGames();
      setGames(newGames);
      setLastUpdated(newLastUpdated);
      setTotalGames(profile?.totalGames || newGames.length);
      setIsLoading(false);
      setError(undefined);
      setIsUpdating(false);
    } catch {
      setError('Error loading games');
      setIsLoading(false);
      setIsUpdating(false);
    }
  };

  const filteredGames = useMemo(() => {
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

    if (deferredSearchQuery) {
      const normalizedQuery = deferredSearchQuery.toLowerCase().trim();
      filtered = filtered.filter(game =>
        game.title.toLowerCase().includes(normalizedQuery)
      );
    }

    if (sortOrder === 'playtime') {
      filtered = filtered.filter(item => item.playTime !== "Never played" && item.playTime !== "00:00:00");
    }

    return filtered.sort((a, b) => {
      switch (sortOrder) {
        case 'most-played':
          return timeToMinutes(b.playTime || "00:00:00") - timeToMinutes(a.playTime || "00:00:00");
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
          return timeToMinutes(a.playTime || "00:00:00") - timeToMinutes(b.playTime || "00:00:00");
        default:
          return 0;
      }
    });
  }, [games, deferredSearchQuery, sortOrder, currentView]);

  const paginatedGames = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredGames.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredGames, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredGames.length / itemsPerPage);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [deferredSearchQuery, currentView, sortOrder]);

  const handleViewChange = useCallback((view: ViewType) => {
    setCurrentView(view);
  }, []);

  const handleSortChange = useCallback((value: string) => {
    setSortOrder(value as SortOrder);
  }, []);

  const Pagination = () => {
    if (totalPages <= 1) return null;

    const visiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(visiblePages / 2));
    const endPage = Math.min(totalPages, startPage + visiblePages - 1);

    if (endPage - startPage + 1 < visiblePages) {
      startPage = Math.max(1, endPage - visiblePages + 1);
    }

    const pages = Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i);

    return (
      <div className="flex justify-center items-center gap-2 my-6">
        <button
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="p-2 rounded bg-zinc-800 text-zinc-300 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronLeft size={20} />
        </button>

        {startPage > 1 && (
          <>
            <button
              onClick={() => handlePageChange(1)}
              className={`w-10 h-10 rounded ${
                currentPage === 1 ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-300'
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
              currentPage === page ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-300'
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
                currentPage === totalPages ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-300'
              }`}
            >
              {totalPages}
            </button>
          </>
        )}

        <button
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="p-2 rounded bg-zinc-800 text-zinc-300 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronRight size={20} />
        </button>
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
                    onClick={() => handleViewChange('all')}
                    className={`w-full text-left px-4 py-2 rounded flex items-center gap-2
                      ${currentView === 'all' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'}`}
                  >
                    <Grid size={20} />
                    {isSidebarOpen && <span>All Games</span>}
                  </button>
                  <button
                    onClick={() => handleViewChange('current')}
                    className={`w-full text-left px-4 py-2 rounded flex items-center gap-2
                      ${currentView === 'current' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'}`}
                  >
                    <Play size={20} />
                    {isSidebarOpen && <span>Currently Playing</span>}
                  </button>
                  <button
                    onClick={() => handleViewChange('recent')}
                    className={`w-full text-left px-4 py-2 rounded flex items-center gap-2
                      ${currentView === 'recent' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'}`}
                  >
                    <Clock size={20} />
                    {isSidebarOpen && <span>Recently Played</span>}
                  </button>
                  <button
                    onClick={() => handleViewChange('favorites')}
                    className={`w-full text-left px-4 py-2 rounded flex items-center gap-2
                      ${currentView === 'favorites' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'}`}
                  >
                    <Heart size={20} />
                    {isSidebarOpen && <span>Favorites</span>}
                  </button>
                  <button
                    onClick={() => handleViewChange('completed')}
                    className={`w-full text-left px-4 py-2 rounded flex items-center gap-2
                      ${currentView === 'completed' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'}`}
                  >
                    <CheckSquare size={20} />
                    {isSidebarOpen && <span>Completed</span>}
                  </button>
                  <button
                    onClick={() => handleViewChange('not-started')}
                    className={`w-full text-left px-4 py-2 rounded flex items-center gap-2
                      ${currentView === 'not-started' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'}`}
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
                  <Statistics games={games} totalGames={totalGames} />
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
                  {currentView === 'all' && 'All Games'}
                  {currentView === 'current' && 'Currently Playing'}
                  {currentView === 'recent' && 'Recently Played'}
                  {currentView === 'favorites' && 'Favorites'}
                  {currentView === 'completed' && 'Completed'}
                  {currentView === 'not-started' && 'Not Started'}
                </h1>
                {lastUpdated && (
                  <UpdateIndicator
                    isUpdating={isUpdating}
                    lastUpdated={lastUpdated}
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
                    value={sortOrder}
                    onChange={handleSortChange}
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
                    onClick={() => setViewMode('grid')}
                    className={`p-2 rounded ${viewMode === 'grid' ? 'bg-zinc-700' : 'bg-zinc-800'}`}
                  >
                    <Grid size={20} />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-2 rounded ${viewMode === 'list' ? 'bg-zinc-700' : 'bg-zinc-800'}`}
                  >
                    <List size={20} />
                  </button>
                </div>
              </div>
            </div>
          </header>

          <div className="p-4">
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-pulse">
                {[...Array(12)].map((_, i) => (
                  <div key={i} className="bg-zinc-800 rounded aspect-video" />
                ))}
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <p className="text-red-400">{error}</p>
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
                {viewMode === 'grid' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {paginatedGames.map(game => (
                      <GameCard
                        key={game.id}
                        game={game}
                        onToggleFavorite={handleToggleFavorite}
                        onToggleCompleted={handleToggleCompleted}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {paginatedGames.map(game => (
                      <GameListItem
                        key={game.id}
                        game={game}
                        onToggleFavorite={handleToggleFavorite}
                        onToggleCompleted={handleToggleCompleted}
                      />
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
          totalGames={totalGames}
          loadedGames={games.length}
          recentGames={games
            .filter(game => game.playTime && game.playTime !== "00:00:00")
            .sort((a, b) => {
              const dateA = a.lastActivityDate ? new Date(a.lastActivityDate) : new Date(0);
              const dateB = b.lastActivityDate ? new Date(b.lastActivityDate) : new Date(0);
              return dateB.getTime() - dateA.getTime();
            })
            .slice(0, 5)}
          allGames={games}
          onClose={() => setIsProfileModalOpen(false)}
          isLoading={isLoading}
        />
      )}
    </div>
  );
}

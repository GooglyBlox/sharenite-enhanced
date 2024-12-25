import React, { useState } from 'react';
import { X, Copy, Check, Share2, Clock, GamepadIcon, Trophy } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { GameDetailed } from '@/types';

interface ProfileModalProps {
  username: string;
  totalGames: number;
  loadedGames: number;
  recentGames: GameDetailed[];
  allGames: GameDetailed[];
  onClose: () => void;
  isShared?: boolean;
  isLoading?: boolean;
}

export default function ProfileModal({ 
  username,
  totalGames,
  loadedGames,
  recentGames,
  allGames,
  onClose,
  isShared = false,
  isLoading = false
}: ProfileModalProps) {
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const calculateStats = () => {
    const playedGames = allGames.filter(game => 
      game.playTime && game.playTime !== "00:00:00"
    ).length;
    const totalMinutes = allGames.reduce((total, game) => {
      if (!game.playTime || game.playTime === "Never played") return total;
      const [hours, minutes] = game.playTime.split(':').map(Number);
      return total + (hours * 60) + minutes;
    }, 0);

    const platforms = allGames.reduce((acc, game) => {
      if (game.platform) {
        acc[game.platform] = (acc[game.platform] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    const topPlatforms = Object.entries(platforms)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3);

    return { totalGames, playedGames, totalMinutes, topPlatforms };
  };

  const formatPlaytime = (totalMinutes: number): string => {
    if (totalMinutes < 60) return `${totalMinutes}m`;
    const days = Math.floor(totalMinutes / (24 * 60));
    const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
    const minutes = totalMinutes % 60;
    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0 && days === 0) parts.push(`${minutes}m`);
    return parts.join(' ');
  };

  const generateShareLink = () => {
    const link = `${window.location.origin}/profile/${username}`;
    setShareLink(link);
  };

  const copyToClipboard = async () => {
    if (!shareLink) return;
    await navigator.clipboard.writeText(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const stats = calculateStats();

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-zinc-900 w-full max-w-2xl rounded-lg shadow-xl m-4 relative overflow-y-auto max-h-[90vh]">
        <div className="p-6">
          <div className="flex justify-between items-start mb-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center">
                <span className="text-3xl font-semibold text-zinc-300">
                  {username[0].toUpperCase()}
                </span>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-zinc-100">{username}</h2>
                <p className="text-zinc-400">Game Collection</p>
                {isLoading && loadedGames < totalGames && (
                  <p className="text-sm text-zinc-500">
                    Loading... ({loadedGames}/{totalGames} games)
                  </p>
                )}
              </div>
            </div>
            {!isShared && (
              <button
                onClick={onClose}
                className="text-zinc-400 hover:text-zinc-100 transition-colors"
              >
                <X size={24} />
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card className="bg-zinc-800 border-zinc-700">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-zinc-400 mb-2">
                  <GamepadIcon size={20} />
                  <span>Collection</span>
                </div>
                <div className="text-2xl font-bold text-zinc-100">
                  {totalGames}
                </div>
                <div className="text-sm text-zinc-400">
                  {stats.playedGames > 0 ? 
                    `${Math.round((stats.playedGames / totalGames) * 100)}% played` :
                    'No games played yet'
                  }
                </div>
              </CardContent>
            </Card>

            <Card className="bg-zinc-800 border-zinc-700">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-zinc-400 mb-2">
                  <Clock size={20} />
                  <span>Playtime</span>
                </div>
                <div className="text-2xl font-bold text-zinc-100" title={`${stats.totalMinutes} minutes`}>
                  {formatPlaytime(stats.totalMinutes)}
                </div>
                <div className="text-sm text-zinc-400">
                  {stats.playedGames} games played
                </div>
              </CardContent>
            </Card>

            <Card className="bg-zinc-800 border-zinc-700">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-zinc-400 mb-2">
                  <Trophy size={20} />
                  <span>Top Platform</span>
                </div>
                <div className="text-2xl font-bold text-zinc-100">
                  {stats.topPlatforms[0]?.[0] || 'N/A'}
                </div>
                <div className="text-sm text-zinc-400">
                  {stats.topPlatforms[0]?.[1] || 0} games
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="mb-6">
            <h3 className="text-lg font-semibold text-zinc-100 mb-4">Recently Played</h3>
            <div className="space-y-2">
              {recentGames.length > 0 ? (
                recentGames.map(game => (
                  <div 
                    key={game.id}
                    className="bg-zinc-800 p-3 rounded flex justify-between items-center"
                  >
                    <div>
                      <div className="font-medium text-zinc-100">{game.title}</div>
                      <div className="text-sm text-zinc-400">{game.platform}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-zinc-300">{game.playTime}</div>
                      <div className="text-sm text-zinc-400">{game.lastActivity}</div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-4 text-zinc-400">
                  No games played yet
                </div>
              )}
            </div>
          </div>

          {!isShared && (
            <div className="border-t border-zinc-800 pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Share2 size={20} className="text-zinc-400" />
                  <span className="font-medium text-zinc-100">Share Profile</span>
                </div>
                {!shareLink ? (
                  <button
                    onClick={generateShareLink}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium transition-colors"
                  >
                    Generate Link
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={shareLink}
                      readOnly
                      className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 w-64"
                    />
                    <button
                      onClick={copyToClipboard}
                      className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded transition-colors"
                      title={copied ? "Copied!" : "Copy to clipboard"}
                    >
                      {copied ? <Check size={20} className="text-green-500" /> : <Copy size={20} className="text-zinc-400" />}
                    </button>
                  </div>
                )}
              </div>

              {shareLink && (
                <Alert className="mt-4 bg-zinc-800 border-zinc-700">
                  <AlertDescription>
                    Anyone with this link can view your profile and game collection.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
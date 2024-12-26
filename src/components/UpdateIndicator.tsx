import React, { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';

interface UpdateIndicatorProps {
  isUpdating: boolean;
  lastUpdated: Date | null;
  onRequestUpdate?: () => void;
  updateInterval?: number;
}

const UpdateIndicator = ({ 
  isUpdating, 
  lastUpdated, 
  onRequestUpdate,
  updateInterval = 30 * 60 * 1000
}: UpdateIndicatorProps) => {
  const [nextUpdate, setNextUpdate] = useState<number | null>(null);
  const [shouldUpdate, setShouldUpdate] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!lastUpdated || isUpdating) return;

    const lastUpdateTime = lastUpdated.getTime();
    const nextUpdateTime = lastUpdateTime + updateInterval;

    if (now >= nextUpdateTime) {
      setShouldUpdate(true);
      setNextUpdate(null);
    } else {
      setNextUpdate(nextUpdateTime - now);
      setShouldUpdate(false);

      const timer = setTimeout(() => {
        setShouldUpdate(true);
        setNextUpdate(null);
      }, nextUpdateTime - now);

      return () => clearTimeout(timer);
    }
  }, [lastUpdated, updateInterval, isUpdating, now]);

  useEffect(() => {
    if (shouldUpdate && onRequestUpdate && !isUpdating) {
      onRequestUpdate();
      setShouldUpdate(false);
    }
  }, [shouldUpdate, onRequestUpdate, isUpdating]);

  const formatTimeRemaining = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const formatLastUpdated = (date: Date): string => {
    const diff = Math.floor((now - date.getTime()) / 1000);

    if (diff < 5) return 'Just now';
    if (diff < 60) return `${diff} seconds ago`;
    if (diff < 3600) {
      const minutes = Math.floor(diff / 60);
      return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
    }
    if (diff < 86400) {
      const hours = Math.floor(diff / 3600);
      return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
    }
    const days = Math.floor(diff / 86400);
    return `${days} ${days === 1 ? 'day' : 'days'} ago`;
  };

  if (!lastUpdated) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800/50 rounded-full transition-all">
      {isUpdating ? (
        <>
          <RefreshCw className="w-4 h-4 animate-spin text-blue-400" />
          <span className="text-sm text-zinc-300">Updating...</span>
        </>
      ) : (
        <>
          <div className={`w-2 h-2 rounded-full transition-colors duration-300 ${
            shouldUpdate ? 'bg-yellow-400' : 'bg-green-400'
          }`} />
          <span className="text-sm text-zinc-300 min-w-[90px]">
            Updated {formatLastUpdated(lastUpdated)}
          </span>
          {nextUpdate && !shouldUpdate && (
            <span className="text-sm text-zinc-500">
              · Next update in {formatTimeRemaining(nextUpdate)}
            </span>
          )}
        </>
      )}
    </div>
  );
};

export default UpdateIndicator;
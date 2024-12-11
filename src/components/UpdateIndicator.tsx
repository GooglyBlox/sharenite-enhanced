import React from 'react';
import { RefreshCw } from 'lucide-react';

interface UpdateIndicatorProps {
  isUpdating: boolean;
  lastUpdated: Date | null;
}

const UpdateIndicator = ({ isUpdating, lastUpdated }: UpdateIndicatorProps) => {
  const formatLastUpdated = (date: Date) => {
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  return (
    <div className="flex items-center space-x-2 text-sm text-zinc-400">
      {isUpdating && (
        <RefreshCw className="w-4 h-4 animate-spin" />
      )}
      {lastUpdated && (
        <span>Updated {formatLastUpdated(lastUpdated)}</span>
      )}
    </div>
  );
};

export default UpdateIndicator;
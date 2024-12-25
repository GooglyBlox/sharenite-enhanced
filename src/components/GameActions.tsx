import React from 'react';
import { Heart, CheckSquare } from 'lucide-react';
import { GameDetailed } from '@/types';

interface GameActionsProps {
  game: GameDetailed;
  onToggleFavorite: (gameId: string) => void;
  onToggleCompleted: (gameId: string) => void;
}

export default function GameActions({ game, onToggleFavorite, onToggleCompleted }: GameActionsProps) {
  return (
    <div className="flex gap-2">
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleFavorite(game.id);
        }}
        className={`p-1.5 rounded transition-colors ${
          game.isFavorite 
            ? 'bg-rose-500/20 text-rose-400' 
            : 'bg-zinc-700/50 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-300'
        }`}
        title={game.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
      >
        <Heart size={16} className={game.isFavorite ? 'fill-current' : ''} />
      </button>
      
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleCompleted(game.id);
        }}
        className={`p-1.5 rounded transition-colors ${
          game.isCompleted 
            ? 'bg-green-500/20 text-green-400' 
            : 'bg-zinc-700/50 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-300'
        }`}
        title={game.isCompleted ? 'Mark as incomplete' : 'Mark as completed'}
      >
        <CheckSquare size={16} className={game.isCompleted ? 'fill-current' : ''} />
      </button>
    </div>
  );
}
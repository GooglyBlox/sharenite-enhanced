import React, { useState, useRef } from 'react';
import { Search, X } from 'lucide-react';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

const SearchBar = ({ 
  value, 
  onChange, 
  placeholder = "Search...",
  className = '' 
}: SearchBarProps) => {
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClear = () => {
    onChange('');
    inputRef.current?.focus();
  };

  return (
    <div className={`relative ${className}`}>
      <div
        className={`
          flex items-center gap-2 px-3 py-2
          bg-zinc-800/90 backdrop-blur-sm
          border border-zinc-700/80 rounded
          group
          ${isFocused ? 'border-zinc-600 bg-zinc-800' : ''}
        `}
      >
        <Search 
          size={18} 
          className={`
            text-zinc-400 transition-colors duration-200
            ${isFocused || value ? 'text-zinc-200' : 'text-zinc-400'}
          `}
        />
        
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className={`
            flex-1 bg-transparent text-zinc-100
            placeholder:text-zinc-500
            focus:outline-none
            transition-colors duration-200
          `}
        />

        {value && (
          <button
            onClick={handleClear}
            className="text-zinc-400 hover:text-zinc-200 transition-colors duration-200"
            aria-label="Clear search"
          >
            <X size={18} />
          </button>
        )}
      </div>
    </div>
  );
};

export default SearchBar;
import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

interface DropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string; }[];
  className?: string;
}

const Dropdown = ({ value, onChange, options, className = '' }: DropdownProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(opt => opt.value === value);

  return (
    <div className={`relative min-w-[150px] ${className}`} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          w-full px-3 py-2 bg-zinc-800/90 backdrop-blur-sm
          border border-zinc-700/80 rounded border
          flex items-center justify-between gap-2 
          hover:bg-zinc-800 hover:border-zinc-600
          focus:outline-none focus:ring-1 focus:ring-zinc-500
          transition-all duration-200 ease-in-out text-left
          ${isOpen ? 'border-zinc-600 bg-zinc-800' : ''}
        `}
      >
        <span className="text-zinc-100 font-medium">{selectedOption?.label || 'Select...'}</span>
        <ChevronDown
          size={18}
          className={`text-zinc-400 transition-transform duration-300 ease-in-out ${
            isOpen ? 'rotate-180 text-zinc-200' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-2 py-1 bg-zinc-800/95 backdrop-blur-sm 
                      border border-zinc-700/80 rounded-lg shadow-lg max-w-none
                      transform origin-top transition-all duration-200 ease-out">
          {options.map((option) => (
            <button
              key={option.value}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={`
                w-full px-3 py-2 text-left
                transition-colors duration-150
                hover:bg-zinc-700/70
                focus:outline-none focus:bg-zinc-700/70
                ${option.value === value
                  ? 'text-zinc-100 bg-zinc-700/50 font-medium'
                  : 'text-zinc-300 hover:text-zinc-100'
                }
                first:rounded-t-md last:rounded-b-md
              `}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default Dropdown;
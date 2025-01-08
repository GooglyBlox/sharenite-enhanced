import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useInView } from 'react-intersection-observer';
import { Gamepad2, Edit2, X } from 'lucide-react';
import CoverCache from '@/utils/coverCache';

interface GameThumbnailProps {
  title: string;
  className?: string;
}

interface CoverModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  currentUrl: string | null;
  onSave: (url: string | null) => void;
}

const CoverModal = ({ isOpen, onClose, title, currentUrl, onSave }: CoverModalProps) => {
  const [url, setUrl] = useState(currentUrl || '');
  const [previewUrl, setPreviewUrl] = useState(currentUrl);
  const [isValidUrl, setIsValidUrl] = useState(false);

  useEffect(() => {
    setUrl(currentUrl || '');
    setPreviewUrl(currentUrl);
  }, [currentUrl]);

  useEffect(() => {
    if (!url) {
      setIsValidUrl(true);
      setPreviewUrl(null);
      return;
    }
    
    try {
      new URL(url);
      setIsValidUrl(true);
      setPreviewUrl(url);
    } catch {
      setIsValidUrl(false);
      setPreviewUrl(null);
    }
  }, [url]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-zinc-900 w-full max-w-sm rounded-lg shadow-xl m-4">
        <div className="p-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-zinc-100 truncate pr-4">{title}</h2>
            <button onClick={onClose} className="text-zinc-400 hover:text-zinc-100">
              <X size={20} />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">
                Cover URL
              </label>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full px-3 py-1.5 text-sm bg-zinc-800 border border-zinc-700 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-zinc-100"
                placeholder="https://example.com/cover.jpg"
              />
              {!isValidUrl && url && (
                <p className="text-red-400 text-sm mt-1">Please enter a valid URL</p>
              )}
            </div>

            <div className="w-32 h-48 mx-auto relative rounded overflow-hidden bg-zinc-800">
              {previewUrl ? (
                <Image
                  src={previewUrl}
                  alt="Cover preview"
                  fill
                  className="object-cover"
                  onError={() => {
                    setIsValidUrl(false);
                    setPreviewUrl(null);
                  }}
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center">
                  <Gamepad2 className="w-8 h-8 text-zinc-600 mb-1" />
                  <div className="text-xs text-zinc-500 font-medium">No Cover</div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => onSave(null)}
                className="px-3 py-1.5 text-sm bg-zinc-800 text-zinc-100 rounded hover:bg-zinc-700"
              >
                Remove
              </button>
              <button
                onClick={() => onSave(url || null)}
                disabled={!isValidUrl}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function GameThumbnail({ title, className }: GameThumbnailProps) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const fetchTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const retryCountRef = useRef<number>(0);

  const { ref, inView } = useInView({
    triggerOnce: true,
    threshold: 0,
    rootMargin: '100px 0px',
  });

  useEffect(() => {
    const cache = CoverCache.getInstance();
    const cachedUrl = cache.get(`thumb_${title}`);

    if (cachedUrl !== null) {
      setThumbnailUrl(cachedUrl);
      setIsLoading(false);
      return;
    }

    if (!inView) return;

    const fetchThumbnail = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/covers?name=${encodeURIComponent(title)}&type=cover`);
        
        if (!response.ok) {
          if (response.status === 429 && retryCountRef.current < 3) {
            retryCountRef.current += 1;
            fetchTimeoutRef.current = setTimeout(fetchThumbnail, 1000 * retryCountRef.current);
            return;
          }
          throw new Error('Failed to fetch');
        }
        
        const data = await response.json();
        if (!data.coverUrl) {
          throw new Error('No cover URL');
        }
        
        const url = data.coverUrl.replace('t_screenshot_big', 't_cover_big');
        cache.set(`thumb_${title}`, url);
        setThumbnailUrl(url);
        setIsError(false);
      } catch (error) {
        console.error(`Error fetching thumbnail for ${title}:`, error);
        cache.set(`thumb_${title}`, null);
        setIsError(true);
      } finally {
        setIsLoading(false);
      }
    };

    fetchThumbnail();

    return () => {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
    };
  }, [title, inView]);

  const handleSave = (newUrl: string | null) => {
    const cache = CoverCache.getInstance();
    cache.set(`thumb_${title}`, newUrl);
    setThumbnailUrl(newUrl);
    setIsModalOpen(false);
  };

  return (
    <>
      <div 
        ref={ref}
        className={`relative overflow-hidden rounded group cursor-pointer ${className}`}
        onClick={(e) => {
          e.stopPropagation();
          setIsModalOpen(true);
        }}
      >
        {isLoading ? (
          <div className="w-full h-full flex items-center justify-center bg-zinc-800 text-zinc-600">
            <div className="w-6 h-6 border-2 border-zinc-600 border-t-zinc-400 rounded-full animate-spin" />
          </div>
        ) : isError || !thumbnailUrl ? (
          <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-800/50 border border-zinc-700">
            <Gamepad2 className="w-8 h-8 text-zinc-600 mb-1" />
            <div className="text-xs text-zinc-500 font-medium">No Cover</div>
          </div>
        ) : (
          <Image
            src={thumbnailUrl}
            alt={`${title} thumbnail`}
            fill
            sizes="(max-width: 768px) 100px"
            className="object-cover"
            loading="lazy"
          />
        )}

        <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition-colors duration-200">
          <button
            className="transform scale-75 opacity-0 group-hover:opacity-100 group-hover:scale-100 transition-all duration-200"
            onClick={(e) => {
              e.stopPropagation();
              setIsModalOpen(true);
            }}
          >
            <div className="bg-white/10 backdrop-blur-sm rounded-full p-2">
              <Edit2 size={16} className="text-white" />
            </div>
          </button>
        </div>
      </div>

      <CoverModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={title}
        currentUrl={thumbnailUrl}
        onSave={handleSave}
      />
    </>
  );
}
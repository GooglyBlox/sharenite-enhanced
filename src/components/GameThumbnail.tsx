import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useInView } from 'react-intersection-observer';
import { Gamepad2 } from 'lucide-react';
import CoverCache from '@/utils/coverCache';

interface GameThumbnailProps {
  title: string;
  className?: string;
}

export default function GameThumbnail({ title, className }: GameThumbnailProps) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
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
        }
        
        const data = await response.json();
        const url = data.coverUrl?.replace('t_screenshot_big', 't_cover_big');
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

  return (
    <div 
      ref={ref}
      className={`relative overflow-hidden rounded ${className}`}
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
    </div>
  );
}
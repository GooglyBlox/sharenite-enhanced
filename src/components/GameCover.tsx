import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useInView } from 'react-intersection-observer';
import CoverCache from '@/utils/coverCache';

interface GameCoverProps {
  title: string;
  className?: string;
}

export default function GameCover({ title, className }: GameCoverProps) {
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
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
    const cachedUrl = cache.get(title);

    if (cachedUrl !== null) {
      setCoverUrl(cachedUrl);
      setIsLoading(false);
      return;
    }

    if (!inView) return;

    const fetchCover = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/covers?name=${encodeURIComponent(title)}`);
        
        if (!response.ok) {
          if (response.status === 429 && retryCountRef.current < 3) {
            retryCountRef.current += 1;
            fetchTimeoutRef.current = setTimeout(fetchCover, 1000 * retryCountRef.current);
            return;
          }
        }
        
        const data = await response.json();
        cache.set(title, data.coverUrl);
        setCoverUrl(data.coverUrl);
        setIsError(false);
      } catch (error) {
        console.error(`Error fetching cover for ${title}:`, error);
        cache.set(title, null);
        setIsError(true);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCover();

    return () => {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
    };
  }, [title, inView]);

  return (
    <div 
      ref={ref}
      className={`aspect-video relative overflow-hidden rounded ${className}`}
    >
      {isLoading ? (
        <div className="w-full h-full flex items-center justify-center bg-zinc-800 text-zinc-600">
          Loading...
        </div>
      ) : isError || !coverUrl ? (
        <div className="w-full h-full flex items-center justify-center bg-zinc-800 text-zinc-600">
          No Cover
        </div>
      ) : (
        <Image
          src={coverUrl}
          alt={`${title} cover`}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          className="object-cover"
          loading="lazy"
        />
      )}
    </div>
  );
}
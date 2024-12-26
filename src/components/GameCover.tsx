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
  const mountedRef = useRef(false);

  const { ref, inView } = useInView({
    triggerOnce: true,
    threshold: 0,
    rootMargin: '200px 0px',
  });

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let isCancelled = false;

    const loadCover = async () => {
      if (!inView || isCancelled) return;

      const cache = CoverCache.getInstance();
      const cachedUrl = cache.get(title);

      if (cachedUrl !== null) {
        if (!isCancelled) {
          setCoverUrl(cachedUrl);
          setIsLoading(false);
        }
        return;
      }

      try {
        setIsLoading(true);
        const response = await fetch(`/api/covers?name=${encodeURIComponent(title)}`);
        
        if (isCancelled) return;

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        if (isCancelled) return;

        cache.set(title, data.coverUrl);
        setCoverUrl(data.coverUrl);
        setIsError(false);
      } catch (error) {
        if (isCancelled) return;
        console.error(`Error loading cover for ${title}:`, error);
        setIsError(true);
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    loadCover();

    return () => {
      isCancelled = true;
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
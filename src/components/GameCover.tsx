import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useInView } from 'react-intersection-observer';
import { Edit2, X, Image as ImageIcon } from 'lucide-react';
import CoverCache from '@/utils/coverCache';

interface GameCoverProps {
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
  const [isValidUrl, setIsValidUrl] = useState(false);
  const [previewError, setPreviewError] = useState(false);

  useEffect(() => {
    setUrl(currentUrl || '');
    setPreviewError(false);
  }, [currentUrl]);

  useEffect(() => {
    if (!url) {
      setIsValidUrl(true);
      setPreviewError(false);
      return;
    }
    
    try {
      new URL(url);
      setIsValidUrl(true);
      setPreviewError(false);
    } catch {
      setIsValidUrl(false);
      setPreviewError(false);
    }
  }, [url]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-zinc-900 w-full max-w-lg rounded-lg shadow-xl m-4">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-zinc-100">{title}</h2>
            <button onClick={onClose} className="text-zinc-400 hover:text-zinc-100">
              <X size={24} />
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
                className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-zinc-100"
                placeholder="https://example.com/cover.jpg"
              />
              {!isValidUrl && url && (
                <p className="text-red-400 text-sm mt-1">Please enter a valid URL</p>
              )}
              {previewError && (
                <p className="text-red-400 text-sm mt-1">Unable to load image from URL</p>
              )}
            </div>

            <div className="aspect-video relative rounded overflow-hidden bg-zinc-800">
              {url && isValidUrl ? (
                <Image
                  src={url}
                  alt="Cover preview"
                  fill
                  className="object-cover"
                  onError={() => {
                    setPreviewError(true);
                    setIsValidUrl(false);
                  }}
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-zinc-600">
                  <ImageIcon size={32} className="mb-2" />
                  <span className="text-sm">No Cover Preview</span>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <button
                onClick={() => onSave(null)}
                className="px-4 py-2 bg-zinc-800 text-zinc-100 rounded hover:bg-zinc-700"
              >
                Remove Cover
              </button>
              <button
                onClick={() => onSave(url || null)}
                disabled={!isValidUrl || previewError}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function GameCover({ title, className }: GameCoverProps) {
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [key, setKey] = useState(0);
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

      if (cachedUrl !== null || cache.hasBeenFetched(title)) {
        if (!isCancelled) {
          setCoverUrl(cachedUrl);
          setIsError(false);
          setIsLoading(false);
          setKey(prev => prev + 1);
        }
        return;
      }

      try {
        setIsLoading(true);
        setIsError(false);
        const response = await fetch(`/api/covers?name=${encodeURIComponent(title)}`);
        
        if (isCancelled) return;

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        if (isCancelled) return;

        cache.set(title, data.coverUrl);
        cache.markAsFetched(title);
        setCoverUrl(data.coverUrl);
        setKey(prev => prev + 1);
        setIsError(false);
      } catch (error) {
        if (isCancelled) return;
        console.error(`Error loading cover for ${title}:`, error);
        setIsError(true);
        cache.markAsFetched(title);
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

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsModalOpen(true);
  };

  const handleSave = (newUrl: string | null) => {
    const cache = CoverCache.getInstance();
    cache.set(title, newUrl, true);
    setCoverUrl(newUrl);
    setKey(prev => prev + 1);
    setIsModalOpen(false);
  };

  const handleImageError = () => {
    setIsError(true);
    setCoverUrl(null);
    const cache = CoverCache.getInstance();
    cache.set(title, null, true);
  };

  return (
    <>
      <div 
        ref={ref}
        className={`aspect-video relative overflow-hidden rounded group ${className}`}
        onMouseEnter={() => setIsEditing(true)}
        onMouseLeave={() => setIsEditing(false)}
      >
        {isLoading ? (
          <div className="w-full h-full flex items-center justify-center bg-zinc-800">
            <div className="w-6 h-6 border-2 border-zinc-600 border-t-zinc-400 rounded-full animate-spin" />
          </div>
        ) : isError || !coverUrl ? (
          <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-800 text-zinc-600">
            <ImageIcon size={32} className="mb-2" />
            <span className="text-sm">No Cover</span>
          </div>
        ) : (
          <Image
            key={key}
            src={coverUrl}
            alt={`${title} cover`}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-cover"
            loading="lazy"
            onError={handleImageError}
          />
        )}

        {isEditing && (
          <button
            onClick={handleEditClick}
            className="absolute top-2 right-2 p-2 bg-black/50 backdrop-blur-sm rounded hover:bg-black/70 transition-colors"
          >
            <Edit2 size={16} className="text-white" />
          </button>
        )}
      </div>

      <CoverModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={title}
        currentUrl={coverUrl}
        onSave={handleSave}
      />
    </>
  );
}
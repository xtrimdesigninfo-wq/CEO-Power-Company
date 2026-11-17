import React, { useState } from 'react';
import { Zap, Sun } from 'lucide-react';

export function ProductImage({
  src,
  alt,
  className = '',
  priority = false,
}: {
  src?: string;
  alt: string;
  className?: string;
  priority?: boolean;
}) {
  const [hasError, setHasError] = useState(false);

  // Reliable Solar Equipment SVG placeholder
  if (!src || hasError) {
    return (
      <div className={`flex flex-col items-center justify-center bg-gradient-to-br from-slate-800 to-[#187004] text-white p-3 select-none ${className}`}>
        <Sun className="w-8 h-8 text-[#F5A623] mb-1 animate-pulse" />
        <span className="text-[10px] uppercase font-bold text-slate-300 tracking-wider text-center line-clamp-1">
          {alt || 'CEO POWER'}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      onError={() => setHasError(true)}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      fetchPriority={priority ? 'high' : 'auto'}
      className={className}
    />
  );
}

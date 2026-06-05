"use client";

import Image from "next/image";
import { useState, useEffect, useCallback } from "react";
import { X, ZoomIn } from "lucide-react";

interface ZoomableImageProps {
  src: string;
  alt: string;
  fill?: boolean;
  width?: number;
  height?: number;
  className?: string;
  quality?: number;
  sizes?: string;
  priority?: boolean;
}

export default function ZoomableImage({
  src,
  alt,
  fill,
  width,
  height,
  className,
  quality,
  sizes,
  priority,
}: ZoomableImageProps) {
  const [zoomed, setZoomed] = useState(false);

  const close = useCallback(() => setZoomed(false), []);

  useEffect(() => {
    if (!zoomed) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [zoomed, close]);

  return (
    <>
      {/* Wrapper button — absolute inset-0 for fill images, relative block for sized */}
      <button
        type="button"
        onClick={() => setZoomed(true)}
        aria-label={`Zoom in: ${alt}`}
        className={`group/zoom cursor-zoom-in ${fill ? "absolute inset-0" : "relative block"}`}
      >
        {fill ? (
          <Image
            src={src}
            alt={alt}
            fill
            className={className}
            quality={quality}
            sizes={sizes}
            priority={priority}
          />
        ) : (
          <Image
            src={src}
            alt={alt}
            width={width!}
            height={height!}
            className={className}
            quality={quality}
            sizes={sizes}
            priority={priority}
          />
        )}

        {/* Hover overlay */}
        <span
          className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover/zoom:bg-black/25"
          aria-hidden
        >
          <ZoomIn
            size={28}
            className="text-white drop-shadow-lg opacity-0 transition-opacity group-hover/zoom:opacity-100"
          />
        </span>
      </button>

      {/* Lightbox */}
      {zoomed && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/92 p-4 backdrop-blur-sm"
          onClick={close}
        >
          <button
            type="button"
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            onClick={close}
            aria-label="Close zoom"
          >
            <X size={22} />
          </button>

          <div
            className="relative max-h-[90vh] max-w-[92vw]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={alt}
              className="max-h-[90vh] max-w-[92vw] rounded-xl object-contain shadow-2xl"
            />
          </div>

          <p className="absolute bottom-4 left-1/2 -translate-x-1/2 select-none text-xs text-white/40">
            Press Esc or click outside to close
          </p>
        </div>
      )}
    </>
  );
}

"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { ChevronLeft, ChevronRight, Download, BookOpen, ZoomIn, ZoomOut } from "lucide-react";

interface PamphletViewerProps {
  src?: string;
}

export default function PamphletViewer({ src = "/pamphlet.pdf" }: PamphletViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pdf, setPdf] = useState<import("pdfjs-dist").PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.4);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);
  const renderTaskRef = useRef<import("pdfjs-dist").RenderTask | null>(null);

  // Load the PDF document once
  useEffect(() => {
    let cancelled = false;
    async function loadPdf() {
      try {
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        const doc = await pdfjsLib.getDocument({ url: src }).promise;
        if (!cancelled) {
          setPdf(doc);
          setTotalPages(doc.numPages);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to load PDF:", err);
          setError("Failed to load pamphlet. Please download it directly.");
          setLoading(false);
        }
      }
    }
    loadPdf();
    return () => { cancelled = true; };
  }, [src]);

  // Render the current page whenever pdf, page, or scale changes
  const renderPage = useCallback(async () => {
    if (!pdf || !canvasRef.current) return;
    // Cancel any in-flight render
    if (renderTaskRef.current) {
      renderTaskRef.current.cancel();
      renderTaskRef.current = null;
    }
    setRendering(true);
    try {
      const page = await pdf.getPage(currentPage);
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Use device pixel ratio for crisp rendering
      const dpr = window.devicePixelRatio || 1;
      canvas.width = viewport.width * dpr;
      canvas.height = viewport.height * dpr;
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      ctx.scale(dpr, dpr);

      const task = page.render({ canvasContext: ctx, viewport, canvas: canvasRef.current! });
      renderTaskRef.current = task;
      await task.promise;
      renderTaskRef.current = null;
    } catch (err: unknown) {
      // Ignore cancelled renders
      if (err instanceof Error && err.name !== "RenderingCancelledException") {
        console.error("Render error:", err);
      }
    } finally {
      setRendering(false);
    }
  }, [pdf, currentPage, scale]);

  useEffect(() => {
    renderPage();
  }, [renderPage]);

  // Auto-fit scale based on container width
  useEffect(() => {
    function handleResize() {
      const container = document.getElementById("pamphlet-container");
      if (!container) return;
      const w = container.clientWidth - 32; // 16px padding on each side
      // PDF pages are typically ~612 pt wide; scale to fill container
      const newScale = Math.min(Math.max(w / 612, 0.6), 2.5);
      setScale(newScale);
    }
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const goToPrev = () => setCurrentPage((p) => Math.max(1, p - 1));
  const goToNext = () => setCurrentPage((p) => Math.min(totalPages, p + 1));

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") goToPrev();
    if (e.key === "ArrowRight" || e.key === "ArrowDown") goToNext();
  }, [currentPage, totalPages]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div id="pamphlet-container" className="w-full">
      {/* Header row */}
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <BookOpen className="h-5 w-5 text-tgex-magenta" aria-hidden />
          <span className="font-bungee text-sm uppercase tracking-[0.2em] text-tgex-light/70">
            {loading ? "Loading…" : totalPages > 0 ? `Page ${currentPage} of ${totalPages}` : ""}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Zoom controls */}
          <button
            onClick={() => setScale((s) => Math.max(0.5, +(s - 0.2).toFixed(1)))}
            disabled={loading || scale <= 0.5}
            aria-label="Zoom out"
            className="rounded-lg border border-white/10 bg-tgex-navy/60 p-1.5 text-tgex-light/60 transition-colors hover:border-tgex-magenta/50 hover:text-tgex-magenta disabled:opacity-30"
          >
            <ZoomOut size={14} />
          </button>
          <span className="min-w-[3ch] text-center font-bungee text-xs text-tgex-light/40">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={() => setScale((s) => Math.min(3, +(s + 0.2).toFixed(1)))}
            disabled={loading || scale >= 3}
            aria-label="Zoom in"
            className="rounded-lg border border-white/10 bg-tgex-navy/60 p-1.5 text-tgex-light/60 transition-colors hover:border-tgex-magenta/50 hover:text-tgex-magenta disabled:opacity-30"
          >
            <ZoomIn size={14} />
          </button>
          {/* Download */}
          <a
            href="/tgex/pamphlet.pdf"
            download
            className="ml-2 inline-flex items-center gap-1.5 rounded-lg border border-tgex-magenta/40 bg-tgex-magenta/10 px-3 py-1.5 font-bungee text-xs uppercase tracking-wider text-tgex-magenta transition-all hover:bg-tgex-magenta/25 hover:shadow-[0_0_16px_rgba(255,29,111,0.4)]"
          >
            <Download size={12} />
            Download
          </a>
        </div>
      </div>

      {/* Canvas area */}
      <div className="relative flex min-h-[400px] items-center justify-center overflow-auto rounded-xl border border-white/10 bg-tgex-dark/80 shadow-[inset_0_0_60px_rgba(10,3,20,0.8)]">
        {loading && (
          <div className="flex flex-col items-center gap-3 p-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-tgex-magenta border-t-transparent" />
            <p className="font-bungee text-xs uppercase tracking-widest text-tgex-light/40">Loading pamphlet…</p>
          </div>
        )}
        {error && !loading && (
          <div className="flex flex-col items-center gap-4 p-12 text-center">
            <BookOpen className="h-10 w-10 text-tgex-light/20" />
            <p className="text-sm text-tgex-light/60">{error}</p>
            <a
              href="/tgex/pamphlet.pdf"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-tgex-magenta/50 bg-tgex-magenta/15 px-4 py-2 font-bungee text-sm uppercase text-tgex-magenta hover:bg-tgex-magenta/30"
            >
              <Download size={14} /> Open PDF
            </a>
          </div>
        )}
        {!loading && !error && (
          <div className="relative p-4">
            {rendering && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-tgex-dark/50">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-tgex-magenta border-t-transparent" />
              </div>
            )}
            <canvas
              ref={canvasRef}
              className="rounded-lg shadow-[0_8px_48px_rgba(255,29,111,0.15),0_0_0_1px_rgba(255,255,255,0.05)]"
              style={{ display: "block", maxWidth: "100%" }}
            />
          </div>
        )}
      </div>

      {/* Navigation footer */}
      {!loading && !error && totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-4">
          <button
            onClick={goToPrev}
            disabled={currentPage <= 1}
            aria-label="Previous page"
            className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-tgex-magenta/50 bg-tgex-dark/60 text-tgex-magenta transition-all hover:scale-110 hover:bg-tgex-magenta/20 hover:shadow-[0_0_20px_rgba(255,29,111,0.5)] disabled:cursor-not-allowed disabled:border-white/10 disabled:text-white/20 disabled:shadow-none"
          >
            <ChevronLeft size={18} />
          </button>

          {/* Page dots / numbers */}
          <div className="flex items-center gap-1.5">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                aria-label={`Go to page ${page}`}
                aria-current={page === currentPage ? "true" : undefined}
                className={`rounded-full transition-all ${
                  page === currentPage
                    ? "h-2.5 w-6 bg-tgex-magenta shadow-[0_0_10px_rgba(255,29,111,0.7)]"
                    : "h-2 w-2 bg-white/20 hover:bg-white/50"
                }`}
              />
            ))}
          </div>

          <button
            onClick={goToNext}
            disabled={currentPage >= totalPages}
            aria-label="Next page"
            className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-tgex-magenta/50 bg-tgex-dark/60 text-tgex-magenta transition-all hover:scale-110 hover:bg-tgex-magenta/20 hover:shadow-[0_0_20px_rgba(255,29,111,0.5)] disabled:cursor-not-allowed disabled:border-white/10 disabled:text-white/20 disabled:shadow-none"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}

      {/* Keyboard hint */}
      {!loading && !error && totalPages > 1 && (
        <p className="mt-3 text-center font-lexend text-xs text-tgex-light/25">
          Use ← → arrow keys to navigate pages
        </p>
      )}
    </div>
  );
}

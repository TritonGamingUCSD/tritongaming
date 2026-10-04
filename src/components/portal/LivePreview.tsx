'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Monitor, Smartphone, Maximize2, Minimize2 } from 'lucide-react';
import styles from './LivePreview.module.css';

// A live view of the real public page beside an editor: the editor's unsaved values are saved as the person's private draft
// (kept in step as they type) and the page, rendered inside /preview, redraws with them. Nothing is public until they save.
export default function LivePreview({ draftKey, value, path, label }: { draftKey: string; value: unknown; path: string; label: string }) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [device, setDevice] = useState<'desktop' | 'phone'>('desktop');
  const [full, setFull] = useState(false);
  const [box, setBox] = useState({ w: 600, h: 400 });
  // The frame only loads once the first draft is saved (before that the page has nothing to show and would be a 404).
  const [ready, setReady] = useState(false);

  // Keep the draft in step: send the latest value shortly after typing pauses, one request at a time (only the newest goes next).
  const json = JSON.stringify(value);
  const latest = useRef(json);
  latest.current = json;
  const sent = useRef<string | null>(null);
  const busy = useRef(false);
  const push = useRef<() => void>(() => {});
  push.current = async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      while (sent.current !== latest.current) {
        const body = latest.current;
        const res = await fetch('/api/admin/content/draft', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: `{"drafts":{${JSON.stringify(draftKey)}:${body}}}` });
        if (!res.ok) break;
        sent.current = body;
        setReady(true);
        frameRef.current?.contentWindow?.postMessage({ type: 'tg-preview-refresh' }, window.location.origin);
      }
    } catch { /* the preview just stays as it was */ }
    busy.current = false;
  };
  useEffect(() => {
    const t = setTimeout(() => push.current(), 150);
    return () => clearTimeout(t);
  }, [json]);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, [full]);
  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFull(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [full]);

  const frameW = device === 'desktop' ? 1920 : 390;
  const frameH = device === 'desktop' ? 1080 : 844;
  // Fit the 1920x1080 page (or the phone) to the panel; the phone is kept to the desktop preview's height.
  const areaH = 1080 * Math.min(1, box.w / 1920);
  const scale = full ? Math.min(box.w / frameW, box.h / frameH) : device === 'phone' ? Math.min(1, areaH / frameH, box.w / frameW) : Math.min(1, box.w / frameW);

  // Full screen is drawn on the page body, not inside the editor: a sticky or positioned ancestor (the event form's Save bar, for one) would otherwise
  // keep painting above it.
  const pane = (
    <aside className={`${styles.pane} ${full ? styles.full : ''}`} aria-label="Live preview">
      <div className={styles.bar}>
        <span className={styles.title}>Live preview <em>{label}</em></span>
        <div className={styles.tools}>
          <button type="button" className={`${styles.tool} ${device === 'desktop' ? styles.toolOn : ''}`} onClick={() => setDevice('desktop')} aria-label="Desktop width" title="Desktop"><Monitor size={14} /></button>
          <button type="button" className={`${styles.tool} ${device === 'phone' ? styles.toolOn : ''}`} onClick={() => setDevice('phone')} aria-label="Phone width" title="Phone"><Smartphone size={14} /></button>
          <button type="button" className={styles.tool} onClick={() => setFull((f) => !f)} aria-label={full ? 'Exit full screen' : 'Full screen'} title={full ? 'Exit full screen (Esc)' : 'Full screen'}>{full ? <Minimize2 size={14} /> : <Maximize2 size={14} />}</button>
        </div>
      </div>
      <div ref={boxRef} className={`${styles.box} ${device === 'phone' && !full ? styles.boxPhone : ''}`} style={full ? undefined : { height: device === 'phone' ? areaH : frameH * scale }}>
        <div className={styles.scaler} style={{ width: frameW * scale, height: frameH * scale }}>
          {ready && <iframe ref={frameRef} title="Live preview of the public page" src={path} className={styles.frame} style={{ width: frameW, height: frameH, transform: `scale(${scale})` }} />}
        </div>
      </div>
      <p className={styles.note}>Shows your unsaved changes on the real page. Nothing is public until you save.</p>
    </aside>
  );
  return full ? createPortal(pane, document.body) : pane;
}

'use client';

import { useEffect, useRef, useState } from 'react';
import type { Map as LeafletMap, Marker } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Search, X } from 'lucide-react';
import styles from './VenuePinMap.module.css';

export type Pin = { lat: number; lng: number };
const UCSD: Pin = { lat: 32.8801, lng: -117.234 };

// Click the map to drop a pin (drag it to adjust), or search for a place first. For venues that have no street address: the pin is the
// approximate location. Leaflet and its map pictures load only when this editor is on screen.
export default function VenuePinMap({ value, onChange }: { value: Pin | null; onChange: (p: Pin | null) => void }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const marker = useRef<Marker | null>(null);
  const leaflet = useRef<typeof import('leaflet') | null>(null);
  const changeRef = useRef(onChange);
  changeRef.current = onChange;
  const [query, setQuery] = useState('');
  const [msg, setMsg] = useState('');

  // build the map once
  useEffect(() => {
    let dead = false;
    let ro: ResizeObserver | undefined;
    (async () => {
      const L = (await import('leaflet')).default;
      if (dead || !el.current || map.current) return;
      leaflet.current = L;
      const m = L.map(el.current, { scrollWheelZoom: false }).setView(value ?? UCSD, value ? 17 : 15);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap contributors' }).addTo(m);
      m.on('click', (e) => changeRef.current({ lat: round(e.latlng.lat), lng: round(e.latlng.lng) }));
      map.current = m;
      sync(L);
      // The editor keeps hidden tabs mounted; a map built while hidden has no size, so it re-measures whenever it becomes visible or resizes.
      ro = new ResizeObserver(() => m.invalidateSize());
      ro.observe(el.current);
    })();
    return () => { dead = true; ro?.disconnect(); map.current?.remove(); map.current = null; marker.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function sync(L = leaflet.current) {
    const m = map.current;
    if (!m || !L) return;
    if (!value) { marker.current?.remove(); marker.current = null; return; }
    if (!marker.current) {
      const icon = L.divIcon({ className: '', html: `<span class="${styles.pin}"></span>`, iconSize: [28, 36], iconAnchor: [14, 34] });
      marker.current = L.marker(value, { icon, draggable: true }).addTo(m);
      marker.current.on('dragend', () => { const p = marker.current!.getLatLng(); changeRef.current({ lat: round(p.lat), lng: round(p.lng) }); });
    } else marker.current.setLatLng(value);
  }
  useEffect(() => { sync(); }, [value?.lat, value?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  async function search() {
    const q = query.trim();
    if (!q) return;
    setMsg('Searching…');
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`);
      const j = (await r.json()) as { lat: string; lon: string }[];
      if (!j[0]) { setMsg('Nothing found. Try a nearby landmark, or click the map.'); return; }
      const p = { lat: round(parseFloat(j[0].lat)), lng: round(parseFloat(j[0].lon)) };
      map.current?.setView(p, 17);
      onChange(p);
      setMsg('');
    } catch { setMsg('Search is unavailable right now. Click the map instead.'); }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.searchRow}>
        <input className={styles.input} value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); search(); } }} placeholder="Search a place or landmark" aria-label="Search the map" />
        <button type="button" className={styles.btn} onClick={search}><Search size={14} aria-hidden="true" /> Find</button>
        {value && <button type="button" className={styles.btn} onClick={() => onChange(null)}><X size={14} aria-hidden="true" /> Remove pin</button>}
      </div>
      <div ref={el} className={styles.map} />
      <span className={styles.hint}>{msg || (value ? 'Drag the pin to adjust it, or click elsewhere to move it.' : 'Click the map to drop a pin. It only needs to be close.')}</span>
    </div>
  );
}

const round = (n: number) => Math.round(n * 1e5) / 1e5;

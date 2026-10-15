'use client';

import { useMemo, useState } from 'react';
import { FileDown, Plus, X } from 'lucide-react';
import Button from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { createClient } from '@/lib/supabase/client';
import type { ReportMetric } from '@/types/database';
import type { ReportChoices, ReportData } from './reportTypes';
import { ReportCtx } from './ReportContext';
import styles from './summary.module.css';

// Pictures for the PDF: the PDF maker cannot read WebP, so each one is redrawn as a PNG or JPEG first (and shrunk, so the file stays small). A picture that will not load is left out.
function loadAs(url: string, kind: 'png' | 'jpeg', maxEdge: number): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const k = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k));
      const ctx = c.getContext('2d');
      if (!ctx) return resolve(null);
      if (kind === 'jpeg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); }
      ctx.drawImage(img, 0, 0, c.width, c.height);
      try { resolve(c.toDataURL(kind === 'png' ? 'image/png' : 'image/jpeg', 0.85)); } catch { resolve(null); }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

// The report sits on a white sheet whatever the portal theme is. Above it (never in the PDF) are the choices for this copy: who it is prepared for and the social media numbers typed in by hand.
// Attendees' written comments are never part of the report. Save as PDF draws the document itself, so the file has no web address, page title or date from the browser.
export default function ReportShell({ children, back, internal, report }: { children: React.ReactNode; back: React.ReactNode; internal?: React.ReactNode; report: ReportData }) {
  const [sponsorIdx, setSponsorIdx] = useState(-1);
  const [social, setSocial] = useState<ReportMetric[]>(report.social);
  const [savedSocial, setSavedSocial] = useState<ReportMetric[]>(report.social);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const sponsor = sponsorIdx >= 0 ? report.sponsors[sponsorIdx] ?? null : null;
  const ctx = useMemo(() => ({ preparedFor: sponsor, social, sponsors: report.sponsors }), [sponsor, social, report.sponsors]);
  const dirty = JSON.stringify(social) !== JSON.stringify(savedSocial);

  async function saveSocial() {
    setSaving(true); setError('');
    const clean = social.map((m) => ({ label: m.label.trim().slice(0, 60), value: m.value.trim().slice(0, 30) })).filter((m) => m.label && m.value);
    const { error: err } = await createClient().from('events').update({ report_social: clean }).eq('id', report.eventId);
    setSaving(false);
    if (err) { setError('Couldn’t save those numbers.'); return; }
    setSocial(clean); setSavedSocial(clean);
  }

  async function download() {
    setBusy(true); setError('');
    try {
      const [{ pdf }, { default: ReportPdf }] = await Promise.all([import('@react-pdf/renderer'), import('./ReportPdf')]);
      const logos: Record<string, string | null> = {};
      await Promise.all(report.sponsors.map(async (sp) => { logos[sp.name] = sp.logo_url ? await loadAs(sp.logo_url, 'png', 360) : null; }));
      const photos = (await Promise.all(report.photos.slice(0, 6).map(async (p) => ({ src: await loadAs(p.url, 'jpeg', 1100), caption: p.caption, credit: p.credit }))))
        .filter((p): p is { src: string; caption: string; credit: string } => !!p.src);
      const poster = report.poster ? await loadAs(report.poster, 'jpeg', 700) : null;
      const stickers = (await Promise.all(report.stickers.map((u) => loadAs(u, 'png', 260)))).filter((x): x is string => !!x);
      const choices: ReportChoices = {
        preparedFor: sponsor ? { name: sponsor.name, logo: logos[sponsor.name] ?? null } : null,
        social: social.filter((m) => m.label.trim() && m.value.trim()), thanks: (sponsor ? [sponsor] : report.sponsors).map((sp) => ({ name: sp.name, logo: logos[sp.name] ?? null })), photos, poster, stickers,
      };
      const blob = await pdf(<ReportPdf r={report} c={choices} origin={window.location.origin} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${report.title.replace(/[\\/:*?"<>|]+/g, ' ').trim()} - Event Impact Report.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch {
      setError('Couldn’t make the PDF. Try again in a moment.');
    } finally { setBusy(false); }
  }

  return (
    <div className={styles.page}>
      <div className={styles.controls} data-print-hide>
        {back}
        <div className={styles.controlSet}>
          <Button onClick={() => void download()} loading={busy}><FileDown size={15} strokeWidth={1.75} aria-hidden="true" /> Save as PDF</Button>
        </div>
      </div>
      <p className={styles.controlsNote} data-print-hide>This page shows every figure. Save as PDF downloads the report to send: a one-page summary, plus a second page with photos and the sponsor thank-you when there are any. The team-only numbers at the bottom are not part of it.</p>
      {error && <p className={styles.controlsNote} role="alert" data-print-hide>{error}</p>}

      {(report.sponsors.length > 0 || report.canEditSocial || social.length > 0) && (
        <section className={styles.reportEditor} data-print-hide aria-label="Report details">
          <h2>Details for this copy</h2>
          {report.sponsors.length > 0 && (
            <div className={styles.editorRow}>
              <label htmlFor="prepared-for">Prepared for</label>
              <select id="prepared-for" value={sponsorIdx} onChange={(e) => setSponsorIdx(Number(e.target.value))}>
                <option value={-1}>No one in particular</option>
                {report.sponsors.map((sp, i) => <option key={sp.name + i} value={i}>{sp.name}</option>)}
              </select>
              <span className={styles.controlsNote}>From this event’s sponsor list. The thank-you at the end names only them; with no one chosen, every sponsor is thanked.</span>
            </div>
          )}
          {(report.canEditSocial || social.length > 0) && (
            <div className={styles.editorRow} style={{ alignItems: 'stretch', flexDirection: 'column' }}>
              <span>Social media reach <span className={styles.controlsNote}>— numbers from your own accounts, such as “Instagram impressions: 12,400”. Saved with the event.</span></span>
              {social.map((m, i) => (
                <div key={i} className={styles.metricRow}>
                  <Input value={m.label} placeholder="What it counts, e.g. Instagram impressions" maxLength={60} aria-label="What the number counts" disabled={!report.canEditSocial} onChange={(e) => setSocial((p) => p.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)))} />
                  <Input value={m.value} placeholder="12,400" maxLength={30} aria-label="The number" disabled={!report.canEditSocial} onChange={(e) => setSocial((p) => p.map((x, k) => (k === i ? { ...x, value: e.target.value } : x)))} />
                  {report.canEditSocial && <button type="button" className={styles.iconRemove} aria-label="Remove this number" onClick={() => setSocial((p) => p.filter((_, k) => k !== i))}><X size={14} aria-hidden="true" /></button>}
                </div>
              ))}
              {report.canEditSocial && (
                <div className={styles.editorRow}>
                  {social.length < 6 && <Button size="sm" variant="secondary" onClick={() => setSocial((p) => [...p, { label: '', value: '' }])}><Plus size={14} aria-hidden="true" /> Add a number</Button>}
                  {dirty && <Button size="sm" onClick={() => void saveSocial()} loading={saving}>Save numbers</Button>}
                </div>
              )}
            </div>
          )}
        </section>
      )}

      <ReportCtx.Provider value={ctx}>
        <div className={styles.sheet}>{children}</div>
      </ReportCtx.Provider>
      {internal}
    </div>
  );
}

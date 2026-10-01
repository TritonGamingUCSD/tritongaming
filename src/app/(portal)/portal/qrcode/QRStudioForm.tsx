'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, Upload, X } from 'lucide-react';
import type { QRCodeOptions, QRDotsType, QRCornersSquareType, QRCornersDotType } from '@/lib/qrCodeStyling';
import { QR_PRESETS, matchingPreset } from '@/lib/qrPresets';
import type { QRDivisionLogo } from './QRStudioClient';
import styles from './qrstudio.module.css';

const dotStyles: QRDotsType[] = ['rounded', 'dots', 'square', 'extra-rounded', 'classy', 'classy-rounded'];
const cornerSquareStyles: QRCornersSquareType[] = ['extra-rounded', 'square', 'dot'];
const cornerDotStyles: QRCornersDotType[] = ['dot', 'square'];

// The icons worth one tap; the full list and custom upload live under "Center icon".
const QUICK_ICONS: { value: QRCodeOptions['icon']; label: string }[] = [
  { value: 'tg-color', label: 'TG logo' }, { value: 'none', label: 'None' }, { value: 'link', label: 'Link' },
  { value: 'website', label: 'Website' }, { value: 'email', label: 'Email' }, { value: 'phone', label: 'Phone' },
  { value: 'wifi', label: 'Wi-Fi' }, { value: 'location', label: 'Place' },
];

function updateCustomIcon(file: File | undefined, options: QRCodeOptions, setOptions: (o: QRCodeOptions) => void) {
  if (!file) {
    setOptions({ ...options, customIcon: null, icon: options.icon === 'custom' ? 'none' : options.icon });
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    setOptions({ ...options, customIcon: typeof reader.result === 'string' ? reader.result : null, icon: 'custom' });
  };
  reader.readAsDataURL(file);
}

// Little dot-grid thumbnail drawn from a preset's own colors/shapes.
function PresetThumb({ style }: { style: (typeof QR_PRESETS)[number]['style'] }) {
  const cells = [1, 1, 0, 1, 0, 1, 0, 1, 1];
  const radius = style.dotsType === 'square' || style.dotsType === 'classy' ? '1px' : '50%';
  return (
    <span className={styles.thumb} style={{ background: style.bgColor }} aria-hidden="true">
      {cells.map((on, i) => (
        <span
          key={i}
          style={{
            borderRadius: radius,
            background: on
              ? (i === 0 || i === 2 ? style.cornersSquareColor : i === 6 ? style.cornersDotColor : style.dotsGradientEnabled ? `linear-gradient(135deg, ${style.dotsGradientStartColor}, ${style.dotsGradientEndColor})` : style.dotsColor)
              : 'transparent',
          }}
        />
      ))}
    </span>
  );
}

const SWATCHES = ['#0b1020', '#002951', '#1e3a8a', '#0ea5e9', '#22d3ee', '#10b981', '#a3e635', '#facc15', '#f59e0b', '#ef4444', '#ec4899', '#a855f7', '#ffffff'];

// A color control in the site's style: a row of swatches, a "custom" wheel for anything else, and an
// editable hex code. Replaces the browser's bare color boxes.
function ColorField({ label, value, onChange, disabled }: { label: string; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = (v: string) => { setDraft(v); if (/^#[0-9a-f]{6}$/i.test(v)) onChange(v.toLowerCase()); };
  const isCustom = !SWATCHES.includes(value.toLowerCase());
  return (
    <div className={`${styles.colorField} ${disabled ? styles.colorDisabled : ''}`}>
      <span className={styles.label}>{label}</span>
      <div className={styles.swatches} role="radiogroup" aria-label={label}>
        {SWATCHES.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={value.toLowerCase() === c}
            aria-label={c}
            disabled={disabled}
            className={`${styles.swatch} ${value.toLowerCase() === c ? styles.swatchActive : ''}`}
            style={{ background: c }}
            onClick={() => onChange(c)}
          />
        ))}
        <label className={`${styles.swatch} ${styles.swatchCustom} ${isCustom ? styles.swatchActive : ''}`} title="Pick any color">
          <input type="color" value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} aria-label={`${label} — custom`} />
        </label>
      </div>
      <div className={styles.hexRow}>
        <span className={styles.hexDot} style={{ background: value }} aria-hidden="true" />
        <input className={styles.hexInput} value={draft} onChange={(e) => commit(e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}`)} maxLength={7} spellCheck={false} disabled={disabled} aria-label={`${label} hex code`} />
      </div>
    </div>
  );
}

// Drop zone for a custom center icon: drag an image in or click to browse; once one is set it shows
// a preview with Replace / Remove.
function IconDropzone({ options, setOptions }: { options: QRCodeOptions; setOptions: (o: QRCodeOptions) => void }) {
  const [over, setOver] = useState(false);
  const [error, setError] = useState('');
  const has = options.icon === 'custom' && !!options.customIcon;

  function take(file: File | undefined) {
    setError('');
    if (!file) return;
    if (!/^image\/(png|jpeg|svg\+xml|webp)$/.test(file.type)) { setError('Use a PNG, JPG, SVG or WebP image.'); return; }
    if (file.size > 2 * 1024 * 1024) { setError('Keep it under 2 MB.'); return; }
    updateCustomIcon(file, options, setOptions);
  }

  return (
    <div className={styles.dropWrap}>
      <label
        className={`${styles.dropzone} ${over ? styles.dropzoneOver : ''} ${has ? styles.dropzoneHas : ''}`}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); take(e.dataTransfer.files?.[0]); }}
      >
        <input className={styles.srOnly} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" onChange={(e) => { take(e.target.files?.[0]); e.target.value = ''; }} />
        {has ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={options.customIcon!} alt="Your icon" className={styles.dropPreview} />
            <span className={styles.dropText}>
              <span className={styles.dropTitle}>Your icon is in the center</span>
              <span className={styles.dropSub}>Click or drop to replace it</span>
            </span>
          </>
        ) : (
          <>
            <span className={styles.dropIcon} aria-hidden="true"><Upload size={22} strokeWidth={1.75} /></span>
            <span className={styles.dropText}>
              <span className={styles.dropTitle}>Drop an image here</span>
              <span className={styles.dropSub}>or click to browse · PNG, JPG, SVG, WebP · up to 2 MB</span>
            </span>
          </>
        )}
      </label>
      {has && (
        <button type="button" className={styles.dropRemove} onClick={() => updateCustomIcon(undefined, options, setOptions)}>
          <X size={13} aria-hidden="true" /> Remove
        </button>
      )}
      {error && <span className={styles.dropError}>{error}</span>}
    </div>
  );
}

function Fold({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`${styles.fold} ${open ? styles.foldOpen : ''}`}>
      <button type="button" className={styles.foldHead} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className={styles.foldTitle}>{title}</span>
        {hint && <span className={styles.foldHint}>{hint}</span>}
        <ChevronDown size={16} className={styles.foldChevron} aria-hidden="true" />
      </button>
      {open && <div className={styles.foldBody}>{children}</div>}
    </div>
  );
}

export default function QRStudioForm({ options, setOptions, divisions = [] }: { options: QRCodeOptions; setOptions: (o: QRCodeOptions) => void; divisions?: QRDivisionLogo[] }) {
  const [loadingDivision, setLoadingDivision] = useState<string | null>(null);
  const [divisionError, setDivisionError] = useState('');
  const [chosenDivision, setChosenDivision] = useState<string | null>(null);

  // Pull a division's logo in as the center icon. Fetched and inlined so the downloaded image
  // isn't blocked by cross-origin rules.
  async function useDivisionLogo(d: QRDivisionLogo, extra: Partial<QRCodeOptions> = {}) {
    setDivisionError('');
    setLoadingDivision(d.id);
    try {
      const res = await fetch(d.logo);
      if (!res.ok) throw new Error('bad response');
      const blob = await res.blob();
      const dataUrl: string = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = reject;
        r.readAsDataURL(blob);
      });
      setChosenDivision(d.id);
      setOptions({ ...options, ...extra, customIcon: dataUrl, icon: 'custom' });
    } catch {
      setOptions({ ...options, ...extra });
      setDivisionError(`Couldn't load ${d.name}'s logo. Try again, or upload it under “Your own icon”.`);
    } finally {
      setLoadingDivision(null);
    }
  }

  const activePreset = matchingPreset(options);

  // A division look also brings that division's logo along as the center icon.
  function pickPreset(p: (typeof QR_PRESETS)[number]) {
    const d = p.division ? divisions.find((x) => x.name.toLowerCase().includes(p.division!)) : undefined;
    if (d) useDivisionLogo(d, { ...p.style });
    else set({ ...p.style });
  }
  const set = (patch: Partial<QRCodeOptions>) => setOptions({ ...options, ...patch });

  return (
    <div className={styles.formPanel}>
      <div className={styles.formHeader}>
        <p className={styles.eyebrow}>QR Studio</p>
        <h1 className={styles.formTitle}>Make a QR code</h1>
        <p className={styles.formSub}>Paste a link, pick a look, download. Everything else is optional.</p>
      </div>

      <label className={styles.field}>
        <span className={styles.label}>1 · Where should it go?</span>
        <input className={styles.input} value={options.data} onChange={(e) => set({ data: e.target.value })} placeholder="https://www.example.com" inputMode="url" />
      </label>

      <div className={styles.field}>
        <span className={styles.label}>2 · Pick a style</span>
        <div className={styles.presetGrid} role="radiogroup" aria-label="QR style">
          {QR_PRESETS.filter((p) => !p.division).map((p) => (            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={activePreset === p.id}
              className={`${styles.preset} ${activePreset === p.id ? styles.presetActive : ''}`}
              onClick={() => pickPreset(p)}
            >
              <PresetThumb style={p.style} />
              <span className={styles.presetName}>{p.name}</span>
              {p.dark && <span className={styles.darkTag}>dark</span>}
            </button>
          ))}
        </div>
        <span className={styles.groupLabel}>From our divisions&apos; logos</span>
        <div className={styles.presetGrid} role="radiogroup" aria-label="Division QR styles">
          {QR_PRESETS.filter((p) => p.division).map((p) => (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={activePreset === p.id}
              className={`${styles.preset} ${activePreset === p.id ? styles.presetActive : ''}`}
              onClick={() => pickPreset(p)}
            >
              <PresetThumb style={p.style} />
              <span className={styles.presetName}>{p.name}</span>
              {p.dark && <span className={styles.darkTag}>dark</span>}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.field}>
        <span className={styles.label}>3 · Center icon</span>
        <div className={styles.iconRow} role="radiogroup" aria-label="Center icon">
          {QUICK_ICONS.map((i) => (
            <button
              key={i.value}
              type="button"
              role="radio"
              aria-checked={options.icon === i.value}
              className={`${styles.iconChip} ${options.icon === i.value ? styles.iconChipActive : ''}`}
              onClick={() => { setChosenDivision(null); set({ icon: i.value }); }}
            >
              {i.label}
            </button>
          ))}
        </div>
      </div>

      {divisions.length > 0 && (
        <div className={styles.field}>
          <span className={styles.label}>Or use a division logo</span>
          <div className={styles.divRow} role="radiogroup" aria-label="Division logo">
            {divisions.map((d) => {
              const active = options.icon === 'custom' && chosenDivision === d.id;
              return (
                <button key={d.id} type="button" role="radio" aria-checked={active} disabled={loadingDivision !== null}
                  className={`${styles.divChip} ${active ? styles.divChipActive : ''}`} onClick={() => useDivisionLogo(d)}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={d.logo} alt="" className={styles.divLogo} />
                  <span>{loadingDivision === d.id ? 'Loading…' : d.name}</span>
                </button>
              );
            })}
          </div>
          {divisionError && <span className={styles.dropError}>{divisionError}</span>}
        </div>
      )}

      <div className={styles.folds}>
        <Fold title="Colors" hint="Background, modules, corners">
          <ColorField label="Background" value={options.bgColor} onChange={(v) => set({ bgColor: v })} disabled={options.transparentBg} />
          <span className={styles.checkboxRow}>
            <input id="qr-transparent" type="checkbox" checked={options.transparentBg} onChange={(e) => set({ transparentBg: e.target.checked })} />
            <label htmlFor="qr-transparent">Transparent background</label>
          </span>
          <ColorField label="Modules" value={options.dotsColor} onChange={(v) => set({ dotsColor: v })} />
          <span className={styles.checkboxRow}>
            <input id="qr-grad" type="checkbox" checked={options.dotsGradientEnabled} onChange={(e) => set({ dotsGradientEnabled: e.target.checked })} />
            <label htmlFor="qr-grad">Gradient on the modules</label>
          </span>
          {options.dotsGradientEnabled && (
            <>
              <ColorField label="Gradient start" value={options.dotsGradientStartColor} onChange={(v) => set({ dotsGradientStartColor: v })} />
              <ColorField label="Gradient end" value={options.dotsGradientEndColor} onChange={(v) => set({ dotsGradientEndColor: v })} />
            </>
          )}
          <ColorField label="Corner frame" value={options.cornersSquareColor} onChange={(v) => set({ cornersSquareColor: v })} />
          <ColorField label="Corner dot" value={options.cornersDotColor} onChange={(v) => set({ cornersDotColor: v })} />
          <div className={styles.tipBox}>Keep strong contrast between the background and the modules so it scans reliably.</div>
        </Fold>

        <Fold title="Shapes" hint="Modules and corners">
          <div className={styles.fieldRow}>
            <label className={styles.field}><span className={styles.label}>Module shape</span>
              <select className={styles.input} value={options.dotsType} onChange={(e) => set({ dotsType: e.target.value as QRDotsType })}>
                {dotStyles.map((s) => <option key={s} value={s}>{s}</option>)}
              </select></label>
            <label className={styles.field}><span className={styles.label}>Corner frame</span>
              <select className={styles.input} value={options.cornersSquareType} onChange={(e) => set({ cornersSquareType: e.target.value as QRCornersSquareType })}>
                {cornerSquareStyles.map((s) => <option key={s} value={s}>{s}</option>)}
              </select></label>
          </div>
          <label className={styles.field}><span className={styles.label}>Corner dot</span>
            <select className={styles.input} value={options.cornersDotType} onChange={(e) => set({ cornersDotType: e.target.value as QRCornersDotType })}>
              {cornerDotStyles.map((s) => <option key={s} value={s}>{s}</option>)}
            </select></label>
        </Fold>

        <Fold title="Your own icon" hint="Upload a logo">
          <div className={styles.field}>
            <span className={styles.label}>Upload a logo</span>
            <IconDropzone options={options} setOptions={setOptions} />
            <span className={styles.hint}>It replaces the center icon you picked above.</span>
          </div>
          <label className={styles.field}>
            <span className={styles.label}>Space around the icon</span>
            <div className={styles.rangeRow}>
              <input className={styles.range} type="range" min={0} max={24} step={1} value={options.iconPadding} onChange={(e) => set({ iconPadding: Number.parseInt(e.target.value, 10) })} disabled={options.icon === 'none'} />
              <span className={styles.rangeValue}>{options.iconPadding}px</span>
            </div>
          </label>
        </Fold>

        <Fold title="Size & download" hint={`${options.size}px · ${options.downloadFormat.toUpperCase()}`}>
          <div className={styles.fieldRow}>
            <label className={styles.field}><span className={styles.label}>Size (px)</span>
              <input className={styles.input} type="number" min={160} max={1200} step={20} value={options.size} onChange={(e) => set({ size: Number.parseInt(e.target.value, 10) || 0 })} /></label>
            <label className={styles.field}><span className={styles.label}>Outer margin</span>
              <input className={styles.input} type="number" min={0} max={64} step={2} value={options.margin} onChange={(e) => set({ margin: Number.parseInt(e.target.value, 10) || 0 })} /></label>
          </div>
          <div className={styles.field}>
            <span className={styles.label}>Format</span>
            <div className={styles.radioGroup}>
              {(['png', 'jpeg'] as const).map((fmt) => (
                <label key={fmt} className={`${styles.radioOption} ${options.downloadFormat === fmt ? styles.radioOptionActive : ''}`}>
                  <input type="radio" name="downloadFormat" value={fmt} checked={options.downloadFormat === fmt} onChange={() => set({ downloadFormat: fmt })} className={styles.srOnly} />
                  {fmt.toUpperCase()}
                  {fmt === 'jpeg' && options.transparentBg && <span className={styles.radioNote}>(no alpha)</span>}
                </label>
              ))}
            </div>
          </div>
        </Fold>
      </div>
    </div>
  );
}

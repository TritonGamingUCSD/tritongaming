'use client';

import { showToast } from '@/lib/toast';
import { useUnsavedChanges } from '@/lib/useUnsavedChanges';
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Pencil, X, Check, MapPin, GripVertical, ArrowUp, ArrowDown, Eye, EyeOff, Monitor, Smartphone, PanelRightClose, PanelRightOpen, Maximize2, Minimize2, ZoomIn } from 'lucide-react';
import type { ContentBlock, FieldDef } from '@/lib/content-blocks';
import { CATEGORY_ORDER } from '@/lib/content-blocks';
import { PAGE_SECTIONS, resolveSections, type PageLayout } from '@/lib/pageLayout';
import { usePortalParams, useLiveParams } from '@/lib/usePortalParams';
import SectionTabs from '@/components/ui/SectionTabs';
import ImageUploadField from '@/components/ImageUploadField/ImageUploadField';
import { useDragReorder } from '@/lib/useDragReorder';
import styles from './ContentEditor.module.css';
import IconButton from '@/components/ui/IconButton';

type BlockDef = ContentBlock;

interface Props {
  /** Search text, owned by the page header's search box. */
  query: string;
  setQuery: (q: string) => void;
  blocks: BlockDef[];
  contentMap: Record<string, Record<string, unknown>>;
  lastEdited: Record<string, { by: string; at: string }>;
}

const ALL_PAGES = ['/', '/our-story', '/team', '/events', '/divisions', '/sponsors', '/get-involved', '/membership', '/media'];

const COLOR_PREVIEW: Record<string, string> = {
  yellow: '#ffc72c', blue: '#275a8f', green: '#059669', red: '#dc2626',
};

// Swaps two rows in place — used by every reorderable list editor below
// (kvlist, imagelist) so "move up"/"move down" is a single adjacent swap
// rather than a full re-sort; repeated clicks walk an item to any position.
// A block's own `pages` array is the single source of truth for "where does
// this text actually show up" — this just turns it into the label/links
// used in the UI ('*' means every public page, rather than one specific
// route to link to).
function pagesLabel(pages: string[]): string {
  if (pages.includes('*')) return 'Every page';
  if (pages.length === 1) return pages[0] === '/' ? 'Homepage' : pages[0];
  return pages.map((p) => (p === '/' ? 'Homepage' : p)).join(', ');
}

export default function ContentEditor({ query, setQuery, blocks, contentMap, lastEdited }: Props) {
  // Which block is open and which area is showing live in the URL (?tab=<area>&subtab=<block key>) so any view is linkable.
  const searchParams = useLiveParams();
  const setParams = usePortalParams();
  const [activeKey, setActiveKey] = useState<string | null>(() => {
    // ?subtab=<block key>; the old ?block=<key> links still work.
    const k = searchParams.get('subtab') ?? searchParams.get('block');
    return k && blocks.some((b) => b.key === k) ? k : null;
  });
  const [category, setCategory] = useState<string | null>(() => {
    // ?tab=<area>; the old ?tab=pages&subtab=<area> links still work.
    const t = searchParams.get('tab');
    const c = t === 'pages' ? searchParams.get('subtab') : t;
    return c && CATEGORY_ORDER.includes(c) ? c : null;
  });
  const [forms, setForms] = useState<Record<string, Record<string, unknown>>>(() => {
    const init: Record<string, Record<string, unknown>> = {};
    blocks.forEach((b) => { init[b.key] = { ...(contentMap[b.key] || {}) }; });
    return init;
  });
  // What's actually saved, per block — edits to several blocks can be pending
  // at once (the form state outlives opening/closing a panel), so "unsaved"
  // means forms differs from this, not "since the last save of anything".
  const [savedForms, setSavedForms] = useState(forms);
  const [saving, setSaving] = useState<string | null>(null);
  const hasUnsaved = JSON.stringify(forms) !== JSON.stringify(savedForms);
  useUnsavedChanges(hasUnsaved ? forms : 'CLEAN');
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const q = query.trim().toLowerCase();
  const visibleBlocks = q
    ? blocks.filter((b) => b.title.toLowerCase().includes(q) || b.description.toLowerCase().includes(q))
    : blocks;

  function setField(key: string, field: string, value: unknown) {
    setForms((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
  }

  async function handleSave(key: string) {
    setSaving(key);
    setError(null);
    try {
      const res = await fetch('/api/admin/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, content: forms[key] }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to save');
      }
      setSavedForms((prev) => ({ ...prev, [key]: forms[key] }));
      setSaved(key);
      showToast('Site content saved');
      setTimeout(() => setSaved(null), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(null);
    }
  }

  const timeAgo = (date: string) => {
    const diff = (Date.now() - new Date(date).getTime()) / 1000;
    if (diff < 60)    return 'just now';
    if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  // The same two-level pattern as every other portal section: a tab per page/area of the site
  // (?tab=<area>), and a sub-tab per block on that page (?subtab=<block key>).
  const categories = CATEGORY_ORDER.filter((c) => blocks.some((b) => b.category === c));
  const keyed = blocks.find((b) => b.key === activeKey);
  const tabCategory = category && categories.includes(category) ? category : (keyed?.category ?? categories[0]);
  const blocksInTab = blocks.filter((b) => b.category === tabCategory);
  const activeBlock = blocksInTab.find((b) => b.key === activeKey) ?? blocksInTab[0];
  const isDirty = (key: string) => JSON.stringify(forms[key]) !== JSON.stringify(savedForms[key]);

  // ── Live preview: the real public page, with these unsaved edits laid over it ──
  const [previewOpen, setPreviewOpen] = useState(true);
  const [device, setDevice] = useState<'desktop' | 'phone'>('desktop');
  const frameRef = useRef<HTMLIFrameElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [boxWidth, setBoxWidth] = useState(600);
  const [boxHeight, setBoxHeight] = useState(400);
  const [full, setFull] = useState(false);
  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFull(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [full]);
  const dirtyDrafts: Record<string, Record<string, unknown>> = {};
  blocks.forEach((b) => { if (isDirty(b.key)) dirtyDrafts[b.key] = forms[b.key]; });
  const draftsJson = JSON.stringify(dirtyDrafts);
  // Sitewide blocks (banner, footer, links) can be previewed on any page; others on the page(s) they appear on.
  const pageChoices = activeBlock ? (activeBlock.pages.includes('*') ? ALL_PAGES : activeBlock.pages) : ['/'];
  const [pagePick, setPagePick] = useState<string | null>(null);
  const previewPage = pagePick && pageChoices.includes(pagePick) ? pagePick : pageChoices[0];
  // Which part of the page to bring into view: the footer for the footer block, otherwise the section holding this block's own heading text.
  const focusMsg = (() => {
    if (!activeBlock) return { type: 'tg-preview-focus', target: 'top' };
    if (activeBlock.key === 'footer') return { type: 'tg-preview-focus', target: 'footer' };
    if (activeBlock.key.startsWith('layout.') || activeBlock.key === 'announcement') return { type: 'tg-preview-focus', target: 'top' };
    const vals = (activeBlock.fields as FieldDef[])
      .filter((f) => f.type === 'text' || f.type === 'textarea')
      .map((f) => forms[activeBlock.key]?.[f.name])
      .filter((v): v is string => typeof v === 'string' && v.trim().length >= 4);
    // A heading-like field first (title/label), else whatever text there is.
    const pref = (activeBlock.fields as FieldDef[]).filter((f) => /title|label|badge/i.test(f.name)).map((f) => forms[activeBlock.key]?.[f.name]).find((v): v is string => typeof v === 'string' && v.trim().length >= 4);
    return { type: 'tg-preview-focus', target: 'text', text: (pref ?? vals[0] ?? '').slice(0, 60) };
  })();
  const focusRef = useRef(focusMsg);
  focusRef.current = focusMsg;
  useEffect(() => {
    // The frame tells us when a page has loaded (a different page reloads it); scroll then, and also right away for a block on the same page.
    const send = () => frameRef.current?.contentWindow?.postMessage(focusRef.current, window.location.origin);
    const onReady = (e: MessageEvent) => { if (e.origin === window.location.origin && e.data?.type === 'tg-preview-ready') setTimeout(send, 400); };
    window.addEventListener('message', onReady);
    const t = setTimeout(send, 150);
    return () => { window.removeEventListener('message', onReady); clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBlock?.key, previewPage]);
  // Keep the preview in step with the text box: send the latest edit shortly after typing pauses, one request at a time (if more typing
  // arrives while one is in flight, only the newest is sent next), then tell the frame to redraw.
  const syncing = useRef(false);
  const latest = useRef(draftsJson);
  latest.current = draftsJson;
  const sentJson = useRef<string | null>(null);
  const pushDrafts = useRef<() => void>(() => {});
  pushDrafts.current = async () => {
    if (syncing.current) return;
    syncing.current = true;
    try {
      while (sentJson.current !== latest.current) {
        const json = latest.current;
        const res = await fetch('/api/admin/content/draft', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ drafts: JSON.parse(json) }) });
        if (!res.ok) break;
        sentJson.current = json;
        frameRef.current?.contentWindow?.postMessage({ type: 'tg-preview-refresh' }, window.location.origin);
      }
    } catch { /* the preview just stays as it was */ }
    syncing.current = false;
  };
  useEffect(() => {
    if (!previewOpen) return;
    const t = setTimeout(() => pushDrafts.current(), 120);
    return () => clearTimeout(t);
  }, [draftsJson, previewOpen]);
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => { setBoxWidth(el.clientWidth); setBoxHeight(el.clientHeight); };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, [previewOpen, !!activeBlock, full]);
  // Zoomed (the default on desktop): the page is shown at a readable width, in a window just tall enough for one section, and the preview
  // jumps to the section being edited (see PreviewBridge). The zoom button switches to the whole page fitted to the panel, and back.
  const [zoomPick, setZoomPick] = useState<boolean | null>(null);
  const zoomed = !full && device === 'desktop' && (zoomPick ?? true);
  const ZOOM_W = 1100;
  const ZOOM_H = 520;
  const zoomScale = Math.min(1, boxWidth / ZOOM_W) || 1;
  const frameW = device === 'desktop' ? (zoomed ? ZOOM_W : 1920) : 390;
  const frameH = device === 'desktop' ? (zoomed ? Math.round(ZOOM_H / zoomScale) : 1080) : 844;
  // The preview area is as tall as the desktop page fitted to the panel; the phone is shrunk to fit that same height instead of towering over it.
  const areaH = 1080 * Math.min(1, boxWidth / 1920);
  const scale = zoomed ? zoomScale : full ? Math.min(boxWidth / frameW, boxHeight / frameH) : device === 'phone' ? Math.min(1, areaH / frameH, boxWidth / frameW) : Math.min(1, boxWidth / frameW);

  function selectCategory(c: string) {
    setCategory(c); setQuery(''); setActiveKey(null); setParams({ tab: c, subtab: null, block: null });
  }
  function selectBlock(block: BlockDef) {
    setCategory(block.category); setActiveKey(block.key); setQuery(''); setParams({ tab: block.category, subtab: block.key, block: null });
  }

  return (
    <div className={styles.shell}>
      <SectionTabs
        label="Site areas"
        value={tabCategory}
        onChange={selectCategory}
        tabs={categories.map((c) => ({ id: c, label: c, badge: blocks.filter((b) => b.category === c && isDirty(b.key)).length }))}
      />


      {!q && blocksInTab.length > 1 && activeBlock && (
        <SectionTabs
          label="Blocks on this page"
          variant="segmented"
          value={activeBlock.key}
          onChange={(k) => { const b = blocks.find((x) => x.key === k); if (b) selectBlock(b); }}
          tabs={blocksInTab.map((b) => ({ id: b.key, label: b.title, badge: isDirty(b.key) ? 1 : 0 }))}
        />
      )}

      {q ? (
        <div className={styles.rows}>
          <div className={styles.searchNote}>{visibleBlocks.length} result{visibleBlocks.length === 1 ? '' : 's'} across every area</div>
          {visibleBlocks.length === 0 && <div className={styles.noResults}>No blocks match &quot;{query}&quot;.</div>}
          {visibleBlocks.map((block) => {
            const preview = getPreview(block, forms[block.key] || {});
            return (
              <button key={block.key} className={styles.row} onClick={() => selectBlock(block)}>
                <span className={styles.blockIcon}>{block.icon}</span>
                <span className={styles.rowText}>
                  <span className={styles.rowTitle}>{block.title}<span className={styles.rowCat}> · {block.category}</span></span>
                  {preview && <span className={styles.rowPreview}>{preview}</span>}
                </span>
                {isDirty(block.key) && <span className={styles.dirtyDot} title="Unsaved changes" />}
              </button>
            );
          })}
        </div>
      ) : activeBlock && (
        <>

          <div className={`${styles.editorWithPreview} ${styles.previewOn}`}>
          <div className={styles.editorCard}>
            <div className={styles.editPanelHeader}>
              <div>
                <span className={styles.editPanelIcon}>{activeBlock.icon}</span>
                <h2 className={styles.editPanelTitle}>{activeBlock.title}</h2>
                <p className={styles.editPanelDesc}>{activeBlock.description}</p>
                <div className={styles.viewLiveRow}>
                  {activeBlock.pages.includes('*') ? (
                    <a href="/" target="_blank" rel="noopener noreferrer" className={styles.viewLiveLink}>View Live Site ↗</a>
                  ) : (
                    activeBlock.pages.map((page) => (
                      <a key={page} href={page} target="_blank" rel="noopener noreferrer" className={styles.viewLiveLink}>View {page === '/' ? 'Homepage' : page} ↗</a>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className={styles.fields}>
              {activeBlock.fields.map((field) => (
                <FieldEditor
                  key={field.name}
                  field={field}
                  value={forms[activeBlock.key]?.[field.name]}
                  onChange={(val) => setField(activeBlock.key, field.name, val)}
                />
              ))}
            </div>

            {error && <div className={styles.editError}>{error}</div>}

            <div className={styles.editActions}>
              <button
                className={styles.cancelBtn}
                onClick={() => setForms((prev) => ({ ...prev, [activeBlock.key]: savedForms[activeBlock.key] }))}
                disabled={!isDirty(activeBlock.key)}
              >
                Discard changes
              </button>
              <button className={styles.saveBtn} onClick={() => handleSave(activeBlock.key)} disabled={saving === activeBlock.key}>
                {saving === activeBlock.key
                  ? <><span className={styles.savingSpinner} /> Saving…</>
                  : saved === activeBlock.key
                  ? <><Check size={16} strokeWidth={2.5} aria-hidden="true" /> Saved</>
                  : 'Save Changes'}
              </button>
            </div>
          </div>

          {(
            <aside className={`${styles.previewPane} ${full ? styles.previewFull : ''} ${!previewOpen ? styles.previewCollapsed : ''}`} aria-label="Live preview">
              <div className={styles.previewBar}>
                <span className={styles.previewTitle}>
                  Live preview
                  {pageChoices.length > 1 ? (
                    <select className={styles.previewPick} value={previewPage} onChange={(e) => setPagePick(e.target.value)} aria-label="Page to preview">
                      {pageChoices.map((pg) => <option key={pg} value={pg}>{pg === '/' ? 'Homepage' : pg}</option>)}
                    </select>
                  ) : <em>{previewPage === '/' ? 'Homepage' : previewPage}</em>}
                </span>
                <div className={styles.previewTools}>
                  <button type="button" className={`${styles.previewTool} ${device === 'desktop' ? styles.previewToolOn : ''}`} onClick={() => setDevice('desktop')} aria-label="Desktop width" title="Desktop"><Monitor size={14} /></button>
                  <button type="button" className={`${styles.previewTool} ${device === 'phone' ? styles.previewToolOn : ''}`} onClick={() => setDevice('phone')} aria-label="Phone width" title="Phone"><Smartphone size={14} /></button>
                  {!full && <button type="button" className={`${styles.previewTool} ${zoomed ? styles.previewToolOn : ''}`} onClick={() => setZoomPick(!zoomed)} aria-pressed={zoomed} aria-label="Zoom in on the section being edited" title={zoomed ? 'Show the whole page' : 'Zoom in on the section being edited'}><ZoomIn size={14} /></button>}
                  <button type="button" className={styles.previewTool} onClick={() => setFull((f) => !f)} aria-label={full ? 'Exit full screen' : 'Full screen'} title={full ? 'Exit full screen (Esc)' : 'Full screen'}>{full ? <Minimize2 size={14} /> : <Maximize2 size={14} />}</button>
                  {!full && <button type="button" className={`${styles.previewTool} ${styles.previewHideBtn}`} onClick={() => setPreviewOpen(false)} aria-label="Hide preview" title="Hide preview"><PanelRightClose size={14} /></button>}
                </div>
              </div>
              <div ref={boxRef} className={`${styles.previewBox} ${device === 'phone' && !full ? styles.previewBoxPhone : ''}`} style={full ? undefined : zoomed ? { height: ZOOM_H } : { height: device === 'phone' ? areaH : frameH * scale }}>
                <div className={styles.previewScaler} style={{ width: frameW * scale, height: frameH * scale }}>
                  <iframe
                    ref={frameRef}
                    key={previewPage}
                    title="Live preview of the public page"
                    src={`/preview${previewPage === '/' ? '' : previewPage}`}
                    className={styles.previewFrame}
                    style={{ width: frameW, height: frameH, transform: `scale(${scale})` }}
                  />
                </div>
              </div>
              <p className={styles.previewNote}>Shows your unsaved edits on the real page. Nothing is public until you press Save Changes.</p>
            </aside>
          )}
          {!previewOpen && (
            <button type="button" className={`${styles.previewShow} ${styles.previewShowBtn}`} onClick={() => setPreviewOpen(true)}><PanelRightOpen size={14} aria-hidden="true" /> Show live preview</button>
          )}
          </div>
        </>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// FieldEditor — renders the right input for each field type
// ──────────────────────────────────────────────────────────────────
function FieldEditor({ field, value, onChange }: {
  field: FieldDef; value: unknown; onChange: (val: unknown) => void;
}) {
  const fieldAny = field as Record<string, unknown>;
  const isOptional = !!fieldAny.optional;

  const labelEl = (
    <div className={styles.fieldLabel}>
      {field.label}
      {isOptional && <span className={styles.optionalTag}>optional</span>}
    </div>
  );

  // ── Toggle ──────────────────────────────────────────
  if (field.type === 'toggle') {
    return (
      <label className={styles.toggleField}>
        <div className={styles.toggleWrap}>
          <div className={`${styles.toggle} ${value ? styles.toggleOn : ''}`}>
            <div className={styles.toggleKnob} />
          </div>
          <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} className={styles.toggleInput} />
        </div>
        <div>
          {labelEl}
          <div className={styles.fieldHint}>{value ? 'Visible to all visitors' : 'Currently hidden'}</div>
        </div>
      </label>
    );
  }

  // ── Textarea ─────────────────────────────────────────
  if (field.type === 'textarea') {
    return (
      <label className={styles.fieldGroup}>
        {labelEl}
        <textarea
          className={`${styles.fieldInput} ${styles.fieldTextarea}`}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          rows={5}
          placeholder={fieldAny.placeholder as string}
        />
      </label>
    );
  }

  // ── Markdown (Write/Preview tabs) ─────────────────────
  if (field.type === 'markdown') {
    return <MarkdownField label={field.label} value={(value as string) ?? ''} onChange={onChange} optional={isOptional} placeholder={fieldAny.placeholder as string} />;
  }

  // ── Lines (array stored as newline-separated text) ───
  if (field.type === 'lines') {
    const lines = Array.isArray(value) ? (value as string[]).join('\n') : (value as string) ?? '';
    return (
      <label className={styles.fieldGroup}>
        {labelEl}
        <textarea
          className={`${styles.fieldInput} ${styles.fieldTextarea}`}
          value={lines}
          onChange={(e) => onChange(e.target.value.split('\n'))}
          rows={4}
          placeholder={fieldAny.placeholder as string}
        />
        <div className={styles.fieldHint}>Each line = one row of text</div>
      </label>
    );
  }

  // ── Page sections: show / hide / reorder ─────────────
  if (field.type === 'sections') {
    const defs = PAGE_SECTIONS[(field as { page: string }).page] ?? [];
    const layout = (value && typeof value === 'object' ? value : {}) as PageLayout;
    const hidden = Array.isArray(layout.hidden) ? layout.hidden : [];
    // Current order = the saved order (hidden ones included), then any section not mentioned yet.
    const saved = (Array.isArray(layout.order) ? layout.order : []).filter((id) => defs.some((d) => d.id === id));
    const order = [...saved, ...defs.map((d) => d.id).filter((id) => !saved.includes(id))];
    const set = (nextOrder: string[], nextHidden: string[]) => onChange({ order: nextOrder, hidden: nextHidden });
    const move = (i: number, d: -1 | 1) => { const n = [...order]; const j = i + d; if (j < 0 || j >= n.length) return; [n[i], n[j]] = [n[j], n[i]]; set(n, hidden); };
    const shownNow = resolveSections((field as { page: string }).page, layout).length;
    return (
      <div className={styles.fieldGroup}>
        {labelEl}
        <ul className={styles.sectionList}>
          {order.map((id, i) => {
            const def = defs.find((d) => d.id === id);
            const off = hidden.includes(id);
            return (
              <li key={id} className={`${styles.sectionRow} ${off ? styles.sectionOff : ''}`}>
                <span className={styles.sectionName}>{def?.label ?? id}</span>
                <span className={styles.sectionBtns}>
                  <button type="button" className={styles.sectionBtn} onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${def?.label} up`}><ArrowUp size={14} /></button>
                  <button type="button" className={styles.sectionBtn} onClick={() => move(i, 1)} disabled={i === order.length - 1} aria-label={`Move ${def?.label} down`}><ArrowDown size={14} /></button>
                  <button type="button" className={`${styles.sectionBtn} ${off ? '' : styles.sectionBtnOn}`} onClick={() => set(order, off ? hidden.filter((h) => h !== id) : [...hidden, id])} aria-pressed={!off} aria-label={off ? `Show ${def?.label}` : `Hide ${def?.label}`}>
                    {off ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
        <div className={styles.fieldHint}>{shownNow} of {order.length} sections shown. The banner at the top of the page always stays first.</div>
      </div>
    );
  }

  // ── Select pills ─────────────────────────────────────
  if (field.type === 'select') {
    const opts = (fieldAny.options as string[]) ?? [];
    return (
      <label className={styles.fieldGroup}>
        {labelEl}
        <div className={styles.selectWrap}>
          {opts.map((opt) => (
            <button
              key={opt}
              type="button"
              className={`${styles.selectOpt} ${value === opt ? styles.selectOptActive : ''}`}
              style={value === opt ? {
                background: (COLOR_PREVIEW[opt] || '#fff') + '22',
                borderColor: COLOR_PREVIEW[opt] || '#fff',
                color: COLOR_PREVIEW[opt] || '#fff',
              } : {}}
              onClick={() => onChange(opt)}
            >
              {COLOR_PREVIEW[opt] && <span className={styles.colorDot} style={{ background: COLOR_PREVIEW[opt] }} />}
              {opt}
            </button>
          ))}
        </div>
      </label>
    );
  }

  // ── KV list ───────────────────────────────────────────
  if (field.type === 'kvlist') {
    return (
      <KvListField
        value={value as Array<{ label?: string; value?: string }> | undefined}
        onChange={onChange}
        labelEl={labelEl}
        keyLbl={(fieldAny.kvKeyLabel as string) ?? 'Key'}
        valLbl={(fieldAny.kvValueLabel as string) ?? 'Value'}
      />
    );
  }

  // ── Single image (direct upload) ──────────────────────
  if (field.type === 'image') {
    return (
      <div className={styles.fieldGroup}>
        {labelEl}
        <ImageUploadField
          label={field.label}
          value={(value as string) ?? ''}
          onChange={onChange}
          bucket="site-content"
          shape="wide"
        />
      </div>
    );
  }

  // ── Image list (sponsors, membership partners, …) ─────
  if (field.type === 'imagelist') {
    return (
      <ImageListField
        value={value as ImgItem[] | undefined}
        onChange={onChange}
        labelEl={labelEl}
        fields={(fieldAny.imageFields as ImgFieldDef[]) ?? DEFAULT_IMAGE_FIELDS}
        addLabel={fieldAny.addLabel as string | undefined}
      />
    );
  }

  // ── Default: text / url ───────────────────────────────
  return (
    <label className={styles.fieldGroup}>
      {labelEl}
      <input
        type={field.type === 'url' ? 'url' : 'text'}
        className={styles.fieldInput}
        value={(value as string) ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={fieldAny.placeholder as string}
      />
    </label>
  );
}

// ──────────────────────────────────────────────────────────────────
// KvListField / ImageListField — broken out (rather than left inline in
// FieldEditor) because reordering needs its own hook call, and hooks can
// only sit at a component's top level, not inside an `if (field.type ===
// …)` branch of a bigger component that also handles every other field
// type.
// ──────────────────────────────────────────────────────────────────
function KvListField({ value, onChange, labelEl, keyLbl, valLbl }: {
  value: Array<{ label?: string; value?: string }> | undefined;
  onChange: (val: Array<{ label?: string; value?: string }>) => void;
  labelEl: React.ReactNode;
  keyLbl: string;
  valLbl: string;
}) {
  const items = Array.isArray(value) ? value : [];
  const { dragIndex, overIndex, dragHandleProps, dropTargetProps } = useDragReorder(items, onChange);

  return (
    <div className={styles.fieldGroup}>
      {labelEl}
      <div className={styles.kvList}>
        {items.map((item, i) => (
          <div
            key={i}
            className={`${styles.kvRowWrap} ${dragIndex === i ? styles.rowDragging : ''} ${overIndex === i && dragIndex !== i ? styles.rowDragOver : ''}`}
            {...dropTargetProps(i)}
          >
            <span className={styles.dragHandle} {...dragHandleProps(i)} aria-label="Drag to reorder">
              <GripVertical size={14} strokeWidth={1.75} aria-hidden="true" />
            </span>
            <div className={styles.kvRow}>
              <input className={styles.fieldInput} value={item.value ?? ''} placeholder={keyLbl}
                onChange={(e) => { const n=[...items]; n[i]={...n[i],value:e.target.value}; onChange(n); }} />
              <input className={styles.fieldInput} value={item.label ?? ''} placeholder={valLbl}
                onChange={(e) => { const n=[...items]; n[i]={...n[i],label:e.target.value}; onChange(n); }} />
              <div className={styles.rowActions}>
                <IconButton kind="remove" size="sm" label="Remove" onClick={() => onChange(items.filter((_,j)=>j!==i))} />
              </div>
            </div>
          </div>
        ))}
        <button type="button" className={styles.kvAdd}
          onClick={() => onChange([...items,{value:'',label:''}])}>+ Add Item</button>
      </div>
    </div>
  );
}

type ImgItem = Record<string, string | undefined>;
type ImgFieldDef = { key: string; label: string; type?: string; optional?: boolean };

// Sponsors' own shape — the long-standing default so a block that doesn't
// declare `imageFields` (there shouldn't be one left, but this keeps an old
// saved row from rendering blank inputs instead of a clear label) still
// gets sensible labels rather than raw keys.
const DEFAULT_IMAGE_FIELDS: ImgFieldDef[] = [
  { key: 'name', label: 'Name', type: 'text' },
  { key: 'logo_url', label: 'Logo', type: 'image' },
  { key: 'website_url', label: 'Website URL', type: 'url' },
  { key: 'tier', label: 'Tier (e.g. Gold)', type: 'text' },
];

function ImageListField({ value, onChange, labelEl, fields, addLabel = '+ Add Item' }: {
  value: ImgItem[] | undefined;
  onChange: (val: ImgItem[]) => void;
  labelEl: React.ReactNode;
  fields: ImgFieldDef[];
  addLabel?: string;
}) {
  const items = Array.isArray(value) ? value : [];
  const { dragIndex, overIndex, dragHandleProps, dropTargetProps } = useDragReorder(items, onChange);

  return (
    <div className={styles.fieldGroup}>
      {labelEl}
      <div className={styles.imageList}>
        {items.map((item, i) => (
          <div
            key={i}
            className={`${styles.imageCard} ${dragIndex === i ? styles.rowDragging : ''} ${overIndex === i && dragIndex !== i ? styles.rowDragOver : ''}`}
            {...dropTargetProps(i)}
          >
            <span className={styles.dragHandle} {...dragHandleProps(i)} aria-label="Drag to reorder">
              <GripVertical size={14} strokeWidth={1.75} aria-hidden="true" />
            </span>
            {!fields.some((f) => f.type === 'image') && <div className={styles.imageCardLeft}>
              {item.logo_url ? (
                <Image src={item.logo_url} alt={item.name||''} width={48} height={48}
                  className={styles.imageLogo} unoptimized />
              ) : (
                <div className={styles.imageLogoFallback}>
                  {(item.name || '?')[0].toUpperCase()}
                </div>
              )}
            </div>}
            <div className={styles.imageCardFields}>
              {fields.map(({ key: k, label: lbl, type: t, optional }) => t === 'image' ? (
                // Logos are uploaded (compressed and cropped like every other upload) rather than pasted as a link.
                <div key={k} className={styles.personField}>
                  <ImageUploadField
                    label={optional ? `${lbl} (optional)` : lbl}
                    value={item[k] ?? ''}
                    onChange={(url) => { const n = [...items]; n[i] = { ...n[i], [k]: url }; onChange(n); }}
                    bucket="site-content"
                    shape="logo"
                    maxDimension={600}
                  />
                </div>
              ) : (
                <label key={k} className={styles.personField}>
                  <span className={styles.personFieldLabel}>{lbl}{optional && <span className={styles.optionalTag}>optional</span>}</span>
                  <input
                    type={t === 'url' ? 'url' : 'text'}
                    className={styles.fieldInput}
                    value={item[k] ?? ''}
                    onChange={(e) => {
                      const n = [...items];
                      n[i] = { ...n[i], [k]: e.target.value };
                      onChange(n);
                    }}
                  />
                </label>
              ))}
            </div>
            <div className={styles.rowActions}>
              <IconButton kind="remove" size="sm" label="Remove" onClick={() => onChange(items.filter((_,j)=>j!==i))} />
            </div>
          </div>
        ))}
        <button type="button" className={styles.kvAdd}
          onClick={() => onChange([...items, {}])}>{addLabel}</button>
      </div>
    </div>
  );
}

// Markdown text box. No separate preview: the live preview beside the editor shows the real page.
function MarkdownField({ label, value, onChange, optional, placeholder }: {
  label: string; value: string; onChange: (val: string) => void; optional?: boolean; placeholder?: string;
}) {
  return (
    <div className={styles.fieldGroup}>
      <div className={styles.mdFieldHeader}>
        <div className={styles.fieldLabel}>
          {label}
          {optional && <span className={styles.optionalTag}>optional</span>}
        </div>
      </div>
      <textarea
        className={`${styles.fieldInput} ${styles.fieldTextarea}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={6}
        placeholder={placeholder}
      />
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Preview helper
// ──────────────────────────────────────────────────────────────────
function getPreview(block: BlockDef, data: Record<string, unknown>): string {
  switch (block.key) {
    case 'announcement':
      if (!data.enabled) return '(hidden)';
      return (data.text as string) || '';
    case 'homepage.hero':
    case 'homepage.about':
    case 'page.about':
    case 'page.divisions':
      return (data.title as string) || '';
    case 'page.get-involved':
      return (data.hero_title as string) || '';
    case 'page.get-involved.officer':
      return (data.title as string) || '';
    case 'page.events':
      return (data.title as string) || (data.label as string) || '';
    case 'page.sponsors':
      return (data.hero_title as string) || '';
    case 'homepage.events':
    case 'homepage.sponsors':
      return (data.title as string) || (data.label as string) || '';
    case 'page.our-story':
      return [data.section1_title, data.section2_title, data.section3_title]
        .filter(Boolean).join(' · ');
    case 'homepage.recruitment':
      return [data.officer_title, data.discord_title, data.social_title]
        .filter(Boolean).join(' · ');
    case 'homepage.stats': {
      const items = data.items as Array<{ value: string; label: string }> | undefined;
      return items?.slice(0,2).map((i) => `${i.value} ${i.label}`).join(' · ') || '';
    }
    case 'site.settings':
      return [data.discord && 'Discord', data.instagram && 'Instagram', data.email && 'Email']
        .filter(Boolean).join(' · ') || 'No links set';
    case 'footer':
      return (data.tagline as string) || (data.copyright as string) || '';
    case 'sponsors': {
      const items = data.items as unknown[] | undefined;
      return items?.length ? `${items.length} sponsor${items.length !== 1 ? 's' : ''}` : '';
    }
    case 'page.membership':
      return (data.hero_title as string) || '';
    case 'membership.partners': {
      const items = data.items as unknown[] | undefined;
      return items?.length ? `${items.length} partner${items.length !== 1 ? 's' : ''}` : '';
    }
    case 'page.media':
      return (data.hero_title as string) || '';
    case 'media.videos': {
      const items = data.items as unknown[] | undefined;
      return items?.length ? `${items.length} video${items.length !== 1 ? 's' : ''}` : '';
    }
    case 'media.albums': {
      const items = data.items as unknown[] | undefined;
      return items?.length ? `${items.length} album${items.length !== 1 ? 's' : ''}` : '';
    }
    default:
      return '';
  }
}

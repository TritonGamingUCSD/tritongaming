'use client';

import { Select } from '@/components/ui/Field';
import { showToast } from '@/lib/toast';
import { useUnsavedChanges } from '@/lib/useUnsavedChanges';
import { useEffect, useRef, useState } from 'react';
import { useDraft } from '@/lib/useDraft';
import type { CreditPerson } from '@/lib/creditPeople';
import SaveBar from '@/components/portal/SaveBar';
import EditingNow from '@/components/portal/EditingNow';
import DraftBanner from '@/components/portal/DraftBanner';
import Image from 'next/image';
import { Pencil, Plus, X, MapPin, GripVertical, ArrowUp, ArrowDown, Eye, EyeOff, Monitor, Smartphone, PanelRightClose, PanelRightOpen, Maximize2, Minimize2, ZoomIn } from 'lucide-react';
import type { ContentBlock, FieldDef } from '@/lib/content-blocks';
import { CATEGORY_ORDER, BLOCK_ORDER, BLOCK_GROUPS, sortFields } from '@/lib/content-blocks';
import { usePortalParams, useLiveParams } from '@/lib/usePortalParams';
import SectionTabs from '@/components/ui/SectionTabs';
import ImageUploadField from '@/components/ImageUploadField/ImageUploadField';
import { useDragReorder } from '@/lib/useDragReorder';
import styles from './ContentEditor.module.css';
import IconButton from '@/components/ui/IconButton';
import Button from '@/components/ui/Button';

type BlockDef = ContentBlock;

interface Props {
  /** Search text, owned by the page header's search box. */
  query: string;
  setQuery: (q: string) => void;
  blocks: BlockDef[];
  contentMap: Record<string, Record<string, unknown>>;
  lastEdited: Record<string, { by: string; at: string }>;
  /** Officers an editor can credit, so a name and link are picked, not typed twice. */
  creditPeople?: CreditPerson[];
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

export default function ContentEditor({ query, setQuery, blocks, contentMap, lastEdited, creditPeople }: Props) {
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
  // Only the blocks that differ from what is saved are kept as a draft in this browser.
  const edited = Object.fromEntries(Object.keys(forms).filter((k) => JSON.stringify(forms[k]) !== JSON.stringify(savedForms[k])).map((k) => [k, forms[k]]));
  const draft = useDraft<Record<string, Record<string, unknown>>>('site-content', edited, (v) => Object.keys(v).length === 0);
  const [error, setError] = useState<string | null>(null);

  const q = query.trim().toLowerCase();
  const visibleBlocks = q
    ? blocks.filter((b) => b.title.toLowerCase().includes(q) || b.description.toLowerCase().includes(q))
    : blocks;

  function setField(key: string, field: string, value: unknown) {
    setForms((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
  }

  async function handleSave(key: string): Promise<boolean> {
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
      showToast('Site content saved');
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
      return false;
    } finally {
      setSaving(null);
    }
  }

  // Every section with edits, saved one after the other; it stops at the first one that fails so the error stays on screen.
  const dirtyKeys = Object.keys(forms).filter((k) => JSON.stringify(forms[k]) !== JSON.stringify(savedForms[k]));
  async function saveAll() {
    for (const k of dirtyKeys) if (!(await handleSave(k))) return;
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
  // The blocks of the open page, in the order they appear on that page (BLOCK_ORDER), so editing goes top to bottom like the page reads.
  const rank = (k: string) => { const i = BLOCK_ORDER.indexOf(k); return i === -1 ? 999 : i; };
  const blocksInTab = blocks.filter((b) => b.category === tabCategory).sort((a, b) => rank(a.key) - rank(b.key));
  // Sub-tabs only where a page has blocks in more than one group (BLOCK_GROUPS); the blocks of the open group are stacked in page order.
  const groupOf = (k: string) => BLOCK_GROUPS[k] ?? 'Page';
  const groups = [...new Set(blocksInTab.map((b) => groupOf(b.key)))];
  const [groupPick, setGroupPick] = useState<string | null>(null);
  const group = groupPick && groups.includes(groupPick) ? groupPick : (keyed && groups.includes(groupOf(keyed.key)) && keyed.category === tabCategory ? groupOf(keyed.key) : groups[0]);
  const blocksShown = blocksInTab.filter((b) => groupOf(b.key) === group);
  const activeBlock = blocksShown.find((b) => b.key === activeKey) ?? blocksShown[0];
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
    if (activeBlock.key === 'announcement') return { type: 'tg-preview-focus', target: 'top' };
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

  // Opening the editor from a link to one block (?subtab=<key>) scrolls to it.
  useEffect(() => {
    const k = searchParams.get('subtab') ?? searchParams.get('block');
    if (k) setTimeout(() => document.getElementById(`block-${k}`)?.scrollIntoView({ block: 'start' }), 300);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function selectCategory(c: string) {
    setCategory(c); setGroupPick(null); setQuery(''); setActiveKey(null); setParams({ tab: c, subtab: null, block: null });
  }
  function selectBlock(block: BlockDef) {
    setCategory(block.category); setGroupPick(groupOf(block.key)); setActiveKey(block.key); setQuery(''); setParams({ tab: block.category, subtab: block.key, block: null });
    // the page's blocks are all on screen: bring this one into view once the list has drawn
    setTimeout(() => document.getElementById(`block-${block.key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  }

  return (
    <div className={styles.shell}>
      {draft.offer && <DraftBanner at={draft.offer.at} what="edits" onContinue={() => { const d = draft.accept(); if (d) setForms((f) => ({ ...f, ...Object.fromEntries(Object.entries(d).filter(([k]) => k in f)) })); }} onDiscard={draft.discard} />}
      <SectionTabs
        label="Site areas"
        value={tabCategory}
        onChange={selectCategory}
        tabs={categories.map((c) => ({ id: c, label: c, badge: blocks.filter((b) => b.category === c && isDirty(b.key)).length }))}
      />
      <EditingNow room={`content:${tabCategory}`} what={`the ${tabCategory} content`} />


      {!q && groups.length > 1 && (
        <SectionTabs
          label="Parts of this page"
          variant="segmented"
          value={group}
          onChange={(g) => { setGroupPick(g); setActiveKey(null); }}
          tabs={groups.map((g) => ({ id: g, label: g, badge: blocksInTab.filter((b) => groupOf(b.key) === g && isDirty(b.key)).length }))}
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
          <div className={styles.editorStack}>
            {blocksShown.map((block) => (
              <div
                key={block.key}
                id={`block-${block.key}`}
                className={`${styles.editorCard} ${block.key === activeBlock.key ? styles.editorCardActive : ''}`}
                onFocusCapture={() => { if (activeKey !== block.key) setActiveKey(block.key); }}
                onClick={() => { if (activeKey !== block.key) setActiveKey(block.key); }}
              >
                <div className={styles.editPanelHeader}>
                  <div>
                    <span className={styles.editPanelIcon}>{block.icon}</span>
                    <h2 className={styles.editPanelTitle}>{block.title}{isDirty(block.key) && <span className={styles.dirtyDot} title="Unsaved changes" />}</h2>
                    <p className={styles.editPanelDesc}>{block.description}</p>
                  </div>
                </div>

                <div className={styles.fields}>
                  {sortFields(block.key, block.fields as FieldDef[]).map((field) => (
                    <FieldEditor
                      key={field.name}
                      field={field}
                      value={forms[block.key]?.[field.name]}
                      onChange={(val) => setField(block.key, field.name, val)}
                      creditPeople={creditPeople}
                      hasField={(n) => (block.fields as FieldDef[]).some((f) => f.name === n)}
                      setSibling={(n, v) => setField(block.key, n, v)}
                    />
                  ))}
                </div>

                {error && saving === null && block.key === activeBlock.key && <div className={styles.editError}>{error}</div>}
              </div>
            ))}
            <SaveBar dirty={hasUnsaved} saving={saving !== null} onSave={saveAll} saveLabel="Save changes" message={dirtyKeys.length > 1 ? `${dirtyKeys.length} sections have unsaved changes` : 'You have unsaved changes'} onDiscard={() => { setForms(savedForms); setError(null); }} />
          </div>

          {(
            <aside className={`${styles.previewPane} ${full ? styles.previewFull : ''} ${!previewOpen ? styles.previewCollapsed : ''}`} aria-label="Live preview">
              <div className={styles.previewBar}>
                <span className={styles.previewTitle}>
                  Live preview
                  {pageChoices.length > 1 ? (
                    <Select className={styles.previewPick} value={previewPage} onChange={(e) => setPagePick(e.target.value)} aria-label="Page to preview">
                      {pageChoices.map((pg) => <option key={pg} value={pg}>{pg === '/' ? 'Homepage' : pg}</option>)}
                    </Select>
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
function FieldEditor({ field, value, onChange, creditPeople, hasField, setSibling }: {
  field: FieldDef; value: unknown; onChange: (val: unknown) => void;
  creditPeople?: CreditPerson[]; hasField?: (name: string) => boolean; setSibling?: (name: string, value: unknown) => void;
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
                background: (COLOR_PREVIEW[opt] || '#888888') + '22',
                borderColor: COLOR_PREVIEW[opt] || 'var(--pp-ink)',
                color: `color-mix(in srgb, ${COLOR_PREVIEW[opt] || 'var(--pp-ink)'} 55%, var(--pp-ink))`,
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
        creditPeople={creditPeople}
      />
    );
  }

  // ── Default: text / url ───────────────────────────────
  // A credit line can be picked from the officers: it fills the name (keeping the "Photo: " style) and, when the person shares one and the
  // block has a link field next to it, their link too.
  const isCredit = field.type !== 'url' && /credit$/.test(field.name) && !!creditPeople?.length;
  const prefix = ((fieldAny.placeholder as string | undefined) ?? '').match(/^[^:]+:\s*/)?.[0] ?? '';
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
      {isCredit && (
        <Select className={styles.fieldInput} value="" aria-label={`Pick an officer for ${field.label}`}
          onChange={(e) => {
            const p = creditPeople!.find((x) => x.id === e.target.value);
            if (!p) return;
            onChange(`${prefix}${p.name}`);
            const urlField = `${field.name}_url`;
            if (p.link && hasField?.(urlField)) setSibling?.(urlField, p.link);
          }}>
          <option value="">Pick an officer…</option>
          {creditPeople!.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
      )}
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
  const { view: viewItems, dragIndex, overIndex, dragHandleProps, dropTargetProps } = useDragReorder(items, onChange);

  return (
    <div className={styles.fieldGroup}>
      {labelEl}
      <div className={styles.kvList}>
        {viewItems.map((item, i) => (
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
        <Button size="sm" variant="secondary" onClick={() => onChange([...items, { value: '', label: '' }])}><Plus size={14} aria-hidden="true" /> Add item</Button>
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

function ImageListField({ value, onChange, labelEl, fields, addLabel = '+ Add Item', creditPeople }: {
  value: ImgItem[] | undefined;
  onChange: (val: ImgItem[]) => void;
  labelEl: React.ReactNode;
  fields: ImgFieldDef[];
  addLabel?: string;
  creditPeople?: CreditPerson[];
}) {
  const items = Array.isArray(value) ? value : [];
  const { view: viewItems, dragIndex, overIndex, dragHandleProps, dropTargetProps } = useDragReorder(items, onChange);

  return (
    <div className={styles.fieldGroup}>
      {labelEl}
      <div className={styles.imageList}>
        {viewItems.map((item, i) => (
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
                  {k === 'credit' && !!creditPeople?.length && (
                    <Select className={styles.fieldInput} value="" aria-label="Pick an officer to credit"
                      onChange={(e) => {
                        const p = creditPeople.find((x) => x.id === e.target.value);
                        if (!p) return;
                        const n = [...items];
                        n[i] = { ...n[i], credit: p.name, ...(p.link && fields.some((f) => f.key === 'credit_url') ? { credit_url: p.link } : {}) };
                        onChange(n);
                      }}>
                      <option value="">Pick an officer…</option>
                      {creditPeople.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </Select>
                  )}
                </label>
              ))}
            </div>
            <div className={styles.rowActions}>
              <IconButton kind="remove" size="sm" label="Remove" onClick={() => onChange(items.filter((_,j)=>j!==i))} />
            </div>
          </div>
        ))}
        <Button size="sm" variant="secondary" onClick={() => onChange([...items, {}])}><Plus size={14} aria-hidden="true" /> {addLabel.replace(/^\+\s*/, '')}</Button>
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

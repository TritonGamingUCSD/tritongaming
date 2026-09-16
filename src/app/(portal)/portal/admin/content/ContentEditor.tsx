'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Pencil, X, Check } from 'lucide-react';
import type { ContentBlock, FieldDef } from '@/lib/content-blocks';
import { CATEGORY_ORDER } from '@/lib/content-blocks';
import ImageUploadField from '@/components/ImageUploadField/ImageUploadField';
import MarkdownContent from '@/components/MarkdownContent/MarkdownContent';
import styles from './ContentEditor.module.css';

type BlockDef = ContentBlock;

interface Props {
  blocks: BlockDef[];
  contentMap: Record<string, Record<string, unknown>>;
  lastEdited: Record<string, { by: string; at: string }>;
}

const COLOR_PREVIEW: Record<string, string> = {
  yellow: '#ffc72c', blue: '#275a8f', green: '#059669', red: '#dc2626',
};

// Where a block's own content actually shows up, for the "View Live Page"
// link — omitted for blocks that only affect a fragment of a page (e.g.
// site.settings feeds icons in the footer, not a page of its own).
const BLOCK_LIVE_URL: Record<string, string> = {
  'homepage.hero': '/',
  'homepage.about': '/',
  'homepage.stats': '/',
  'page.get-involved': '/get-involved',
  'sponsors': '/sponsors',
  'footer': '/',
};

export default function ContentEditor({ blocks, contentMap, lastEdited }: Props) {
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [forms, setForms] = useState<Record<string, Record<string, unknown>>>(() => {
    const init: Record<string, Record<string, unknown>> = {};
    blocks.forEach((b) => { init[b.key] = { ...(contentMap[b.key] || {}) }; });
    return init;
  });
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const q = query.trim().toLowerCase();
  const visibleBlocks = q
    ? blocks.filter((b) => b.title.toLowerCase().includes(q) || b.description.toLowerCase().includes(q))
    : blocks;

  const activeBlock = blocks.find((b) => b.key === activeKey);

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
      setSaved(key);
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

  return (
    <div className={styles.layout}>
      {/* Block list */}
      <div className={styles.blockList}>
        <input
          className={styles.searchInput}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search content blocks…"
          aria-label="Search content blocks"
        />
        {q && visibleBlocks.length === 0 && (
          <div className={styles.noResults}>No blocks match &quot;{query}&quot;.</div>
        )}
        {CATEGORY_ORDER.map((cat) => {
          const catBlocks = visibleBlocks.filter((b) => b.category === cat);
          if (!catBlocks.length) return null;
          return (
            <div key={cat} className={styles.catGroup}>
              <div className={styles.catLabel}>{cat}</div>
              {catBlocks.map((block) => {
                const isActive = activeKey === block.key;
                const le = lastEdited[block.key];
                const formData = forms[block.key] || {};
                const preview = getPreview(block, formData);
                return (
                  <button
                    key={block.key}
                    className={`${styles.blockCard} ${isActive ? styles.blockCardActive : ''}`}
                    onClick={() => setActiveKey(isActive ? null : block.key)}
                  >
                    <div className={styles.blockCardTop}>
                      <span className={styles.blockIcon}>{block.icon}</span>
                      <div className={styles.blockMeta}>
                        <div className={styles.blockTitle}>{block.title}</div>
                        <div className={styles.blockDesc}>{block.description}</div>
                      </div>
                      <span className={`${styles.editIndicator} ${isActive ? styles.editIndicatorActive : ''}`}>
                        {isActive ? <X size={16} strokeWidth={1.75} aria-hidden="true" /> : <Pencil size={16} strokeWidth={1.5} aria-hidden="true" />}
                      </span>
                    </div>
                    {preview && <div className={styles.blockPreview}>{preview}</div>}
                    {le && <div className={styles.lastEdited}>Edited by {le.by} · {timeAgo(le.at)}</div>}
                    {saved === block.key && <div className={styles.savedBadge}><Check size={13} strokeWidth={1.75} aria-hidden="true" /> Saved</div>}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Edit panel */}
      <div className={`${styles.editPanel} ${activeBlock ? styles.editPanelOpen : ''}`}>
        {activeBlock ? (
          <div className={styles.editPanelInner}>
            <div className={styles.editPanelHeader}>
              <div>
                <span className={styles.editPanelIcon}>{activeBlock.icon}</span>
                <h2 className={styles.editPanelTitle}>{activeBlock.title}</h2>
                <p className={styles.editPanelDesc}>{activeBlock.description}</p>
                {BLOCK_LIVE_URL[activeBlock.key] && (
                  <a
                    href={BLOCK_LIVE_URL[activeBlock.key]}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.viewLiveLink}
                  >
                    View Live Page ↗
                  </a>
                )}
              </div>
              <button className={styles.closePanel} onClick={() => setActiveKey(null)}><X size={18} strokeWidth={1.75} /></button>
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
              <button className={styles.cancelBtn} onClick={() => setActiveKey(null)}>Cancel</button>
              <button
                className={styles.saveBtn}
                onClick={() => handleSave(activeBlock.key)}
                disabled={saving === activeBlock.key}
              >
                {saving === activeBlock.key
                  ? <><span className={styles.savingSpinner} /> Saving…</>
                  : saved === activeBlock.key
                  ? <><Check size={15} strokeWidth={1.75} aria-hidden="true" /> Saved!</>
                  : 'Save Changes'}
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.editPanelEmpty}>
            <span className={styles.editPanelEmptyIcon}><Pencil size={40} strokeWidth={1.25} aria-hidden="true" /></span>
            <p>Select a content block on the left to edit it.</p>
            <p className={styles.editPanelEmptyHint}>Changes go live immediately — no code needed.</p>
          </div>
        )}
      </div>
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
    const items = (Array.isArray(value) ? value : []) as Array<{ label?: string; value?: string }>;
    const keyLbl = (fieldAny.kvKeyLabel as string) ?? 'Key';
    const valLbl = (fieldAny.kvValueLabel as string) ?? 'Value';
    return (
      <div className={styles.fieldGroup}>
        {labelEl}
        <div className={styles.kvList}>
          {items.map((item, i) => (
            <div key={i} className={styles.kvRow}>
              <input className={styles.fieldInput} value={item.value ?? ''} placeholder={keyLbl}
                onChange={(e) => { const n=[...items]; n[i]={...n[i],value:e.target.value}; onChange(n); }} />
              <input className={styles.fieldInput} value={item.label ?? ''} placeholder={valLbl}
                onChange={(e) => { const n=[...items]; n[i]={...n[i],label:e.target.value}; onChange(n); }} />
              <button type="button" className={styles.kvRemove}
                onClick={() => onChange(items.filter((_,j)=>j!==i))}><X size={14} strokeWidth={1.75} /></button>
            </div>
          ))}
          <button type="button" className={styles.kvAdd}
            onClick={() => onChange([...items,{value:'',label:''}])}>+ Add Item</button>
        </div>
      </div>
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

  // ── Image list (sponsors) ─────────────────────────────
  if (field.type === 'imagelist') {
    type ImgItem = { name?: string; logo_url?: string; website_url?: string; tier?: string };
    const items = (Array.isArray(value) ? value : []) as ImgItem[];
    return (
      <div className={styles.fieldGroup}>
        {labelEl}
        <div className={styles.imageList}>
          {items.map((item, i) => (
            <div key={i} className={styles.imageCard}>
              <div className={styles.imageCardLeft}>
                {item.logo_url ? (
                  <Image src={item.logo_url} alt={item.name||''} width={48} height={48}
                    className={styles.imageLogo} unoptimized />
                ) : (
                  <div className={styles.imageLogoFallback}>
                    {(item.name || '?')[0].toUpperCase()}
                  </div>
                )}
              </div>
              <div className={styles.imageCardFields}>
                {[
                  { key: 'name',        label: 'Name',        type: 'text' },
                  { key: 'logo_url',    label: 'Logo URL',    type: 'url'  },
                  { key: 'website_url', label: 'Website URL', type: 'url'  },
                  { key: 'tier',        label: 'Tier (e.g. Gold)', type: 'text' },
                ].map(({ key: k, label: lbl, type: t }) => (
                  <label key={k} className={styles.personField}>
                    <span className={styles.personFieldLabel}>{lbl}</span>
                    <input
                      type={t}
                      className={styles.fieldInput}
                      value={(item[k as keyof ImgItem] as string) ?? ''}
                      onChange={(e) => {
                        const n = [...items];
                        n[i] = { ...n[i], [k]: e.target.value };
                        onChange(n);
                      }}
                    />
                  </label>
                ))}
              </div>
              <button type="button" className={styles.kvRemove}
                onClick={() => onChange(items.filter((_,j)=>j!==i))}><X size={14} strokeWidth={1.75} /></button>
            </div>
          ))}
          <button type="button" className={styles.kvAdd}
            onClick={() => onChange([...items, {}])}>+ Add Sponsor</button>
        </div>
      </div>
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

// Same Write/Preview pattern as EventForm's MarkdownField — a plain
// textarea gives no way to check formatting without saving and reloading
// the live page in another tab.
function MarkdownField({ label, value, onChange, optional, placeholder }: {
  label: string; value: string; onChange: (val: string) => void; optional?: boolean; placeholder?: string;
}) {
  const [tab, setTab] = useState<'write' | 'preview'>('write');

  return (
    <div className={styles.fieldGroup}>
      <div className={styles.mdFieldHeader}>
        <div className={styles.fieldLabel}>
          {label}
          {optional && <span className={styles.optionalTag}>optional</span>}
        </div>
        <div className={styles.mdTabs}>
          <button type="button" className={`${styles.mdTab} ${tab === 'write' ? styles.mdTabActive : ''}`} onClick={() => setTab('write')}>Write</button>
          <button type="button" className={`${styles.mdTab} ${tab === 'preview' ? styles.mdTabActive : ''}`} onClick={() => setTab('preview')}>Preview</button>
        </div>
      </div>
      {tab === 'write' ? (
        <textarea
          className={`${styles.fieldInput} ${styles.fieldTextarea}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={6}
          placeholder={placeholder}
        />
      ) : (
        <div className={styles.mdPreview}>
          {value.trim() ? <MarkdownContent>{value}</MarkdownContent> : <span className={styles.mdPreviewEmpty}>Nothing to preview yet.</span>}
        </div>
      )}
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
    case 'page.get-involved':
      return (data.title as string) || '';
    case 'homepage.stats': {
      const items = data.items as Array<{ value: string; label: string }> | undefined;
      return items?.slice(0,2).map((i) => `${i.value} ${i.label}`).join(' · ') || '';
    }
    case 'site.settings':
      return [data.discord && 'Discord', data.instagram && 'Instagram', data.email && 'Email']
        .filter(Boolean).join(' · ') || 'No links set';
    case 'footer':
      return (data.copyright as string) || '';
    case 'sponsors': {
      const items = data.items as unknown[] | undefined;
      return items?.length ? `${items.length} sponsor${items.length !== 1 ? 's' : ''}` : '';
    }
    default:
      return '';
  }
}

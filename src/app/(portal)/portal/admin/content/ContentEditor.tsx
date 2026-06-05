'use client';

import { useState } from 'react';
import type { ContentBlock, FieldDef } from '@/lib/content-blocks';
import styles from './ContentEditor.module.css';

type BlockDef = ContentBlock;

interface Props {
  blocks: BlockDef[];
  contentMap: Record<string, Record<string, unknown>>;
  lastEdited: Record<string, { by: string; at: string }>;
}

const CATEGORY_ORDER = ['Global', 'Homepage'];
const COLOR_PREVIEW: Record<string, string> = {
  yellow: '#ffc72c',
  blue: '#275a8f',
  green: '#059669',
  red: '#dc2626',
};

export default function ContentEditor({ blocks, contentMap, lastEdited }: Props) {
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [forms, setForms] = useState<Record<string, Record<string, unknown>>>(() => {
    const init: Record<string, Record<string, unknown>> = {};
    blocks.forEach((b) => { init[b.key] = { ...(contentMap[b.key] || {}) }; });
    return init;
  });
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      if (!res.ok) throw new Error('Failed to save');
      setSaved(key);
      setTimeout(() => setSaved(null), 3000);
    } catch (e) {
      setError(`Failed to save "${key}"`);
    } finally {
      setSaving(null);
    }
  }

  const timeAgo = (date: string) => {
    const diff = (Date.now() - new Date(date).getTime()) / 1000;
    if (diff < 60)   return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  const categories = CATEGORY_ORDER;

  return (
    <div className={styles.layout}>
      {/* Block list */}
      <div className={styles.blockList}>
        {categories.map((cat) => {
          const catBlocks = blocks.filter((b) => b.category === cat);
          if (!catBlocks.length) return null;
          return (
            <div key={cat} className={styles.catGroup}>
              <div className={styles.catLabel}>{cat}</div>
              {catBlocks.map((block) => {
                const isActive = activeKey === block.key;
                const le = lastEdited[block.key];
                const formData = forms[block.key] || {};

                // Quick preview string
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
                        {isActive ? '✕' : '✏️'}
                      </span>
                    </div>

                    {preview && (
                      <div className={styles.blockPreview}>{preview}</div>
                    )}

                    {le && (
                      <div className={styles.lastEdited}>
                        Edited by {le.by} · {timeAgo(le.at)}
                      </div>
                    )}

                    {saved === block.key && (
                      <div className={styles.savedBadge}>✓ Saved</div>
                    )}
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
              </div>
              <button className={styles.closePanel} onClick={() => setActiveKey(null)}>✕</button>
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
              <button className={styles.cancelBtn} onClick={() => setActiveKey(null)}>
                Cancel
              </button>
              <button
                className={styles.saveBtn}
                onClick={() => handleSave(activeBlock.key)}
                disabled={saving === activeBlock.key}
              >
                {saving === activeBlock.key ? (
                  <><span className={styles.savingSpinner} /> Saving…</>
                ) : saved === activeBlock.key ? (
                  '✓ Saved!'
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.editPanelEmpty}>
            <span className={styles.editPanelEmptyIcon}>✏️</span>
            <p>Select a content block on the left to start editing.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Field editor component
// ──────────────────────────────────────────────────────────────────
function FieldEditor({
  field,
  value,
  onChange,
}: {
  field: FieldDef;
  value: unknown;
  onChange: (val: unknown) => void;
}) {
  const label = (
    <div className={styles.fieldLabel}>
      {field.label}
      {('optional' in field && field.optional) && <span className={styles.optionalTag}>optional</span>}
    </div>
  );

  if (field.type === 'toggle') {
    return (
      <label className={styles.toggleField}>
        <div className={styles.toggleWrap}>
          <div className={`${styles.toggle} ${value ? styles.toggleOn : ''}`}>
            <div className={styles.toggleKnob} />
          </div>
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => onChange(e.target.checked)}
            className={styles.toggleInput}
          />
        </div>
        <div>
          {label}
          <div className={styles.fieldHint}>{value ? 'Currently visible to all visitors' : 'Currently hidden'}</div>
        </div>
      </label>
    );
  }

  if (field.type === 'textarea') {
    return (
      <label className={styles.fieldGroup}>
        {label}
        <textarea
          className={`${styles.fieldInput} ${styles.fieldTextarea}`}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          rows={5}
          placeholder={'placeholder' in field ? (field as { placeholder?: string }).placeholder : ''}
        />
      </label>
    );
  }

  if (field.type === 'lines') {
    const lines = Array.isArray(value) ? (value as string[]).join('\n') : (value as string) ?? '';
    return (
      <label className={styles.fieldGroup}>
        {label}
        <textarea
          className={`${styles.fieldInput} ${styles.fieldTextarea}`}
          value={lines}
          onChange={(e) => onChange(e.target.value.split('\n'))}
          rows={4}
          placeholder={'placeholder' in field ? (field as { placeholder?: string }).placeholder : ''}
        />
        <div className={styles.fieldHint}>Each line becomes a separate text row</div>
      </label>
    );
  }

  if (field.type === 'select') {
    const opts = 'options' in field ? (field as { options: string[] }).options : [];
    return (
      <label className={styles.fieldGroup}>
        {label}
        <div className={styles.selectWrap}>
          {opts.map((opt) => (
            <button
              key={opt}
              type="button"
              className={`${styles.selectOpt} ${value === opt ? styles.selectOptActive : ''}`}
              style={value === opt ? { background: (COLOR_PREVIEW[opt] || '#fff') + '22', borderColor: COLOR_PREVIEW[opt] || '#fff', color: COLOR_PREVIEW[opt] || '#fff' } : {}}
              onClick={() => onChange(opt)}
            >
              {COLOR_PREVIEW[opt] && (
                <span className={styles.colorDot} style={{ background: COLOR_PREVIEW[opt] }} />
              )}
              {opt}
            </button>
          ))}
        </div>
      </label>
    );
  }

  if (field.type === 'kvlist') {
    const items = (Array.isArray(value) ? value : []) as Array<{ label?: string; value?: string }>;
    const keyLbl = 'kvKeyLabel' in field ? (field as { kvKeyLabel: string }).kvKeyLabel : 'Key';
    const valLbl = 'kvValueLabel' in field ? (field as { kvValueLabel: string }).kvValueLabel : 'Value';
    return (
      <div className={styles.fieldGroup}>
        {label}
        <div className={styles.kvList}>
          {items.map((item, i) => (
            <div key={i} className={styles.kvRow}>
              <input
                className={styles.fieldInput}
                value={item.value ?? ''}
                onChange={(e) => {
                  const next = [...items];
                  next[i] = { ...next[i], value: e.target.value };
                  onChange(next);
                }}
                placeholder={keyLbl}
              />
              <input
                className={styles.fieldInput}
                value={item.label ?? ''}
                onChange={(e) => {
                  const next = [...items];
                  next[i] = { ...next[i], label: e.target.value };
                  onChange(next);
                }}
                placeholder={valLbl}
              />
              <button
                type="button"
                className={styles.kvRemove}
                onClick={() => onChange(items.filter((_, j) => j !== i))}
              >
                ✕
              </button>
            </div>
          ))}
          <button
            type="button"
            className={styles.kvAdd}
            onClick={() => onChange([...items, { value: '', label: '' }])}
          >
            + Add Item
          </button>
        </div>
      </div>
    );
  }

  // Default: text / url
  return (
    <label className={styles.fieldGroup}>
      {label}
      <input
        type={field.type === 'url' ? 'url' : 'text'}
        className={styles.fieldInput}
        value={(value as string) ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={'placeholder' in field ? (field as { placeholder?: string }).placeholder : ''}
      />
    </label>
  );
}

// ──────────────────────────────────────────────────────────────────
// Preview helpers
// ──────────────────────────────────────────────────────────────────
function getPreview(block: BlockDef, data: Record<string, unknown>): string {
  switch (block.key) {
    case 'announcement':
      if (!data.enabled) return '(hidden)';
      return (data.text as string) || '';
    case 'homepage.hero':
      return (data.title as string) || '';
    case 'homepage.stats': {
      const items = data.items as Array<{ value: string; label: string }> | undefined;
      return items?.map((i) => `${i.value} ${i.label}`).join(' · ') || '';
    }
    case 'homepage.recruitment':
      return (data.title as string) || '';
    case 'site.settings':
      return [(data.discord ? 'Discord' : ''), (data.instagram ? 'Instagram' : '')].filter(Boolean).join(', ') || '';
    default:
      return '';
  }
}

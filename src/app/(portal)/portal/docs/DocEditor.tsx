'use client';

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useEditor, EditorContent, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { Table, TableRow, TableHeader, TableCell } from '@tiptap/extension-table';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import { Blockquote } from '@tiptap/extension-blockquote';
import type { Editor } from '@tiptap/core';
import {
  Bold, Italic, Strikethrough, Code, Link2, List, ListOrdered, ListChecks, Quote, Table2, ImageIcon, Minus, Undo2, Redo2,
  Heading2, Heading3, Info, Lightbulb, TriangleAlert, Type,
} from 'lucide-react';
import { uploadImageToStorage } from '@/lib/imageUpload';
import { showToast } from '@/lib/toast';
import styles from './docEditor.module.css';

export type CalloutKind = 'note' | 'tip' | 'warning';
const CALLOUTS: Record<CalloutKind, { label: string; marker: string }> = {
  note: { label: 'Note', marker: 'NOTE' },
  tip: { label: 'Tip', marker: 'TIP' },
  warning: { label: 'Warning', marker: 'WARNING' },
};

// A callout is a blockquote that carries a kind. In Markdown it is the familiar `> [!TIP]` first line, so docs stay plain text everywhere else.
const Callout = Blockquote.extend({
  addAttributes() {
    return { kind: { default: null, rendered: false } };
  },
  renderHTML({ node, HTMLAttributes }) {
    const kind = node.attrs.kind as CalloutKind | null;
    return ['blockquote', { ...HTMLAttributes, ...(kind ? { 'data-callout': kind } : {}) }, 0];
  },
  parseHTML() {
    return [{ tag: 'blockquote', getAttrs: (el) => ({ kind: (el as HTMLElement).getAttribute('data-callout') }) }];
  },
  parseMarkdown: (token, helpers) => {
    const parseBlock = helpers.parseBlockChildren ?? helpers.parseChildren;
    const children = parseBlock(token.tokens || []);
    // A first line like [!TIP] turns the quote into a callout; the marker itself is dropped.
    const first = (token.tokens?.[0] as { text?: string } | undefined)?.text ?? '';
    const m = /^\[!(NOTE|TIP|WARNING)\]\s*/i.exec(first);
    if (!m) return helpers.createNode('blockquote', undefined, children);
    const kind = m[1].toLowerCase() as CalloutKind;
    const stripped = parseBlock((token.tokens || []).map((t, i) => (i === 0 ? { ...t, text: (t as { text?: string }).text?.replace(/^\[!(NOTE|TIP|WARNING)\]\s*/i, '') ?? '', raw: '' } : t)) as never);
    return helpers.createNode('blockquote', { kind }, stripped.length ? stripped : children);
  },
  renderMarkdown: (node, h) => {
    if (!node.content) return '';
    const kind = (node.attrs?.kind ?? null) as CalloutKind | null;
    const lines: string[] = [];
    if (kind) lines.push(`> [!${CALLOUTS[kind].marker}]`);
    node.content.forEach((child: unknown, index: number) => {
      const text = (h.renderChild ? h.renderChild(child as never, index) : h.renderChildren([child as never])) as string;
      lines.push(text.split('\n').map((line) => (line.trim() === '' ? '>' : `> ${line}`)).join('\n'));
    });
    return lines.join('\n>\n');
  },
});

export interface DocEditorHandle { setMarkdown: (md: string) => void; focus: () => void }

interface SlashItem { id: string; label: string; hint: string; run: (e: Editor) => void }

function ToolButton({ label, active, disabled, onClick, children }: { label: string; active?: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" className={`${styles.tool} ${active ? styles.toolOn : ''}`} aria-label={label} title={label} aria-pressed={active} disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={onClick}>
      {children}
    </button>
  );
}

// The visual editor: click-to-format, with a "/" menu for blocks. The text it saves is Markdown, so every doc stays plain, portable text.
const DocEditor = forwardRef<DocEditorHandle, { value: string; onChange: (markdown: string) => void; disabled?: boolean; placeholder?: string }>(function DocEditor({ value, onChange, disabled, placeholder }, ref) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  // The last text the editor held. Opening a doc (or loading text into it) must not count as an edit, or merely looking at a doc would save a draft.
  const lastMd = useRef<string | null>(null);
  const createdAt = useRef(Date.now());   // from the first render: the startup tidy-up can arrive before onCreate

  const editor = useEditor({
    immediatelyRender: false,
    editable: !disabled,
    extensions: [
      StarterKit.configure({ blockquote: false, heading: { levels: [2, 3] }, link: { openOnClick: false, autolink: true, HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' } } }),
      Callout,
      Image.configure({ HTMLAttributes: { loading: 'lazy' } }),
      Table.configure({ resizable: false }), TableRow, TableHeader, TableCell,
      TaskList, TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder: placeholder ?? 'Write here. Type / for headings, lists, tables, callouts and more.' }),
      Markdown,
    ],
    content: value,
    contentType: 'markdown',
    editorProps: { attributes: { class: styles.prose, 'aria-label': 'Document text', role: 'textbox', 'aria-multiline': 'true' } },
    onCreate: ({ editor: e }) => { lastMd.current = e.getMarkdown(); },
    onUpdate: ({ editor: e }) => {
      const md = e.getMarkdown();
      // The editor tidies the text it is given right after it starts (before anyone has touched it): that is not an edit.
      if (!e.isFocused && Date.now() - createdAt.current < 2000) { lastMd.current = md; return; }
      if (md === lastMd.current) return;
      lastMd.current = md;
      onChangeRef.current(md);
    },
  });

  useEffect(() => { editor?.setEditable(!disabled); }, [editor, disabled]);

  useImperativeHandle(ref, () => ({
    // Loading text in on purpose (someone else's version, a restored one): not an edit, so it does not fire onChange.
    setMarkdown: (md: string) => { editor?.commands.setContent(md, { contentType: 'markdown', emitUpdate: false }); lastMd.current = editor?.getMarkdown() ?? md; },
    focus: () => { editor?.commands.focus('end'); },
  }), [editor]);

  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => (e ? {
      bold: e.isActive('bold'), italic: e.isActive('italic'), strike: e.isActive('strike'), code: e.isActive('code'), link: e.isActive('link'),
      h2: e.isActive('heading', { level: 2 }), h3: e.isActive('heading', { level: 3 }), bullet: e.isActive('bulletList'), ordered: e.isActive('orderedList'), task: e.isActive('taskList'),
      quote: e.isActive('blockquote') && !e.getAttributes('blockquote').kind, callout: (e.getAttributes('blockquote').kind ?? null) as CalloutKind | null,
      table: e.isActive('table'), canUndo: e.can().undo(), canRedo: e.can().redo(),
    } : null),
  });

  const uploadImage = useCallback(async (file: File) => {
    if (!editor) return;
    if (!file.type.startsWith('image/')) { showToast('Choose an image file'); return; }
    setUploading(true);
    try {
      const url = await uploadImageToStorage('doc-attachments', file, { maxDimension: 1600, quality: 0.85 });
      editor.chain().focus().setImage({ src: url, alt: file.name.replace(/\.[^.]+$/, '') }).run();
    } catch { showToast('That image didn’t upload. Try again.'); } finally { setUploading(false); }
  }, [editor]);

  function setLink() {
    if (!editor) return;
    const prev = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('Link address (https://…). Leave empty to remove the link.', prev ?? 'https://');
    if (url === null) return;
    if (url.trim() === '' || url.trim() === 'https://') { editor.chain().focus().extendMarkRange('link').unsetLink().run(); return; }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run();
  }
  const setCallout = (kind: CalloutKind) => {
    if (!editor) return;
    if (state?.callout === kind) { editor.chain().focus().lift('blockquote').run(); return; }
    if (editor.isActive('blockquote')) editor.chain().focus().updateAttributes('blockquote', { kind }).run();
    else editor.chain().focus().wrapIn('blockquote', { kind }).run();
  };

  // ── "/" menu: type / at the start of an empty line ──
  const [slash, setSlash] = useState<{ query: string; x: number; y: number; from: number } | null>(null);
  const [slashIndex, setSlashIndex] = useState(0);
  const items: SlashItem[] = [
    { id: 'h2', label: 'Heading', hint: 'Big section title', run: (e) => e.chain().focus().setHeading({ level: 2 }).run() },
    { id: 'h3', label: 'Subheading', hint: 'Smaller section title', run: (e) => e.chain().focus().setHeading({ level: 3 }).run() },
    { id: 'bullet', label: 'Bulleted list', hint: 'A simple list', run: (e) => e.chain().focus().toggleBulletList().run() },
    { id: 'number', label: 'Numbered list', hint: 'Steps in order', run: (e) => e.chain().focus().toggleOrderedList().run() },
    { id: 'task', label: 'Checklist', hint: 'Tick things off', run: (e) => e.chain().focus().toggleTaskList().run() },
    { id: 'note', label: 'Note box', hint: 'Highlight something to know', run: (e) => e.chain().focus().wrapIn('blockquote', { kind: 'note' }).run() },
    { id: 'tip', label: 'Tip box', hint: 'A helpful shortcut', run: (e) => e.chain().focus().wrapIn('blockquote', { kind: 'tip' }).run() },
    { id: 'warning', label: 'Warning box', hint: 'Something to be careful about', run: (e) => e.chain().focus().wrapIn('blockquote', { kind: 'warning' }).run() },
    { id: 'table', label: 'Table', hint: '3 columns, 3 rows', run: (e) => e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
    { id: 'image', label: 'Image', hint: 'Upload a picture', run: () => fileRef.current?.click() },
    { id: 'code', label: 'Code block', hint: 'Fixed-width text', run: (e) => e.chain().focus().toggleCodeBlock().run() },
    { id: 'divider', label: 'Divider', hint: 'A line between parts', run: (e) => e.chain().focus().setHorizontalRule().run() },
  ];
  const shown = slash ? items.filter((i) => !slash.query || i.label.toLowerCase().includes(slash.query.toLowerCase()) || i.id.includes(slash.query.toLowerCase())) : [];

  useEffect(() => {
    if (!editor) return;
    const check = () => {
      const { selection } = editor.state;
      const $from = selection.$from;
      const text = $from.parent.textContent;
      const m = selection.empty && $from.parent.type.name === 'paragraph' ? /^\/([a-z0-9 ]{0,16})$/i.exec(text) : null;
      if (!m) { setSlash(null); return; }
      const coords = editor.view.coordsAtPos(selection.from);
      const box = editor.view.dom.getBoundingClientRect();
      setSlash({ query: m[1], x: coords.left - box.left, y: coords.bottom - box.top + 6, from: $from.start() });
      setSlashIndex(0);
    };
    editor.on('update', check);
    editor.on('selectionUpdate', check);
    return () => { editor.off('update', check); editor.off('selectionUpdate', check); };
  }, [editor]);

  function runSlash(item: SlashItem) {
    if (!editor || !slash) return;
    editor.chain().focus().deleteRange({ from: slash.from, to: editor.state.selection.from }).run();
    item.run(editor);
    setSlash(null);
  }
  useEffect(() => {
    if (!editor || !slash) return;
    const dom = editor.view.dom;
    const onKey = (e: KeyboardEvent) => {
      if (shown.length === 0) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); setSlashIndex((i) => (i + 1) % shown.length); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setSlashIndex((i) => (i - 1 + shown.length) % shown.length); }
      else if (e.key === 'Enter') { e.preventDefault(); runSlash(shown[slashIndex] ?? shown[0]); }
      else if (e.key === 'Escape') { e.preventDefault(); setSlash(null); }
    };
    dom.addEventListener('keydown', onKey, true);
    return () => dom.removeEventListener('keydown', onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, slash, shown.length, slashIndex]);

  if (!editor || !state) return <div className={styles.shell}><div className={styles.loading}>Loading the editor…</div></div>;

  return (
    <div className={styles.shell}>
      <div className={styles.toolbar} role="toolbar" aria-label="Formatting">
        <ToolButton label="Undo" disabled={!state.canUndo} onClick={() => editor.chain().focus().undo().run()}><Undo2 size={16} aria-hidden="true" /></ToolButton>
        <ToolButton label="Redo" disabled={!state.canRedo} onClick={() => editor.chain().focus().redo().run()}><Redo2 size={16} aria-hidden="true" /></ToolButton>
        <span className={styles.sep} aria-hidden="true" />
        <ToolButton label="Heading" active={state.h2} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 size={16} aria-hidden="true" /></ToolButton>
        <ToolButton label="Subheading" active={state.h3} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}><Heading3 size={16} aria-hidden="true" /></ToolButton>
        <ToolButton label="Normal text" onClick={() => editor.chain().focus().setParagraph().run()}><Type size={16} aria-hidden="true" /></ToolButton>
        <span className={styles.sep} aria-hidden="true" />
        <ToolButton label="Bold" active={state.bold} onClick={() => editor.chain().focus().toggleBold().run()}><Bold size={16} aria-hidden="true" /></ToolButton>
        <ToolButton label="Italic" active={state.italic} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic size={16} aria-hidden="true" /></ToolButton>
        <ToolButton label="Strikethrough" active={state.strike} onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough size={16} aria-hidden="true" /></ToolButton>
        <ToolButton label="Code" active={state.code} onClick={() => editor.chain().focus().toggleCode().run()}><Code size={16} aria-hidden="true" /></ToolButton>
        <ToolButton label="Link" active={state.link} onClick={setLink}><Link2 size={16} aria-hidden="true" /></ToolButton>
        <span className={styles.sep} aria-hidden="true" />
        <ToolButton label="Bulleted list" active={state.bullet} onClick={() => editor.chain().focus().toggleBulletList().run()}><List size={16} aria-hidden="true" /></ToolButton>
        <ToolButton label="Numbered list" active={state.ordered} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered size={16} aria-hidden="true" /></ToolButton>
        <ToolButton label="Checklist" active={state.task} onClick={() => editor.chain().focus().toggleTaskList().run()}><ListChecks size={16} aria-hidden="true" /></ToolButton>
        <span className={styles.sep} aria-hidden="true" />
        <ToolButton label="Quote" active={state.quote} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote size={16} aria-hidden="true" /></ToolButton>
        <ToolButton label="Note box" active={state.callout === 'note'} onClick={() => setCallout('note')}><Info size={16} aria-hidden="true" /></ToolButton>
        <ToolButton label="Tip box" active={state.callout === 'tip'} onClick={() => setCallout('tip')}><Lightbulb size={16} aria-hidden="true" /></ToolButton>
        <ToolButton label="Warning box" active={state.callout === 'warning'} onClick={() => setCallout('warning')}><TriangleAlert size={16} aria-hidden="true" /></ToolButton>
        <span className={styles.sep} aria-hidden="true" />
        <ToolButton label="Insert table" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><Table2 size={16} aria-hidden="true" /></ToolButton>
        <ToolButton label={uploading ? 'Uploading image…' : 'Insert image'} disabled={uploading} onClick={() => fileRef.current?.click()}><ImageIcon size={16} aria-hidden="true" /></ToolButton>
        <ToolButton label="Divider" onClick={() => editor.chain().focus().setHorizontalRule().run()}><Minus size={16} aria-hidden="true" /></ToolButton>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadImage(f); e.target.value = ''; }} />
      </div>

      {state.table && (
        <div className={styles.tableBar} role="toolbar" aria-label="Table">
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().addRowAfter().run()}>Add row</button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().addColumnAfter().run()}>Add column</button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().deleteRow().run()}>Delete row</button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().deleteColumn().run()}>Delete column</button>
          <button type="button" className={styles.danger} onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().deleteTable().run()}>Delete table</button>
        </div>
      )}

      <div className={styles.canvas}>
        <EditorContent editor={editor} />
        {slash && shown.length > 0 && (
          <ul className={styles.slash} style={{ left: Math.max(0, slash.x), top: slash.y }} role="listbox" aria-label="Insert a block">
            {shown.map((it, i) => (
              <li key={it.id} role="option" aria-selected={i === slashIndex}>
                <button type="button" className={`${styles.slashItem} ${i === slashIndex ? styles.slashOn : ''}`} onMouseDown={(e) => e.preventDefault()} onClick={() => runSlash(it)} onMouseEnter={() => setSlashIndex(i)}>
                  <strong>{it.label}</strong><small>{it.hint}</small>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
});

export default DocEditor;

'use client';

import { Select } from '@/components/ui/Field';
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
import { Extension, InputRule, type Editor } from '@tiptap/core';
import MarkdownContent from '@/components/MarkdownContent/MarkdownContent';
import {
  Bold, Italic, Strikethrough, Code, Link2, List, ListOrdered, ListChecks, Quote, Table2, ImageIcon, Minus, Undo2, Redo2,
  Info, Lightbulb, TriangleAlert, FileCode2, Pencil, BookOpen, Plus, ChevronDown,
} from 'lucide-react';
import { uploadImageToStorage } from '@/lib/storage/imageUpload';
import { showToast } from '@/lib/ui/toast';
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

// Typing [text](https://address) turns into a real link the moment the closing bracket is typed, like Markdown editors do.
const MarkdownLinkRule = Extension.create({
  name: 'markdownLinkRule',
  addInputRules() {
    return [
      new InputRule({
        find: /\[([^\]\n]+)\]\(((?:https?:\/\/|mailto:)[^\s)]+)\)$/,
        handler: ({ state, range, match }) => {
          const link = state.schema.marks.link;
          if (!link) return;
          const [, text, href] = match;
          state.tr.replaceWith(range.from, range.to, state.schema.text(text, [link.create({ href })])).removeStoredMark(link);
        },
      }),
    ];
  },
});

export type DocView = 'live' | 'source' | 'reading';

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
const DocEditor = forwardRef<DocEditorHandle, { value: string; onChange: (markdown: string) => void; disabled?: boolean; placeholder?: string; linkTitles?: string[] }>(function DocEditor({ value, onChange, disabled, placeholder, linkTitles = [] }, ref) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [view, setViewState] = useState<DocView>('live');
  const [insertOpen, setInsertOpen] = useState(false);
  const insertRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!insertOpen) return;
    const off = (e: MouseEvent) => { if (!insertRef.current?.contains(e.target as Node)) setInsertOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setInsertOpen(false); };
    document.addEventListener('mousedown', off); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', off); document.removeEventListener('keydown', esc); };
  }, [insertOpen]);
  const [source, setSource] = useState('');
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  // The last text the editor held. Opening a doc (or loading text into it) must not count as an edit, or merely looking at a doc would save a draft.
  const lastMd = useRef<string | null>(null);
  const uploadRef = useRef<(file: File, at?: number) => void>(() => {});
  const createdAt = useRef(Date.now());   // from the first render: the startup tidy-up can arrive before onCreate

  const editor = useEditor({
    immediatelyRender: false,
    editable: !disabled,
    extensions: [
      StarterKit.configure({ blockquote: false, heading: { levels: [1, 2, 3, 4, 5] }, link: { openOnClick: false, autolink: true, HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' } } }),
      Callout,
      MarkdownLinkRule,
      Image.configure({ HTMLAttributes: { loading: 'lazy' } }),
      Table.configure({ resizable: false }), TableRow, TableHeader, TableCell,
      TaskList, TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder: placeholder ?? 'Write here. Type / for headings, lists, tables, callouts and more.' }),
      Markdown,
    ],
    content: value,
    contentType: 'markdown',
    editorProps: {
      attributes: { class: styles.prose, 'aria-label': 'Document text', role: 'textbox', 'aria-multiline': 'true' },
      // Pictures can be pasted or dropped straight into the text, anywhere in the doc.
      handlePaste: (_v, ev) => {
        const f = Array.from(ev.clipboardData?.files ?? []).find((x) => x.type.startsWith('image/'));
        if (!f) return false;
        ev.preventDefault(); uploadRef.current(f); return true;
      },
      handleDrop: (view, ev) => {
        const f = Array.from((ev as DragEvent).dataTransfer?.files ?? []).find((x) => x.type.startsWith('image/'));
        if (!f) return false;
        ev.preventDefault();
        const at = view.posAtCoords({ left: (ev as DragEvent).clientX, top: (ev as DragEvent).clientY })?.pos;
        uploadRef.current(f, at); return true;
      },
    },
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
      heading: ([1, 2, 3, 4, 5].find((l) => e.isActive('heading', { level: l })) ?? 0) as 0 | 1 | 2 | 3 | 4 | 5, bullet: e.isActive('bulletList'), ordered: e.isActive('orderedList'), task: e.isActive('taskList'),
      quote: e.isActive('blockquote') && !e.getAttributes('blockquote').kind, callout: (e.getAttributes('blockquote').kind ?? null) as CalloutKind | null,
      table: e.isActive('table'), canUndo: e.can().undo(), canRedo: e.can().redo(),
    } : null),
  });

  const srcRef = useRef<HTMLTextAreaElement>(null);
  const uploadImage = useCallback(async (file: File, at?: number) => {
    if (!editor) return;
    if (!file.type.startsWith('image/')) { showToast('Choose an image file'); return; }
    setUploading(true);
    try {
      const url = await uploadImageToStorage('doc-attachments', file, { maxDimension: 1600, quality: 0.85 });
      const alt = file.name.replace(/\.[^.]+$/, '').replace(/[[\]]/g, '') || 'image';
      if (view === 'source') {
        // In Source the picture goes in as Markdown at the cursor.
        const ta = srcRef.current; const pos = ta?.selectionStart ?? source.length;
        const next = `${source.slice(0, pos)}![${alt}](${url})${source.slice(pos)}`;
        setSource(next); onChangeRef.current(next);
      } else if (at != null) editor.chain().focus().insertContentAt(at, { type: 'image', attrs: { src: url, alt } }).run();
      else editor.chain().focus().setImage({ src: url, alt }).run();
    } catch { showToast('That image didn’t upload. Try again.'); } finally { setUploading(false); }
  }, [editor, view, source]);
  uploadRef.current = (f, at) => { void uploadImage(f, at); };

  const [linkDraft, setLinkDraft] = useState<string | null>(null);
  function setLink() {
    if (!editor) return;
    setLinkDraft((editor.getAttributes('link').href as string | undefined) ?? 'https://');
  }
  function applyLink() {
    if (!editor || linkDraft === null) return;
    const url = linkDraft.trim();
    if (url === '' || url === 'https://') editor.chain().focus().extendMarkRange('link').unsetLink().run();
    else editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    setLinkDraft(null);
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
    { id: 'h1', label: 'Heading 1', hint: 'The biggest title', run: (e) => e.chain().focus().setHeading({ level: 1 }).run() },
    { id: 'h2', label: 'Heading 2', hint: 'Big section title', run: (e) => e.chain().focus().setHeading({ level: 2 }).run() },
    { id: 'h3', label: 'Heading 3', hint: 'Smaller section title', run: (e) => e.chain().focus().setHeading({ level: 3 }).run() },
    { id: 'h4', label: 'Heading 4', hint: 'A sub-section', run: (e) => e.chain().focus().setHeading({ level: 4 }).run() },
    { id: 'h5', label: 'Heading 5', hint: 'The smallest title', run: (e) => e.chain().focus().setHeading({ level: 5 }).run() },
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

  // ── "[[" menu: type [[ and a few letters to link to another doc by its title ──
  const [wiki, setWiki] = useState<{ query: string; x: number; y: number; from: number } | null>(null);
  const [wikiIndex, setWikiIndex] = useState(0);
  const wikiShown = wiki ? linkTitles.filter((t) => !wiki.query || t.toLowerCase().includes(wiki.query.toLowerCase())).slice(0, 8) : [];
  useEffect(() => {
    if (!editor) return;
    const check = () => {
      const { selection } = editor.state;
      const $from = selection.$from;
      const before = $from.parent.textBetween(0, $from.parentOffset, undefined, '\ufffc');
      const m = selection.empty ? /\[\[([^\]\n]{0,40})$/.exec(before) : null;
      if (!m || linkTitles.length === 0) { setWiki(null); return; }
      const coords = editor.view.coordsAtPos(selection.from);
      const box = editor.view.dom.getBoundingClientRect();
      setWiki({ query: m[1], x: coords.left - box.left, y: coords.bottom - box.top + 6, from: selection.from - m[0].length });
      setWikiIndex(0);
    };
    editor.on('update', check); editor.on('selectionUpdate', check);
    return () => { editor.off('update', check); editor.off('selectionUpdate', check); };
  }, [editor, linkTitles.length]);
  function runWiki(title: string) {
    if (!editor || !wiki) return;
    editor.chain().focus().deleteRange({ from: wiki.from, to: editor.state.selection.from }).insertContent(`[[${title}]] `).run();
    setWiki(null);
  }
  useEffect(() => {
    if (!editor || !wiki) return;
    const dom = editor.view.dom;
    const onKey = (e: KeyboardEvent) => {
      if (wikiShown.length === 0) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); setWikiIndex((i) => (i + 1) % wikiShown.length); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setWikiIndex((i) => (i - 1 + wikiShown.length) % wikiShown.length); }
      else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); runWiki(wikiShown[wikiIndex] ?? wikiShown[0]); }
      else if (e.key === 'Escape') { e.preventDefault(); setWiki(null); }
    };
    dom.addEventListener('keydown', onKey, true);
    return () => dom.removeEventListener('keydown', onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, wiki, wikiShown.length, wikiIndex]);

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

  // Live = the visual editor. Source = the Markdown text itself. Reading = how it looks once published. The text is the same in all three.
  function switchView(next: DocView) {
    if (!editor || next === view) return;
    if (view === 'source') {
      editor.commands.setContent(source, { contentType: 'markdown', emitUpdate: false });
      lastMd.current = editor.getMarkdown();
    }
    if (next === 'source') setSource(editor.getMarkdown());
    if (next === 'reading') setSource(view === 'source' ? source : editor.getMarkdown());
    setViewState(next);
  }

  if (!editor || !state) return <div className={styles.shell}><div className={styles.loading}>Loading the editor…</div></div>;

  return (
    <div className={styles.shell}>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadImage(f); e.target.value = ''; }} />
      <div className={styles.viewBar} role="group" aria-label="Editor view">
        <button type="button" aria-pressed={view === 'live'} className={`${styles.viewTab} ${view === 'live' ? styles.viewTabOn : ''}`} onClick={() => switchView('live')}><Pencil size={14} aria-hidden="true" /> Live</button>
        <button type="button" aria-pressed={view === 'source'} className={`${styles.viewTab} ${view === 'source' ? styles.viewTabOn : ''}`} onClick={() => switchView('source')}><FileCode2 size={14} aria-hidden="true" /> Source</button>
        <button type="button" aria-pressed={view === 'reading'} className={`${styles.viewTab} ${view === 'reading' ? styles.viewTabOn : ''}`} onClick={() => switchView('reading')}><BookOpen size={14} aria-hidden="true" /> Reading</button>
      </div>

      <div className={styles.toolbar} role="toolbar" aria-label="Formatting" hidden={view !== 'live'}>
        <ToolButton label="Undo" disabled={!state.canUndo} onClick={() => editor.chain().focus().undo().run()}><Undo2 size={16} aria-hidden="true" /></ToolButton>
        <ToolButton label="Redo" disabled={!state.canRedo} onClick={() => editor.chain().focus().redo().run()}><Redo2 size={16} aria-hidden="true" /></ToolButton>
        <span className={styles.sep} aria-hidden="true" />
        <Select className={styles.headingSelect} aria-label="Text style" value={state.heading} onChange={(e) => { const l = Number(e.target.value); if (l === 0) editor.chain().focus().setParagraph().run(); else editor.chain().focus().setHeading({ level: l as 1 | 2 | 3 | 4 | 5 }).run(); }}>
          <option value={0}>Normal text</option>
          {[1, 2, 3, 4, 5].map((l) => <option key={l} value={l}>Heading {l}</option>)}
        </Select>
        <span className={styles.sep} aria-hidden="true" />
        <ToolButton label="Bold" active={state.bold} onClick={() => editor.chain().focus().toggleBold().run()}><Bold size={16} aria-hidden="true" /></ToolButton>
        <ToolButton label="Italic" active={state.italic} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic size={16} aria-hidden="true" /></ToolButton>
        <ToolButton label="Link" active={state.link} onClick={setLink}><Link2 size={16} aria-hidden="true" /></ToolButton>
        <span className={styles.sep} aria-hidden="true" />
        <ToolButton label="Bulleted list" active={state.bullet} onClick={() => editor.chain().focus().toggleBulletList().run()}><List size={16} aria-hidden="true" /></ToolButton>
        <ToolButton label="Numbered list" active={state.ordered} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered size={16} aria-hidden="true" /></ToolButton>
        <ToolButton label="Checklist" active={state.task} onClick={() => editor.chain().focus().toggleTaskList().run()}><ListChecks size={16} aria-hidden="true" /></ToolButton>
        <span className={styles.sep} aria-hidden="true" />
        {/* The less common things live in one menu so the bar stays on one line. */}
        <div className={styles.insertWrap} ref={insertRef}>
          <button type="button" className={`${styles.insertBtn} ${insertOpen ? styles.toolOn : ''}`} aria-haspopup="menu" aria-expanded={insertOpen} onMouseDown={(e) => e.preventDefault()} onClick={() => setInsertOpen((v) => !v)}><Plus size={15} aria-hidden="true" /> Insert <ChevronDown size={13} aria-hidden="true" /></button>
          {insertOpen && (
            <div className={styles.insertPop} role="menu" aria-label="Insert">
              {([
                { label: 'Image', icon: <ImageIcon size={15} aria-hidden="true" />, run: () => fileRef.current?.click() },
                { label: 'Table', icon: <Table2 size={15} aria-hidden="true" />, run: () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
                { label: 'Note box', icon: <Info size={15} aria-hidden="true" />, run: () => setCallout('note') },
                { label: 'Tip box', icon: <Lightbulb size={15} aria-hidden="true" />, run: () => setCallout('tip') },
                { label: 'Warning box', icon: <TriangleAlert size={15} aria-hidden="true" />, run: () => setCallout('warning') },
                { label: 'Quote', icon: <Quote size={15} aria-hidden="true" />, run: () => editor.chain().focus().toggleBlockquote().run() },
                { label: 'Code block', icon: <FileCode2 size={15} aria-hidden="true" />, run: () => editor.chain().focus().toggleCodeBlock().run() },
                { label: 'Divider', icon: <Minus size={15} aria-hidden="true" />, run: () => editor.chain().focus().setHorizontalRule().run() },
                { label: 'Strikethrough', icon: <Strikethrough size={15} aria-hidden="true" />, run: () => editor.chain().focus().toggleStrike().run() },
                { label: 'Inline code', icon: <Code size={15} aria-hidden="true" />, run: () => editor.chain().focus().toggleCode().run() },
              ] as { label: string; icon: React.ReactNode; run: () => void }[]).map((it) => (
                <button key={it.label} type="button" role="menuitem" onMouseDown={(e) => e.preventDefault()} onClick={() => { setInsertOpen(false); it.run(); }}>{it.icon} {it.label}</button>
              ))}
            </div>
          )}
        </div>
      </div>

      {view === 'live' && linkDraft !== null && (
        <form className={styles.linkBar} onSubmit={(e) => { e.preventDefault(); applyLink(); }}>
          <Link2 size={15} aria-hidden="true" />
          <input autoFocus type="text" inputMode="url" value={linkDraft} onChange={(e) => setLinkDraft(e.target.value)} aria-label="Link address" placeholder="https://…" onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); setLinkDraft(null); editor.commands.focus(); } }} />
          <button type="submit" className={styles.linkApply}>Apply</button>
          <button type="button" onClick={() => setLinkDraft(null)}>Cancel</button>
        </form>
      )}

      {view === 'live' && state.table && (
        <div className={styles.tableBar} role="toolbar" aria-label="Table">
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().addRowAfter().run()}>Add row</button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().addColumnAfter().run()}>Add column</button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().deleteRow().run()}>Delete row</button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().deleteColumn().run()}>Delete column</button>
          <button type="button" className={styles.danger} onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().deleteTable().run()}>Delete table</button>
        </div>
      )}

      {view === 'source' && (
        <div className={styles.canvas}>
          <div className={styles.sourceTools}>
            <button type="button" disabled={uploading} onClick={() => fileRef.current?.click()}><ImageIcon size={14} aria-hidden="true" /> {uploading ? 'Uploading…' : 'Insert image'}</button>
            <span>Pictures can also be pasted or dropped here.</span>
          </div>
          <textarea ref={srcRef} className={styles.sourceBox} value={source} spellCheck={false} aria-label="Markdown source"
            onPaste={(e) => { const f = Array.from(e.clipboardData.files).find((x) => x.type.startsWith('image/')); if (f) { e.preventDefault(); void uploadImage(f); } }}
            onDrop={(e) => { const f = Array.from(e.dataTransfer.files).find((x) => x.type.startsWith('image/')); if (f) { e.preventDefault(); void uploadImage(f); } }}
            onChange={(e) => { setSource(e.target.value); onChangeRef.current(e.target.value); }} />
        </div>
      )}
      {view === 'reading' && (
        <div className={styles.canvas}><MarkdownContent>{source}</MarkdownContent></div>
      )}
      <div className={styles.canvas} hidden={view !== 'live'}>
        <EditorContent editor={editor} />
        {wiki && wikiShown.length > 0 && (
          <ul className={styles.slash} style={{ left: Math.max(0, wiki.x), top: wiki.y }} role="listbox" aria-label="Link to a doc">
            {wikiShown.map((t, i) => (
              <li key={t} role="option" aria-selected={i === wikiIndex}>
                <button type="button" className={`${styles.slashItem} ${i === wikiIndex ? styles.slashOn : ''}`} onMouseDown={(e) => e.preventDefault()} onClick={() => runWiki(t)} onMouseEnter={() => setWikiIndex(i)}>
                  <strong>{t}</strong><small>Link to this doc</small>
                </button>
              </li>
            ))}
          </ul>
        )}
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

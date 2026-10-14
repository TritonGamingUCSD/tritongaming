import { Mark, type CommandProps } from '@tiptap/core';
import { HIGHLIGHT_KEYS, TEXT_COLOR_KEYS } from './docColors';

// Text colour and highlight for the docs editor. Each is a mark that saves as a small piece of inline HTML (see docColors.ts), so the doc stays Markdown.
declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    docColor: {
      setTextColor: (color: string) => ReturnType;
      unsetTextColor: () => ReturnType;
      setHighlight: (color: string) => ReturnType;
      unsetHighlight: () => ReturnType;
    };
  }
}

export const TextColor = Mark.create({
  name: 'textColor',
  addAttributes() { return { color: { default: null } }; },
  parseHTML() { return [{ tag: 'span[data-c]', getAttrs: (el) => { const c = (el as HTMLElement).getAttribute('data-c'); return c && TEXT_COLOR_KEYS.has(c) ? { color: c } : false; } }]; },
  renderHTML({ mark }) { return ['span', { 'data-c': mark.attrs.color }, 0]; },
  renderMarkdown: (node, h) => `<span data-c="${node.attrs?.color}">${h.renderChildren(node)}</span>`,
  addCommands() {
    return {
      setTextColor: (color: string) => ({ commands }: CommandProps) => (TEXT_COLOR_KEYS.has(color) ? commands.setMark(this.name, { color }) : false),
      unsetTextColor: () => ({ commands }: CommandProps) => commands.unsetMark(this.name),
    } as never;
  },
});

export const DocHighlight = Mark.create({
  name: 'docHighlight',
  addAttributes() { return { color: { default: null } }; },
  parseHTML() { return [{ tag: 'mark[data-h]', getAttrs: (el) => { const c = (el as HTMLElement).getAttribute('data-h'); return c && HIGHLIGHT_KEYS.has(c) ? { color: c } : false; } }]; },
  renderHTML({ mark }) { return ['mark', { 'data-h': mark.attrs.color }, 0]; },
  renderMarkdown: (node, h) => `<mark data-h="${node.attrs?.color}">${h.renderChildren(node)}</mark>`,
  addCommands() {
    return {
      setHighlight: (color: string) => ({ commands }: CommandProps) => (HIGHLIGHT_KEYS.has(color) ? commands.setMark(this.name, { color }) : false),
      unsetHighlight: () => ({ commands }: CommandProps) => commands.unsetMark(this.name),
    } as never;
  },
});

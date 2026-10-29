import { HIGHLIGHT_KEYS, TEXT_COLOR_KEYS } from './docColors';

// Reader side of text colour and highlight (see docColors.ts). Markdown has no colour, so a coloured piece of text arrives as three inline pieces:
// the HTML tag `<span data-c="red">`, the text (which may itself be bold, a link, and so on), and `</span>`. This turns the pieces between a matching pair into
// one element, but only for the fixed palette: any other HTML in a doc stays inert text, exactly as before.
interface Node {
  type: string;
  value?: string;
  children?: Node[];
  data?: Record<string, unknown>;
}
const OPEN = /^<(span|mark)\s+data-(c|h)="([a-z]+)">$/;
const CLOSE = /^<\/(span|mark)>$/;

function wrap(children: Node[]): Node[] {
  const out: Node[] = [];
  const open: { tag: string; attr: string; key: string; at: number }[] = [];
  for (const child of children) {
    if (child.type === 'html' && child.value) {
      const v = child.value.trim();
      const o = OPEN.exec(v);
      if (o && ((o[1] === 'span' && o[2] === 'c' && TEXT_COLOR_KEYS.has(o[3])) || (o[1] === 'mark' && o[2] === 'h' && HIGHLIGHT_KEYS.has(o[3])))) {
        open.push({ tag: o[1], attr: o[2], key: o[3], at: out.length });
        continue;
      }
      const c = CLOSE.exec(v);
      if (c && open.length && open[open.length - 1].tag === c[1]) {
        const top = open.pop()!;
        const inner = out.splice(top.at);
        out.push({ type: 'docColor', children: inner, data: { hName: top.tag, hProperties: top.attr === 'c' ? { dataC: top.key } : { dataH: top.key } } });
        continue;
      }
    }
    if (child.children) child.children = wrap(child.children);
    out.push(child);
  }
  return out;
}

export function remarkDocColors() {
  return (tree: Node) => {
    if (tree.children) tree.children = wrap(tree.children);
  };
}

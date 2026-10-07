// Turns Markdown into a short plain-text excerpt for a <meta description> —
// those can't contain raw Markdown syntax (a literal "**bold**" reads as
// broken formatting in a search snippet) and have an effective length limit
// search engines truncate around anyway. Deliberately simple regex
// stripping rather than a real parser: a meta description only needs to be
// *readable*, not perfectly reconstructed.
export function markdownToDescription(markdown: string, maxLength = 160): string {
  const plain = markdown
    .replace(/```[\s\S]*?```/g, ' ') // fenced code blocks
    .replace(/`([^`]+)`/g, '$1') // inline code
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1') // images -> alt text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // links -> link text
    .replace(/^#{1,6}\s+/gm, '') // headings
    .replace(/^>\s?/gm, '') // blockquotes
    .replace(/^[-*+]\s+/gm, '') // list bullets
    .replace(/^\d+\.\s+/gm, '') // ordered list markers
    .replace(/[*_~]{1,3}/g, '') // bold/italic/strikethrough markers
    .replace(/\s+/g, ' ')
    .trim();

  if (plain.length <= maxLength) return plain;
  return `${plain.slice(0, maxLength - 1).trimEnd()}…`;
}

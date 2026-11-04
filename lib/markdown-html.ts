// WHAT: Turns the draft's Markdown (headings, paragraphs, lists, bold, italics, links) into safe HTML.
// WHY: WordPress's posts API expects HTML. Sent as Markdown, a post shows literal "##" and "**".
// Everything is HTML-escaped first; only https/http links become <a> tags. Backslash escapes from
// lib/credits.ts (e.g. "Bloom \& Vine \(LA\)") come out as the plain characters.

const PLACEHOLDER_START = 0xe000;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Inline formatting for one line or paragraph of text.
export function inlineMarkdownToHtml(text: string): string {
  // 1. Pull out backslash-escaped characters so they can't start a link, bold or italic.
  const escaped: string[] = [];
  let working = text.replace(/\\([\\`*_{}[\]()#+!|<>~.\-&])/g, (_match, char: string) => {
    escaped.push(char);
    return String.fromCharCode(PLACEHOLDER_START + escaped.length - 1);
  });

  // 2. Escape HTML, then add the few tags we allow.
  working = escapeHtml(working);
  working = working.replace(
    /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g,
    (_match, label: string, href: string) => `<a href="${href}">${label}</a>`,
  );
  working = working.replace(/\*\*(?=\S)([^*\n]+?)\*\*/g, "<strong>$1</strong>");
  working = working.replace(/(^|[^*\w])\*(?=\S)([^*\n]+?)\*(?!\*)/g, "$1<em>$2</em>");
  working = working.replace(/(^|[^_\w])_(?=\S)([^_\n]+?)_(?!\w)/g, "$1<em>$2</em>");

  // 3. Put the escaped characters back, HTML-escaped.
  return working.replace(/[-]/g, (char) => {
    const original = escaped[char.charCodeAt(0) - PLACEHOLDER_START];
    return original === undefined ? "" : escapeHtml(original);
  });
}

type Block =
  | { kind: "heading"; level: number; text: string }
  | { kind: "paragraph"; lines: string[] }
  | { kind: "list"; ordered: boolean; items: string[] };

// The post title is the page's h1, so body headings start at h2: "#" and "##" are h2, "###" is h3.
function headingLevel(hashes: number): number {
  if (hashes <= 2) return 2;
  return Math.min(hashes, 6);
}

export function markdownToHtml(markdown: string): string {
  const blocks: Block[] = [];
  let current: Block | null = null;
  const flush = () => {
    if (current) blocks.push(current);
    current = null;
  };

  for (const rawLine of markdown.replace(/\r\n?/g, "\n").split("\n")) {
    const line = rawLine.trim();
    if (!line) {
      flush();
      continue;
    }
    const heading = /^(#{1,6})\s+(.+?)\s*#*$/.exec(line);
    if (heading) {
      flush();
      blocks.push({ kind: "heading", level: headingLevel(heading[1].length), text: heading[2] });
      continue;
    }
    const bullet = /^[-*+]\s+(.+)$/.exec(line);
    const numbered = /^\d+[.)]\s+(.+)$/.exec(line);
    const item = bullet ?? numbered;
    if (item) {
      const ordered = Boolean(numbered && !bullet);
      const open = current as Block | null;
      if (!open || open.kind !== "list" || open.ordered !== ordered) {
        flush();
        current = { kind: "list", ordered, items: [] };
      }
      (current as Extract<Block, { kind: "list" }>).items.push(item[1]);
      continue;
    }
    const open = current as Block | null;
    if (!open || open.kind !== "paragraph") {
      flush();
      current = { kind: "paragraph", lines: [] };
    }
    (current as Extract<Block, { kind: "paragraph" }>).lines.push(line);
  }
  flush();

  return blocks.map((block) => {
    if (block.kind === "heading") return `<h${block.level}>${inlineMarkdownToHtml(block.text)}</h${block.level}>`;
    if (block.kind === "list") {
      const tag = block.ordered ? "ol" : "ul";
      return `<${tag}>\n${block.items.map((text) => `<li>${inlineMarkdownToHtml(text)}</li>`).join("\n")}\n</${tag}>`;
    }
    return `<p>${inlineMarkdownToHtml(block.lines.join(" "))}</p>`;
  }).join("\n\n");
}

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildBlogCredits, type WeddingVendor } from "../lib/credits";
import { inlineMarkdownToHtml, markdownToHtml } from "../lib/markdown-html";

describe("markdownToHtml", () => {
  it("turns headings, paragraphs and lists into HTML, with body headings starting at h2", () => {
    const html = markdownToHtml([
      "# A Desert Wedding",
      "",
      "First line of the story",
      "continues here.",
      "",
      "### The details",
      "- Pink florals",
      "- A neon sign",
      "",
      "1. Ceremony",
      "2. Reception",
    ].join("\n"));
    assert.equal(html, [
      "<h2>A Desert Wedding</h2>",
      "<p>First line of the story continues here.</p>",
      "<h3>The details</h3>",
      "<ul>\n<li>Pink florals</li>\n<li>A neon sign</li>\n</ul>",
      "<ol>\n<li>Ceremony</li>\n<li>Reception</li>\n</ol>",
    ].join("\n\n"));
  });

  it("formats bold, italics and https links", () => {
    assert.equal(
      inlineMarkdownToHtml("**Bold** and *soft* and _quiet_ at [The Orchard](https://orchard.example.com/?a=1&b=2)"),
      '<strong>Bold</strong> and <em>soft</em> and <em>quiet</em> at <a href="https://orchard.example.com/?a=1&amp;b=2">The Orchard</a>',
    );
  });

  it("escapes HTML and never links non-web addresses", () => {
    assert.equal(
      inlineMarkdownToHtml('<script>alert("x")</script> [click](javascript:alert(1))'),
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; [click](javascript:alert(1))",
    );
  });

  it("keeps snake_case words and lone asterisks as text", () => {
    assert.equal(inlineMarkdownToHtml("venue_name and 5 * 3"), "venue_name and 5 * 3");
  });

  it("renders vendor credits with backslash-escaped names as clean HTML", () => {
    const vendors: WeddingVendor[] = [
      {
        vendor: { id: "1", businessName: "Bloom & Vine (LA)", role: "florist", roleLabel: null, website: "https://bloom.example.com", instagramHandle: null },
        sortOrder: 0,
        isCollaborator: false,
        sharedAt: null,
      },
      {
        vendor: { id: "2", businessName: "*Star* Rentals", role: "rentals", roleLabel: null, website: null, instagramHandle: null },
        sortOrder: 1,
        isCollaborator: false,
        sharedAt: null,
      },
    ];
    const html = markdownToHtml(buildBlogCredits(vendors));
    assert.match(html, /^<h2>[^<]+<\/h2>/);
    assert.match(html, /<li><strong>Florist:<\/strong> <a href="https:\/\/bloom\.example\.com">Bloom &amp; Vine \(LA\)<\/a><\/li>/);
    assert.match(html, /<li><strong>Rentals:<\/strong> \*Star\* Rentals<\/li>/);
    assert.doesNotMatch(html, /\\/);
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { publicPostUrl, resolvePostLink } from "../lib/post-links";

const editor = "https://llenavida.example.com/wp-admin/post.php?post=123&action=edit";

describe("post links", () => {
  it("turns the editor link into the public ?p= link", () => {
    assert.equal(publicPostUrl(editor), "https://llenavida.example.com/?p=123");
    assert.equal(publicPostUrl("https://example.com/blog/wp-admin/post.php?post=9&action=edit"), "https://example.com/blog/?p=9");
  });

  it("rejects anything that isn't an https WordPress editor link", () => {
    assert.equal(publicPostUrl("http://example.com/wp-admin/post.php?post=1"), null);
    assert.equal(publicPostUrl("https://example.com/post.php?post=1"), null);
    assert.equal(publicPostUrl("https://example.com/wp-admin/post.php?post=abc"), null);
    assert.equal(publicPostUrl("not a url"), null);
  });

  it("never gives vendors the editor link", () => {
    assert.deepEqual(resolvePostLink({ wordpressUrl: editor, isPublished: true, postUrl: null }), { url: "https://llenavida.example.com/?p=123", warning: "" });
    const draft = resolvePostLink({ wordpressUrl: editor, isPublished: false, postUrl: null });
    assert.equal(draft.url, "https://llenavida.example.com/?p=123");
    assert.match(draft.warning, /draft/);
    assert.equal(resolvePostLink({ wordpressUrl: editor, isPublished: true, postUrl: "https://llenavida.example.com/real-post" }).url, "https://llenavida.example.com/real-post");
  });
});

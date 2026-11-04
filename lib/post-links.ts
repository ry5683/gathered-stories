// WHAT: Picks the link vendors receive in share messages.
// WHY: The app stores the WordPress *editor* link (wp-admin/post.php?post=123&action=edit) for the
// photographer. Vendors can't open that: it asks them to log in. They get the public ?p=123 link,
// which WordPress redirects to the post's real address once it's published.

export type PostLinkInfo = { wordpressUrl: string | null; isPublished: boolean; postUrl: string | null };

// "https://site.com/blog/wp-admin/post.php?post=123&action=edit" -> "https://site.com/blog/?p=123".
export function publicPostUrl(editorUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(editorUrl);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  const marker = url.pathname.indexOf("/wp-admin/");
  const postId = url.searchParams.get("post");
  if (marker === -1 || !postId || !/^[1-9]\d{0,18}$/.test(postId)) return null;
  const base = url.pathname.slice(0, marker + 1);
  return `${url.origin}${base}?p=${postId}`;
}

// A pasted live link wins, then the WordPress post's public link.
export function resolvePostLink(link: PostLinkInfo): { url: string | null; warning: string } {
  if (link.postUrl) return { url: link.postUrl, warning: "" };
  const publicUrl = link.wordpressUrl ? publicPostUrl(link.wordpressUrl) : null;
  if (publicUrl && link.isPublished) return { url: publicUrl, warning: "" };
  if (publicUrl) return { url: publicUrl, warning: "The post is still a WordPress draft. This link only works for vendors once it's published." };
  return { url: null, warning: "" };
}

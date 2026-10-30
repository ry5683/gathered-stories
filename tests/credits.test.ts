import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildBlogCredits,
  buildCaptionCredits,
  buildShareMessage,
  captionWithCredits,
  escapeMarkdown,
  isHttpsUrl,
  isValidHandle,
  mailtoLink,
  normalizeHandle,
  suggestCollaborators,
  vendorRolesForPrompt,
  type Vendor,
  type VendorRole,
  type WeddingVendor,
} from "../lib/credits";

let n = 0;
function link(role: VendorRole, name: string, extra: Partial<Vendor> = {}, sortOrder = 0): WeddingVendor {
  n += 1;
  return {
    vendor: { id: `v${n}`, businessName: name, role, roleLabel: null, website: null, instagramHandle: null, ...extra },
    sortOrder,
    isCollaborator: false,
    sharedAt: null,
  };
}

describe("blog credits", () => {
  it("lists vendors in role order, venue first, with links when there's a website", () => {
    const credits = buildBlogCredits([
      link("florist", "Bloom & Vine", { website: "https://bloom.example.com" }),
      link("venue", "The Orchard"),
      link("planner", "Ever After Events"),
    ]);
    assert.equal(
      credits,
      [
        "## Vendor credits",
        "",
        "- **Venue:** The Orchard",
        "- **Planner:** Ever After Events",
        "- **Florist:** [Bloom & Vine](https://bloom.example.com)",
      ].join("\n"),
    );
  });

  it("uses a custom role label and escapes Markdown in names", () => {
    const credits = buildBlogCredits([link("florist", "Petals [and] *Pots*", { roleLabel: "Florals and installs" })]);
    assert.match(credits, /- \*\*Florals and installs:\*\* Petals \\\[and\\\] \\\*Pots\\\*/);
    assert.equal(escapeMarkdown("a_b"), "a\\_b");
  });

  it("is empty when there are no vendors", () => {
    assert.equal(buildBlogCredits([]), "");
  });
});

describe("caption credits", () => {
  it("tags handles and falls back to the business name", () => {
    const list = [link("florist", "Bloom", { instagramHandle: "bloomandvine" }), link("cake", "Sweet Things")];
    assert.equal(buildCaptionCredits(list), "Florist: @bloomandvine\nCake and desserts: Sweet Things");
    assert.equal(
      captionWithCredits("What a day.", list, "#orchardwedding"),
      "What a day.\n\nFlorist: @bloomandvine\nCake and desserts: Sweet Things\n\n#orchardwedding",
    );
  });
});

describe("collaborator suggestions", () => {
  it("picks at most 5 vendors with handles, priority roles first", () => {
    const list = [
      link("music", "Band", { instagramHandle: "band" }),
      link("cake", "Cake", { instagramHandle: "cake" }),
      link("florist", "Flowers", { instagramHandle: "flowers" }),
      link("venue", "Venue", { instagramHandle: "venue" }),
      link("planner", "Planner"),
      link("hair_makeup", "Glam", { instagramHandle: "glam" }),
      link("videographer", "Film", { instagramHandle: "film" }),
      link("attire", "Dress", { instagramHandle: "dress" }),
    ];
    const picks = suggestCollaborators(list).map((id) => list.find((item) => item.vendor.id === id)!.vendor.businessName);
    assert.deepEqual(picks, ["Venue", "Flowers", "Film", "Glam", "Cake"]);
  });
});

describe("prompt roles", () => {
  it("sends roles only, never names, and skips venue and other", () => {
    const roles = vendorRolesForPrompt([link("venue", "The Orchard"), link("florist", "Bloom"), link("florist", "Second Bloom"), link("other", "X")]);
    assert.deepEqual(roles, ["florist"]);
  });
});

describe("share message", () => {
  it("fills the template from saved facts", () => {
    const message = buildShareMessage({
      vendor: link("florist", "Bloom & Vine").vendor,
      venue: "The Orchard",
      weddingDate: "June 7, 2026",
      postUrl: "https://studio.example.com/orchard-wedding",
      photographerName: "Maya Lin",
      photographerInstagram: "mayalinphoto",
    });
    assert.equal(message.subject, "You're featured: The Orchard wedding");
    assert.match(message.body, /^Hi Bloom & Vine,/);
    assert.match(message.body, /The Orchard wedding on June 7, 2026 is on the blog, and you're credited as florist\./);
    assert.match(message.body, /https:\/\/studio\.example\.com\/orchard-wedding/);
    assert.equal(message.creditLine, "Photos by Maya Lin @mayalinphoto");
    const mail = mailtoLink(message);
    assert.ok(mail.startsWith("mailto:?subject=You're%20featured"));
    assert.ok(!mail.includes("to="));
  });

  it("asks for the link when there isn't one yet", () => {
    const message = buildShareMessage({
      vendor: link("venue", "The Orchard").vendor, venue: "The Orchard", weddingDate: "",
      postUrl: null, photographerName: null, photographerInstagram: null,
    });
    assert.match(message.body, /\(Add the post link before sending\.\)/);
    assert.equal(message.creditLine, "Photos");
  });
});

describe("input checks", () => {
  it("normalizes and validates handles and websites", () => {
    assert.equal(normalizeHandle(" @@bloom.vine "), "bloom.vine");
    assert.equal(isValidHandle("bloom.vine_1"), true);
    assert.equal(isValidHandle("has space"), false);
    assert.equal(isValidHandle("a".repeat(31)), false);
    assert.equal(isHttpsUrl("https://bloom.example.com"), true);
    assert.equal(isHttpsUrl("http://bloom.example.com"), false);
    assert.equal(isHttpsUrl("javascript:alert(1)"), false);
  });
});

describe("ShowIt pack credits", async () => {
  const { makeShowItPack } = await import("../lib/showit");
  const draft = {
    title: "T", slug: "t", metaDescription: "m", body: "## Intro\n\nBody", caption: "A golden evening.", hashtags: "#orchardwedding",
    reelsScript: "r", photoFileNames: ["a"], photoCaptions: ["c"], altTexts: ["alt"], extraCaptions: [], extraFormats: { pinterest: "", emailSneakPeek: "" },
  } as unknown as Parameters<typeof makeShowItPack>[0];

  it("adds credits, the credited caption, and collaborators only when vendors exist", () => {
    const venue = link("venue", "The Orchard", { instagramHandle: "theorchard" });
    venue.isCollaborator = true;
    const florist = link("florist", "Bloom", { instagramHandle: "bloom" });
    const pack = makeShowItPack(draft, [{ id: "p", description: "d" }], [florist, venue]);
    assert.match(pack.vendorCredits, /^## Vendor credits/);
    assert.equal(pack.captionWithCredits, "A golden evening.\n\nVenue: @theorchard\nFlorist: @bloom\n\n#orchardwedding");
    assert.deepEqual(pack.collaborators, ["@theorchard"]);
    const empty = makeShowItPack(draft, [{ id: "p", description: "d" }]);
    assert.equal(empty.vendorCredits, "");
    assert.equal(empty.captionWithCredits, "");
    assert.deepEqual(empty.collaborators, []);
  });
});

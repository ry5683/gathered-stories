import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { request as httpsRequest } from "node:https";

type WordPressCredentials = { username: string; applicationPassword: string };
type ResolvedSite = { url: URL; hostname: string; address: string; family: 4 | 6 };

function isPublicAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const parts = address.split(".").map(Number);
    const first = parts[0];
    const second = parts[1];
    return !(
      first === 0 || first === 10 || first === 127 || first >= 224 ||
      (first === 100 && second >= 64 && second <= 127) ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 0) ||
      (first === 192 && second === 88) ||
      (first === 192 && second === 168) ||
      (first === 198 && (second === 18 || second === 19 || second === 51)) ||
      (first === 203 && second === 0) ||
      first >= 240
    );
  }
  if (isIP(address) === 6) {
    const normalized = address.toLowerCase();
    if (normalized.startsWith("::ffff:")) return false;
    const [left = "", right = ""] = normalized.split("::");
    const leftSegments = left ? left.split(":") : [];
    const rightSegments = right ? right.split(":") : [];
    const missingSegments = 8 - leftSegments.length - rightSegments.length;
    const segments = [...leftSegments, ...Array.from({ length: Math.max(missingSegments, 0) }, () => "0"), ...rightSegments];
    const firstSegment = Number.parseInt(segments[0] || "0", 16);
    const secondSegment = Number.parseInt(segments[1] || "0", 16);
    return firstSegment >= 0x2000 && firstSegment <= 0x3fff &&
      !(firstSegment === 0x2001 && secondSegment < 0x0200) &&
      !(firstSegment === 0x2001 && secondSegment === 0x0db8) &&
      firstSegment !== 0x2002 &&
      firstSegment !== 0x3fff;
  }
  return false;
}

export async function resolveWordPressSite(siteAddress: string): Promise<ResolvedSite> {
  let url: URL;
  try {
    url = new URL(siteAddress);
  } catch {
    throw new Error("Enter a valid WordPress site URL.");
  }
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (
    url.protocol !== "https:" || url.username || url.password || url.port ||
    url.search || url.hash || !hostname ||
    hostname === "localhost" || hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") || hostname.endsWith(".internal")
  ) {
    throw new Error("WordPress must use a public HTTPS site URL without credentials or a custom port.");
  }
  url.pathname = `${url.pathname.replace(/\/+$/, "")}/`;
  const addresses = isIP(hostname)
    ? [{ address: hostname, family: isIP(hostname) as 4 | 6 }]
    : await lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) {
    throw new Error("The WordPress site must resolve only to public network addresses.");
  }
  const selected = addresses[0];
  return { url, hostname, address: selected.address, family: selected.family as 4 | 6 };
}

function encryptionKey(): Buffer {
  const encoded = process.env.WORDPRESS_ENCRYPTION_KEY;
  if (!encoded) throw new Error("WordPress encryption is not configured on the server.");
  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32) throw new Error("WordPress encryption key must be 32 bytes encoded as base64.");
  return key;
}

export function encryptWordPressCredentials(credentials: WordPressCredentials): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(credentials), "utf8"),
    cipher.final(),
  ]);
  return JSON.stringify({
    version: 1,
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    data: ciphertext.toString("base64"),
  });
}

export function decryptWordPressCredentials(ciphertext: string): WordPressCredentials {
  try {
    const envelope: unknown = JSON.parse(ciphertext);
    if (
      !envelope || typeof envelope !== "object" ||
      !("version" in envelope) || envelope.version !== 1 ||
      !("iv" in envelope) || typeof envelope.iv !== "string" ||
      !("tag" in envelope) || typeof envelope.tag !== "string" ||
      !("data" in envelope) || typeof envelope.data !== "string"
    ) throw new Error("Invalid encrypted credential envelope.");
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(envelope.iv, "base64"));
    decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(envelope.data, "base64")),
      decipher.final(),
    ]).toString("utf8");
    const credentials: unknown = JSON.parse(plaintext);
    if (
      !credentials || typeof credentials !== "object" ||
      !("username" in credentials) || typeof credentials.username !== "string" ||
      !("applicationPassword" in credentials) || typeof credentials.applicationPassword !== "string"
    ) throw new Error("Invalid decrypted credentials.");
    return credentials as WordPressCredentials;
  } catch {
    throw new Error("Stored WordPress credentials could not be decrypted.");
  }
}

export async function wordpressRequest(
  siteAddress: string,
  credentials: WordPressCredentials,
  path: string,
  method: "GET" | "POST",
  payload?: unknown,
): Promise<unknown> {
  const site = await resolveWordPressSite(siteAddress);
  const body = payload === undefined ? undefined : JSON.stringify(payload);
  const authorization = Buffer.from(`${credentials.username}:${credentials.applicationPassword}`).toString("base64");
  const requestPath = `${site.url.pathname.replace(/\/$/, "")}${path}`;
  return new Promise((resolve, reject) => {
    const request = httpsRequest({
      hostname: site.address,
      family: site.family,
      ...(isIP(site.hostname) ? {} : { servername: site.hostname }),
      method,
      path: requestPath,
      agent: false,
      headers: {
        Authorization: `Basic ${authorization}`,
        Host: site.url.host,
        Accept: "application/json",
        ...(body === undefined ? {} : {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        }),
      },
    }, (response) => {
      const chunks: Buffer[] = [];
      let totalBytes = 0;
      response.on("data", (chunk: Buffer) => {
        totalBytes += chunk.length;
        if (totalBytes > 1_000_000) {
          request.destroy(new Error("WordPress response exceeded the size limit."));
          return;
        }
        chunks.push(chunk);
      });
      response.on("end", () => {
        if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error("WordPress rejected the request. Check the site URL and application password."));
          return;
        }
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown);
        } catch {
          reject(new Error("WordPress returned an invalid response."));
        }
      });
    });
    request.setTimeout(10_000, () => request.destroy(new Error("WordPress request timed out.")));
    request.on("error", (error) => reject(error));
    if (body !== undefined) request.write(body);
    request.end();
  });
}

export function wordpressBaseAddress(siteAddress: string): Promise<string> {
  return resolveWordPressSite(siteAddress).then(({ url }) => url.toString().replace(/\/$/, ""));
}

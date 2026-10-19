// Echo: promotes the newest article and a featured service.
// Auto-posts to Bluesky (free API). Writes ready-to-paste posts for X, Instagram, TikTok, LinkedIn,
// Threads, Pinterest and Reddit to marketing/queue/ and emails them to the owner.
import { join } from "node:path";
import { writeFile, mkdir } from "node:fs/promises";
import { PRODUCTS, money } from "../public/js/catalog.js";
import { claude, extractJSON, log, readJSON, email, env, esc, PUBLIC, ROOT, SITE, today } from "./lib.mjs";

const posts = await readJSON(join(PUBLIC, "blog", "posts.json"), []);
const latest = posts[0];
const featured = PRODUCTS[new Date().getUTCDate() % PRODUCTS.length]; // rotate a featured service daily

const out = extractJSON(await claude({
  maxTokens: 3000,
  system: "You are Echo, social media manager for Nightshift Studio (an AI-powered done-for-you studio for brand, marketing, e-commerce and career services). You write native, scroll-stopping posts for each platform. Never invent customer results, testimonials or statistics. No hashtag spam.",
  prompt: `Today's content:
${latest ? `- New article: "${latest.title}" — ${latest.excerpt} — ${SITE}/blog/${latest.slug}.html` : "- (no article today)"}
- Featured service: ${featured.name}, ${money(featured.price)} (was ${money(featured.compareAt)}), delivered in ${featured.delivery} — ${featured.short} — ${SITE}/#/product/${featured.id}
- Launch code NIGHTOWL = 10% off.

Return only JSON with these keys:
"bluesky": max 260 characters including the article link (or the product link if no article),
"x": max 270 characters,
"threads": max 450 characters,
"linkedin": 120–200 words, professional, value-first,
"instagram": caption with line breaks + up to 8 relevant hashtags, plus "[Visual: ...]" describing the image/carousel,
"tiktok": a 30-second video script with HOOK / BODY / CTA and on-screen text,
"pinterest": pin title + description,
"reddit": a genuinely helpful post for a relevant subreddit (name it) that teaches the article's key idea WITHOUT links or self-promotion (Reddit bans promo).`,
}));

// ---- Auto-post to Bluesky ----
async function postToBluesky(text) {
  if (!env.BLUESKY_HANDLE || !env.BLUESKY_APP_PASSWORD) return false;
  const pds = "https://bsky.social/xrpc";
  const s = await (await fetch(`${pds}/com.atproto.server.createSession`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ identifier: env.BLUESKY_HANDLE, password: env.BLUESKY_APP_PASSWORD }),
  })).json();
  if (!s.accessJwt) throw new Error("Bluesky login failed");
  // Turn URLs into clickable links (facets use UTF-8 byte offsets).
  const enc = new TextEncoder(); const facets = [];
  for (const m of text.matchAll(/https?:\/\/[^\s]+/g)) {
    const byteStart = enc.encode(text.slice(0, m.index)).length;
    facets.push({ index: { byteStart, byteEnd: byteStart + enc.encode(m[0]).length }, features: [{ $type: "app.bsky.richtext.facet#link", uri: m[0] }] });
  }
  const r = await fetch(`${pds}/com.atproto.repo.createRecord`, {
    method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${s.accessJwt}` },
    body: JSON.stringify({ repo: s.did, collection: "app.bsky.feed.post", record: { $type: "app.bsky.feed.post", text, facets, createdAt: new Date().toISOString() } }),
  });
  if (!r.ok) throw new Error(`Bluesky post failed: ${r.status}`);
  return true;
}

let posted = false;
try { posted = await postToBluesky(out.bluesky); } catch (e) { console.error(e.message); }

// ---- Queue for the other platforms ----
const md = Object.entries(out).map(([k, v]) => `## ${k}\n\n${v}\n`).join("\n");
await mkdir(join(ROOT, "marketing", "queue"), { recursive: true });
await writeFile(join(ROOT, "marketing", "queue", `${today()}.md`), `# Social posts for ${today()}\n\n${md}`);
if (env.OWNER_EMAIL) {
  await email({
    to: env.OWNER_EMAIL,
    subject: `📣 Echo: today's ready-to-post social content (${today()})`,
    html: `<div style="font-family:Arial,sans-serif;max-width:680px">${Object.entries(out).map(([k, v]) => `<h2>${esc(k)}</h2><pre style="white-space:pre-wrap;font-family:inherit;background:#f5f5f7;padding:12px;border-radius:8px">${esc(v)}</pre>`).join("")}</div>`,
  }).catch((e) => console.error(e.message));
}
await log("echo", posted ? `Posted to Bluesky and queued posts for 7 more platforms` : `Wrote today's posts for 8 platforms`);

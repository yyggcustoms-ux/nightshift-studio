// Scout picks a topic people are searching for; Quill writes and publishes an SEO article about it.
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { PRODUCTS, money } from "../public/js/catalog.js";
import { ask, sections, log, markdown, readJSON, writeJSON, esc, PUBLIC, SITE, today } from "./lib.mjs";

const postsPath = join(PUBLIC, "blog", "posts.json");
const posts = await readJSON(postsPath, []);
const catalog = PRODUCTS.map((p) => `${p.id}: ${p.name} (${money(p.price)}) — ${p.short}`).join("\n");

// ---- Scout: choose today's topic ----
const picked = sections(await ask({
  maxTokens: 400,
  system: "You are Scout, an SEO and trend researcher for Nightshift Studio, which sells done-for-you brand, marketing, e-commerce and career services to small-business owners, side hustlers and job seekers.",
  prompt: `Our services:\n${catalog}\n\nAlready published (don't repeat or closely overlap):\n${posts.map((p) => "- " + p.title).join("\n") || "(none yet)"}\n\nToday is ${today()}. Pick ONE high-intent, long-tail topic that our customers are actively Googling, timely for this season, which naturally leads to one of our services. Rotate between careers, branding, social media, e-commerce, email marketing, and starting a business.
Reply in exactly this format, nothing else:
=== topic ===
(the topic)
=== keyword ===
(primary search phrase)
=== angle ===
(why this is useful now)
=== product_id ===
(one id from the list)`,
}));
const scout = { topic: picked.topic || "How to describe your small business in one sentence", keyword: picked.keyword || picked.topic || "small business tagline ideas", angle: picked.angle || "", product_id: (picked.product_id || "").trim() };
await log("scout", `Picked today's topic: "${scout.keyword}"`);

// ---- Quill: write the article ----
const product = PRODUCTS.find((p) => scout.product_id.includes(p.id)) || PRODUCTS[new Date().getUTCDate() % PRODUCTS.length];
const QUILL = "You are Quill, Nightshift Studio's senior content writer. You write genuinely useful, specific, skimmable articles that rank on Google and earn trust. No fluff, no invented statistics, studies or quotes.";
const meta = sections(await ask({
  maxTokens: 300, system: QUILL,
  prompt: `Article topic: ${scout.topic}\nPrimary keyword: ${scout.keyword}\nReply in exactly this format, nothing else:\n=== title ===\n(a compelling title containing the keyword, under 65 characters)\n=== excerpt ===\n(one-sentence meta description under 155 characters)\n=== tag ===\n(one-word category)`,
}));
const title = (meta.title || scout.topic).replace(/^["#\s]+|["\s]+$/g, "");
const body = await ask({
  maxTokens: 3500, system: QUILL,
  prompt: `Write a 1,200–1,600 word article titled "${title}".
Primary keyword: ${scout.keyword}
Angle: ${scout.angle}
Use the keyword in the first paragraph and one H2. Use H2/H3 headings, short paragraphs, bulleted steps and a concrete example or template the reader can copy.
Near the end, include one natural, non-pushy paragraph mentioning that Nightshift Studio's ${product.name} (${money(product.price)}, delivered in ${product.delivery}) can do this for them, linking to [${product.name}](/#/product/${product.id}).
Output only the article body in Markdown. Do not include the title as a heading.`,
});
const article = { title, excerpt: (meta.excerpt || scout.angle || title).slice(0, 160), tag: (meta.tag || "Guide").split(/\s/)[0], markdown: body.replace(/^#\s.*\n/, "") };

const slug = (article.slug || article.title).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70);
const url = `${SITE}/blog/${slug}.html`;
const page = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(article.title)} | Nightshift Studio</title>
<meta name="description" content="${esc(article.excerpt)}">
<link rel="canonical" href="${url}">
<meta property="og:title" content="${esc(article.title)}"><meta property="og:description" content="${esc(article.excerpt)}"><meta property="og:type" content="article"><meta property="og:url" content="${url}">
<link href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@700;800;900&family=Caveat:wght@500;700&family=IBM+Plex+Mono:wght@500;600&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;1,6..72,400&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/css/styles.css">
<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@type": "Article", headline: article.title, description: article.excerpt, datePublished: today(), author: { "@type": "Organization", name: "Nightshift Studio" }, publisher: { "@type": "Organization", name: "Nightshift Studio" } })}</script>
</head><body>
<header class="nav"><a href="/#/" class="logo">Night<span class="accent">shift</span></a><nav class="links" style="display:flex"><a href="/#/shop">Work orders</a><a href="/#/blog">Night notes</a></nav><div class="nav-actions"><a href="/#/cart" class="cart-btn">Order</a></div></header>
<main class="wrap"><article class="prose">
<p class="label">${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} · ${esc(article.tag || "Guide")} · Written by Quill, our AI writer, and edited by the Nightshift team</p>
<h1>${esc(article.title)}</h1>
${markdown(article.markdown)}
<div class="letter paper" style="margin-top:50px">
  <p class="label">Rather not do it yourself?</p><h3 style="color:var(--ink);font-size:2rem;margin:10px 0">${esc(product.name)}</h3>
  <p>${esc(product.short)} Ready in ${product.delivery}.</p>
  <p style="margin-top:20px"><a class="btn btn-ink" href="/#/product/${product.id}">Order it tonight · ${money(product.price)}</a></p>
</div>
</article></main>
<footer class="footer"><p>© ${new Date().getFullYear()} Nightshift Studio · <a href="/#/">Home</a> · <a href="/#/shop">Services</a> · <a href="/#/blog">More articles</a></p></footer>
</body></html>
`;
await writeFile(join(PUBLIC, "blog", `${slug}.html`), page);
posts.unshift({ slug, title: article.title, excerpt: article.excerpt, tag: article.tag, date: new Date().toISOString(), product: product.id });
await writeJSON(postsPath, posts);
await log("quill", `Published "${article.title}"`);

// Scout picks a topic people are searching for; Quill writes and publishes an SEO article about it.
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { PRODUCTS, money } from "../public/js/catalog.js";
import { claude, extractJSON, log, markdown, readJSON, writeJSON, esc, PUBLIC, SITE, today } from "./lib.mjs";

const postsPath = join(PUBLIC, "blog", "posts.json");
const posts = await readJSON(postsPath, []);
const catalog = PRODUCTS.map((p) => `${p.id}: ${p.name} (${money(p.price)}) — ${p.short}`).join("\n");

// ---- Scout: choose today's topic ----
const scout = extractJSON(await claude({
  maxTokens: 800,
  system: "You are Scout, an SEO and trend researcher for Nightshift Studio, which sells done-for-you brand, marketing, e-commerce and career services to small-business owners, side hustlers and job seekers.",
  prompt: `Our services:\n${catalog}\n\nAlready published (don't repeat or closely overlap):\n${posts.map((p) => "- " + p.title).join("\n") || "(none yet)"}\n\nToday is ${today()}. Pick ONE high-intent, long-tail topic that our customers are actively Googling, timely for this season, which naturally leads to one of our services. Rotate between careers, branding, social media, e-commerce, email marketing, and starting a business.\nReturn only JSON: {"topic": "...", "keyword": "primary search phrase", "angle": "why this is useful now", "product_id": "one id from the list"}`,
}));
await log("scout", `Picked today's topic: "${scout.keyword}"`);

// ---- Quill: write the article ----
const product = PRODUCTS.find((p) => p.id === scout.product_id) || PRODUCTS[0];
const article = extractJSON(await claude({
  maxTokens: 6000,
  system: "You are Quill, Nightshift Studio's senior content writer. You write genuinely useful, specific, skimmable articles that rank on Google and earn trust. No fluff, no invented statistics, studies or quotes.",
  prompt: `Write a 1,200–1,600 word article.
Topic: ${scout.topic}
Primary keyword: ${scout.keyword}
Angle: ${scout.angle}
Use the keyword in the title, the first paragraph and one H2. Use H2/H3 headings, short paragraphs, bulleted steps and a concrete example or template the reader can copy.
Near the end, include one natural, non-pushy paragraph mentioning that Nightshift Studio's ${product.name} (${money(product.price)}, delivered in ${product.delivery}) can do this for them, linking to [${product.name}](/#/product/${product.id}).
Return only JSON: {"title": "...", "slug": "url-slug", "excerpt": "1-sentence meta description under 155 chars", "tag": "one word category", "markdown": "full article body in Markdown without the H1 title"}`,
}));

const slug = (article.slug || article.title).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70);
const url = `${SITE}/blog/${slug}.html`;
const page = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(article.title)} | Nightshift Studio</title>
<meta name="description" content="${esc(article.excerpt)}">
<link rel="canonical" href="${url}">
<meta property="og:title" content="${esc(article.title)}"><meta property="og:description" content="${esc(article.excerpt)}"><meta property="og:type" content="article"><meta property="og:url" content="${url}">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/css/styles.css">
<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@type": "Article", headline: article.title, description: article.excerpt, datePublished: today(), author: { "@type": "Organization", name: "Nightshift Studio" }, publisher: { "@type": "Organization", name: "Nightshift Studio" } })}</script>
</head><body>
<header class="nav"><a href="/#/" class="logo"><span class="moon">🌙</span> Nightshift<span class="accent">Studio</span></a><nav class="links" style="display:flex"><a href="/#/shop">Services</a><a href="/#/blog">Blog</a></nav><a href="/#/cart" class="cart-btn">🛒 Cart</a></header>
<main class="wrap"><article class="prose">
<p class="muted small">${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} · ${esc(article.tag || "Guide")} · Written by Quill, our AI writer, and edited by the Nightshift team</p>
<h1>${esc(article.title)}</h1>
${markdown(article.markdown)}
<div class="card" style="margin-top:40px;text-align:center">
  <div style="font-size:2.4rem">${product.icon}</div><h3>Want this done for you tonight?</h3>
  <p class="muted">${esc(product.short)}</p>
  <a class="btn" href="/#/product/${product.id}">Get the ${esc(product.name)}: ${money(product.price)}</a>
</div>
</article></main>
<footer class="footer"><p class="muted small">© ${new Date().getFullYear()} Nightshift Studio · <a href="/#/">Home</a> · <a href="/#/shop">Services</a> · <a href="/#/blog">More articles</a></p></footer>
</body></html>
`;
await writeFile(join(PUBLIC, "blog", `${slug}.html`), page);
posts.unshift({ slug, title: article.title, excerpt: article.excerpt, tag: article.tag, date: new Date().toISOString(), product: product.id });
await writeJSON(postsPath, posts);
await log("quill", `Published "${article.title}"`);

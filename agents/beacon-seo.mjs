// Beacon: rebuilds sitemap.xml + robots.txt and pings search engines via IndexNow (Bing, Yandex, Seznam, Naver…).
// Google discovers new pages through the sitemap; submit it once in Google Search Console.
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { readJSON, log, env, PUBLIC, SITE } from "./lib.mjs";

const posts = await readJSON(join(PUBLIC, "blog", "posts.json"), []);
const urls = [
  { loc: `${SITE}/`, priority: "1.0" },
  ...posts.map((p) => ({ loc: `${SITE}/blog/${p.slug}.html`, lastmod: p.date.slice(0, 10), priority: "0.7" })),
];
await writeFile(join(PUBLIC, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u.loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ""}<priority>${u.priority}</priority></url>`).join("\n")}
</urlset>
`);
await writeFile(join(PUBLIC, "robots.txt"), `User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${SITE}/sitemap.xml\n`);

let pinged = "";
if (env.INDEXNOW_KEY) {
  await writeFile(join(PUBLIC, `${env.INDEXNOW_KEY}.txt`), env.INDEXNOW_KEY);
  const fresh = urls.slice(0, 2).map((u) => u.loc); // homepage + newest article
  // The key file must already be live (it goes live after this run's first deploy).
  const live = await fetch(`${SITE}/${env.INDEXNOW_KEY}.txt`).then((r) => r.ok).catch(() => false);
  const r = live && await fetch("https://api.indexnow.org/indexnow", {
    method: "POST", headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({ host: new URL(SITE).host, key: env.INDEXNOW_KEY, keyLocation: `${SITE}/${env.INDEXNOW_KEY}.txt`, urlList: fresh }),
  });
  pinged = r && (r.ok || r.status === 202) ? " and pinged search engines via IndexNow" : "";
}
await log("beacon", `Rebuilt sitemap with ${urls.length} pages${pinged}`);

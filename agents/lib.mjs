// Shared toolkit for the Nightshift agents (run by GitHub Actions on Node 20+).
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const PUBLIC = join(ROOT, "public");
export const env = process.env;
export const SITE = (env.SITE_URL || "https://nightshift-studio.pages.dev").replace(/\/$/, "");

export async function readJSON(path, fallback) {
  try { return JSON.parse(await readFile(path, "utf8")); } catch { return fallback; }
}
export async function writeJSON(path, data) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(data, null, 2) + "\n");
}

// Public activity log shown on the website. Never put customer data in here.
const LOG = join(PUBLIC, "data", "agents.json");
export async function log(agent, msg) {
  const data = await readJSON(LOG, { log: [] });
  data.log.push({ t: new Date().toISOString(), agent, msg });
  data.log = data.log.slice(-300);
  await writeJSON(LOG, data);
  console.log(`[${agent}] ${msg}`);
}

export async function claude({ system, prompt, maxTokens = 4000, model = env.CLAUDE_MODEL || "claude-sonnet-5-5" }) {
  if (!env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: "user", content: prompt }] }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Claude: ${data.error?.message || res.status}`);
  return data.content.filter((b) => b.type === "text").map((b) => b.text).join("");
}

// Pull the first JSON object out of a model reply (tolerates ```json fences).
export function extractJSON(text) {
  const start = text.indexOf("{"), end = text.lastIndexOf("}");
  return JSON.parse(text.slice(start, end + 1));
}

export async function stripe(path) {
  if (!env.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY is not set");
  const res = await fetch(`https://api.stripe.com/v1/${path}`, { headers: { authorization: `Bearer ${env.STRIPE_SECRET_KEY}` } });
  const data = await res.json();
  if (!res.ok) throw new Error(`Stripe: ${data.error?.message || res.status}`);
  return data;
}

// Email via Resend (free: 3,000 emails/month). FROM_EMAIL must be on a domain verified in Resend,
// or use "onboarding@resend.dev" to send test emails to yourself only.
export async function email({ to, subject, html, replyTo }) {
  if (!env.RESEND_API_KEY) { console.warn("RESEND_API_KEY not set; email skipped:", subject); return false; }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ from: env.FROM_EMAIL || "Nightshift Studio <onboarding@resend.dev>", to, subject, html, reply_to: replyTo }),
  });
  if (!res.ok) throw new Error(`Resend: ${res.status} ${await res.text()}`);
  return true;
}

export const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Tiny Markdown → HTML converter (headings, lists, bold, italics, links, paragraphs).
export function markdown(md) {
  const inline = (s) => esc(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>")
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) => `<a href="${/^(https?:|\/|#)/.test(u) ? u : "#"}">${t}</a>`);
  const out = []; let list = null;
  const closeList = () => { if (list) { out.push(`</${list}>`); list = null; } };
  for (const raw of md.split("\n")) {
    const line = raw.trimEnd();
    let m;
    if ((m = line.match(/^(#{1,4})\s+(.*)/))) { closeList(); const l = Math.max(2, m[1].length); out.push(`<h${l}>${inline(m[2])}</h${l}>`); }
    else if ((m = line.match(/^\s*[-*]\s+(.*)/))) { if (list !== "ul") { closeList(); out.push("<ul>"); list = "ul"; } out.push(`<li>${inline(m[1])}</li>`); }
    else if ((m = line.match(/^\s*\d+[.)]\s+(.*)/))) { if (list !== "ol") { closeList(); out.push("<ol>"); list = "ol"; } out.push(`<li>${inline(m[1])}</li>`); }
    else if (!line.trim()) closeList();
    else { closeList(); out.push(`<p>${inline(line)}</p>`); }
  }
  closeList();
  return out.join("\n");
}

export const today = () => new Date().toISOString().slice(0, 10);

// Sentinel: checks the live storefront and APIs, and emails the owner if anything is down.
import { log, email, env, SITE } from "./lib.mjs";

const checks = [
  ["Storefront", () => fetch(`${SITE}/`).then((r) => r.ok)],
  ["Product catalog", () => fetch(`${SITE}/js/catalog.js`).then((r) => r.ok)],
  // An invalid session id should get a clean 400 from a healthy order API.
  ["Order API", () => fetch(`${SITE}/api/order?session_id=bad`).then((r) => r.status === 400)],
  ["Checkout API", () => fetch(`${SITE}/api/checkout`, { method: "POST", body: "{}" }).then((r) => r.status === 400)],
];

const started = Date.now();
const failed = [];
for (const [name, check] of checks) {
  const ok = await check().catch(() => false);
  if (!ok) failed.push(name);
}
const ms = Date.now() - started;

if (failed.length) {
  if (env.OWNER_EMAIL) await email({ to: env.OWNER_EMAIL, subject: `🚨 Sentinel: ${failed.join(", ")} failing on ${SITE}`, html: `<p>These checks failed: <b>${failed.join(", ")}</b>.</p><p>Check your Cloudflare Pages deployment and environment variables.</p>` });
  await log("sentinel", `Detected an issue with ${failed.length} check(s) and alerted the team`);
  process.exitCode = 1;
} else {
  await log("sentinel", `All ${checks.length} health checks passed (${ms}ms)`);
}

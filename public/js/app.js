import { PRODUCTS, ADDONS, BRAND, findProduct, money } from "./catalog.js";
import { AGENTS, nextRun } from "./agents.js";

const $ = (s, el = document) => el.querySelector(s);
const app = $("#app");
const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const FREE_PERK_THRESHOLD = 15000; // $150 unlocks free unlimited revisions (enforced server-side too)

/* ---------------- Cart (persisted in localStorage) ---------------- */
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
let cart = store.get("ns_cart", []);
const saveCart = () => { store.set("ns_cart", cart); renderCartCount(); };
const lineKey = (id, addons) => [id, ...[...addons].sort()].join("|");
const linePrice = (l) => (findProduct(l.id).price + l.addons.reduce((s, a) => s + ADDONS[a].price, 0)) * l.qty;
const subtotal = () => cart.reduce((s, l) => s + linePrice(l), 0);

function addToCart(id, addons = []) {
  if (!findProduct(id)) return;
  const key = lineKey(id, addons);
  const existing = cart.find((l) => l.key === key);
  existing ? existing.qty++ : cart.push({ key, id, addons, qty: 1 });
  saveCart();
  const btn = $("#cart-count").parentElement;
  btn.classList.remove("bump"); void btn.offsetWidth; btn.classList.add("bump");
  toast(`Added ${findProduct(id).name} to cart`);
}
function renderCartCount() { $("#cart-count").textContent = cart.reduce((s, l) => s + l.qty, 0); }

function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("show"), 2400);
}

/* ---------------- Agent ops data (real logs written by the agents) ---------------- */
let opsCache;
async function loadOps() {
  if (opsCache) return opsCache;
  try { opsCache = await (await fetch("/data/agents.json", { cache: "no-store" })).json(); }
  catch { opsCache = { log: [], stats: {} }; }
  return opsCache;
}
const agentById = (id) => AGENTS.find((a) => a.id === id) || { name: id, emoji: "⚙️", color: "#a3a1c8" };
function ago(ts) {
  const s = Math.max(1, (Date.now() - new Date(ts)) / 1000);
  if (s < 60) return `${Math.floor(s)}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
function countdown(date) {
  if (!date) return "";
  const s = Math.max(0, Math.floor((date - Date.now()) / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return `${h}h ${String(m).padStart(2, "0")}m ${String(sec).padStart(2, "0")}s`;
}
function agentNextLabel(a) {
  if (a.schedule.type === "live") return "Online now · responds instantly";
  if (a.schedule.type === "event") return a.schedule.label;
  return `Next shift in <span data-countdown="${nextRun(a.schedule).toISOString()}">${countdown(nextRun(a.schedule))}</span>`;
}
setInterval(() => document.querySelectorAll("[data-countdown]").forEach((el) => {
  el.textContent = countdown(new Date(el.dataset.countdown));
}), 1000);

/* Console: replays the real activity log, then shows live status + countdowns. */
let consoleTimer;
async function startConsole(el) {
  clearInterval(consoleTimer);
  const ops = await loadOps();
  const fmt = (d) => new Date(d).toISOString().slice(5, 16).replace("T", " ");
  const lines = ops.log.slice(-14).map((e) => {
    const a = agentById(e.agent);
    return `<span class="t">${fmt(e.t)}</span> <span class="a" style="color:${a.color}">${a.emoji} ${esc(a.name)}</span> ${esc(e.msg)}`;
  });
  const statusLines = AGENTS.map((a) => {
    const n = nextRun(a.schedule);
    const state = a.schedule.type === "live" ? "online · listening for visitors"
      : a.schedule.type === "event" ? "standing by for the next order"
      : `next shift in <span data-countdown="${n.toISOString()}">${countdown(n)}</span>`;
    return `<span class="t">status</span> <span class="a" style="color:${a.color}">${a.emoji} ${a.name}</span> ${state}`;
  });
  const queue = [...lines, `<span class="t">────</span> crew status`, ...statusLines];
  el.innerHTML = "";
  let i = 0;
  consoleTimer = setInterval(() => {
    if (!document.body.contains(el) || i >= queue.length) {
      clearInterval(consoleTimer);
      if (document.body.contains(el)) el.insertAdjacentHTML("beforeend", `<div class="console-line">$ <span class="cursor"></span></div>`);
      return;
    }
    el.insertAdjacentHTML("beforeend", `<div class="console-line">${queue[i++]}</div>`);
    while (el.children.length > 16) el.firstElementChild.remove();
  }, 220);
}

/* ---------------- Views ---------------- */
const productCard = (p) => `
  <article class="card product-card">
    ${p.badge ? `<span class="badge">${esc(p.badge)}</span>` : ""}
    <div class="icon">${p.icon}</div>
    <h3><a href="#/product/${p.id}">${esc(p.name)}</a></h3>
    <p class="desc">${esc(p.short)}</p>
    <div class="meta"><span>⚡ ${p.delivery}</span><span>🛡️ Money-back guarantee</span></div>
    <div><span class="price">${money(p.price)}</span><span class="compare">${money(p.compareAt)}</span></div>
    <div class="card-actions">
      <a class="btn btn-ghost btn-small" href="#/product/${p.id}">Details</a>
      <button class="btn btn-small" data-add="${p.id}">Add to cart</button>
    </div>
  </article>`;

function viewHome() {
  const featured = ["launch-bundle", "brand-kit", "resume-glowup", "website-copy"].map(findProduct);
  app.innerHTML = `
  <div class="wrap">
    <section class="hero">
      <div>
        <span class="eyebrow">AI-powered · Human-approved · Delivered in 24–48h</span>
        <h1>Your business, <span class="accent">built overnight.</span></h1>
        <p class="lead">Nightshift Studio is a crew of 8 AI agents and a human editor working around the clock on your brand, website copy, content and career. Order before bed and wake up to agency-quality work at a fraction of agency prices.</p>
        <div class="hero-ctas">
          <a class="btn" href="#/shop">Browse services →</a>
          <a class="btn btn-ghost" href="#/agents">Meet the AI crew</a>
        </div>
        <div class="trust"><span>⚡ 24–48h delivery</span><span>🛡️ 7-day money-back guarantee</span><span>🔒 Secure Stripe checkout</span></div>
      </div>
      <div class="console" aria-label="Live agent operations console">
        <div class="console-head"><i style="background:#ff5f57"></i><i style="background:#febc2e"></i><i style="background:#28c840"></i><span>nightshift-ops — live</span></div>
        <div class="console-body" id="console"></div>
      </div>
    </section>

    <section class="block" style="padding-top:20px">
      <div class="stat-row">
        <div class="card stat"><b class="accent">8</b><span class="muted">AI agents on shift</span></div>
        <div class="card stat"><b class="accent">24/7</b><span class="muted">Always working</span></div>
        <div class="card stat"><b class="accent">24–48h</b><span class="muted">Typical delivery</span></div>
        <div class="card stat"><b class="accent">up to 60%</b><span class="muted">Less than agencies</span></div>
      </div>
    </section>

    <section class="block">
      <span class="eyebrow">Popular right now</span>
      <h2>Pick a service. We'll handle the rest.</h2>
      <div class="grid" style="margin-top:28px">${featured.map(productCard).join("")}</div>
      <p style="text-align:center;margin-top:30px"><a class="btn btn-ghost" href="#/shop">See all ${PRODUCTS.length} services</a></p>
    </section>

    <section class="block steps">
      <span class="eyebrow">How it works</span>
      <h2>Three steps. Zero meetings.</h2>
      <div class="grid" style="margin-top:28px">
        <div class="card"><h3>Order & brief us</h3><p class="muted">Check out in under a minute with card, Apple Pay, Google Pay, PayPal or Cash App Pay, then answer two or three quick questions.</p></div>
        <div class="card"><h3>The crew gets to work</h3><p class="muted">Atlas, our fulfillment agent, drafts your deliverable within minutes using your brief and proven frameworks.</p></div>
        <div class="card"><h3>Human-polished delivery</h3><p class="muted">A human editor reviews and finalizes everything before it lands in your inbox, usually within 24–48 hours.</p></div>
      </div>
    </section>

    <section class="block">
      <div class="card" style="text-align:center;padding:50px 24px;background:linear-gradient(135deg,rgba(139,123,255,.18),rgba(49,225,201,.12))">
        <span class="eyebrow">Founding-client pricing</span>
        <h2>Be one of our first 100 clients.</h2>
        <p class="muted" style="max-width:620px;margin:0 auto 24px">We just launched, so prices are at their lowest and every order gets extra attention. Use code <b>NIGHTOWL</b> for an extra 10% off.</p>
        <a class="btn" href="#/product/launch-bundle">Get the Full Launch Bundle: ${money(findProduct("launch-bundle").price)}</a>
      </div>
    </section>
  </div>`;
  startConsole($("#console"));
}

function viewShop(params) {
  const cats = ["All", ...new Set(PRODUCTS.map((p) => p.category))];
  const active = params.get("c") || "All";
  const list = active === "All" ? PRODUCTS : PRODUCTS.filter((p) => p.category === active);
  app.innerHTML = `
  <div class="wrap block">
    <span class="eyebrow">All services</span>
    <h1>Done-for-you, <span class="accent">done overnight.</span></h1>
    <p class="muted">Every service is drafted by our AI crew and reviewed by a human before delivery.</p>
    <div class="filters">${cats.map((c) => `<a class="chip ${c === active ? "active" : ""}" href="#/shop?c=${encodeURIComponent(c)}">${c}</a>`).join("")}</div>
    <div class="grid">${list.map(productCard).join("")}</div>
  </div>`;
}

function viewProduct(id) {
  const p = findProduct(id);
  if (!p) return viewNotFound();
  document.title = `${p.name} | ${BRAND.name}`;
  const related = PRODUCTS.filter((x) => x.id !== p.id && (x.category === p.category || x.id === "launch-bundle")).slice(0, 3);
  app.innerHTML = `
  <div class="wrap">
    <div class="product-page">
      <div>
        <a href="#/shop" class="muted small">← All services</a>
        <div style="font-size:3rem;margin-top:16px">${p.icon}</div>
        <span class="eyebrow">${esc(p.category)} · delivered in ${p.delivery}</span>
        <h1 style="font-size:clamp(2rem,4vw,3rem)">${esc(p.name)}</h1>
        <p class="lead muted" style="font-size:1.15rem">${esc(p.short)}</p>
        <h3 style="margin-top:30px">What you get</h3>
        <ul class="check">${p.includes.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>
        <h3 style="margin-top:30px">How it's made</h3>
        <p class="muted">After checkout you answer a short brief. Atlas, our fulfillment agent, builds a first draft using proven copywriting and strategy frameworks. A human editor then polishes and fact-checks it and emails you the final files.</p>
      </div>
      <aside class="card buy-box">
        ${p.badge ? `<span class="badge">${esc(p.badge)}</span>` : ""}
        <div><span class="price" style="font-size:2.2rem">${money(p.price)}</span><span class="compare">${money(p.compareAt)}</span></div>
        <p class="muted small">You save ${money(p.compareAt - p.price)} (${Math.round((1 - p.price / p.compareAt) * 100)}% off launch pricing)</p>
        <form id="buy-form">
          ${Object.values(ADDONS).map((a) => `
            <label class="addon"><input type="checkbox" name="addon" value="${a.id}" /><span>${a.name}</span><b>+${money(a.price)}</b></label>`).join("")}
          <button class="btn btn-block" style="margin-top:14px" name="action" value="buy">Buy now</button>
          <button class="btn btn-ghost btn-block" style="margin-top:10px" name="action" value="add">Add to cart</button>
        </form>
        <div class="guarantee">🛡️ <span>7-day money-back guarantee. If the draft isn't right after one revision, you get a full refund.</span></div>
        <div class="guarantee">💳 <span>Card, Apple Pay, Google Pay, PayPal and Cash App Pay accepted</span></div>
      </aside>
    </div>
    <section class="block" style="padding-top:0">
      <h2>Pairs well with</h2>
      <div class="grid" style="margin-top:20px">${related.map(productCard).join("")}</div>
    </section>
  </div>`;
  $("#buy-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const addons = [...e.target.querySelectorAll("input[name=addon]:checked")].map((i) => i.value);
    addToCart(p.id, addons);
    if (e.submitter?.value === "buy") location.hash = "#/checkout";
  });
}

function cartSummary() {
  const sub = subtotal();
  const pct = Math.min(100, (sub / FREE_PERK_THRESHOLD) * 100);
  const perk = sub >= FREE_PERK_THRESHOLD
    ? `<p class="small" style="color:var(--accent2)">🎉 You unlocked free unlimited revisions on your whole order!</p>`
    : `<p class="small muted">Add <b>${money(FREE_PERK_THRESHOLD - sub)}</b> more to unlock <b>free unlimited revisions</b> on everything.</p>`;
  return `
    <div class="progress"><div style="width:${pct}%"></div></div>${perk}
    <div class="summary-row"><span>Subtotal</span><span>${money(sub)}</span></div>
    <div class="summary-row muted small"><span>Promo codes</span><span>Applied at payment</span></div>
    <div class="summary-row total"><span>Total</span><span>${money(sub)}</span></div>`;
}

function viewCart() {
  if (!cart.length) {
    app.innerHTML = `<div class="wrap block" style="text-align:center"><div style="font-size:3rem">🛒</div><h1>Your cart is empty</h1><p class="muted">The crew is ready when you are.</p><a class="btn" href="#/shop">Browse services</a></div>`;
    return;
  }
  const inCart = new Set(cart.map((l) => l.id));
  const upsell = !inCart.has("launch-bundle") && inCart.size >= 1
    ? PRODUCTS.find((p) => p.id === "launch-bundle")
    : PRODUCTS.find((p) => !inCart.has(p.id) && p.id !== "launch-bundle");
  app.innerHTML = `
  <div class="wrap">
    <div class="cart-layout">
      <div>
        <h1>Your cart</h1>
        ${cart.map((l) => { const p = findProduct(l.id); return `
          <div class="cart-item">
            <div class="icon">${p.icon}</div>
            <div class="info">
              <b>${esc(p.name)}</b>
              <div class="addons">${l.addons.map((a) => "+ " + ADDONS[a].name).join("<br>") || "Standard delivery: " + p.delivery}</div>
              <div style="margin-top:8px;display:flex;gap:14px;align-items:center">
                <div class="qty"><button data-qty="-1" data-key="${l.key}" aria-label="Decrease">−</button><span>${l.qty}</span><button data-qty="1" data-key="${l.key}" aria-label="Increase">+</button></div>
                <button class="link-btn" data-remove="${l.key}">Remove</button>
              </div>
            </div>
            <b>${money(linePrice(l))}</b>
          </div>`; }).join("")}
        ${upsell ? `
        <div class="card upsell" style="margin-top:24px;display:flex;gap:16px;align-items:center;flex-wrap:wrap">
          <div style="font-size:2rem">${upsell.icon}</div>
          <div style="flex:1;min-width:200px"><b>Customers also add: ${esc(upsell.name)}</b><div class="muted small">${esc(upsell.short)}</div></div>
          <button class="btn btn-small" data-add="${upsell.id}">Add for ${money(upsell.price)}</button>
        </div>` : ""}
      </div>
      <aside class="card buy-box">
        <h3>Order summary</h3>
        ${cartSummary()}
        <a class="btn btn-block" style="margin-top:16px" href="#/checkout">Checkout securely →</a>
        <div class="secure-note">🔒 256-bit encrypted checkout powered by Stripe</div>
      </aside>
    </div>
  </div>`;
}

function viewCheckout() {
  if (!cart.length) return viewCart();
  const unique = [...new Set(cart.map((l) => l.id))].map(findProduct);
  const saved = store.get("ns_brief", {});
  app.innerHTML = `
  <div class="wrap">
    <form class="cart-layout" id="checkout-form">
      <div>
        <a href="#/cart" class="muted small">← Back to cart</a>
        <h1>Checkout</h1>
        <p class="muted">Tell us where to send your work and give the crew a head start. You'll pay on the next screen.</p>
        <div class="card">
          <h3>Contact</h3>
          <label for="email">Email (your files are delivered here)</label>
          <input id="email" name="email" type="email" required value="${esc(saved.email || "")}" placeholder="you@email.com" />
          <label for="name">Full name</label>
          <input id="name" name="name" required value="${esc(saved.name || "")}" placeholder="Jordan Smith" />
        </div>
        <div class="card" style="margin-top:20px">
          <h3>Your brief</h3>
          <p class="muted small">The more detail, the better your first draft. You can also reply to your confirmation email with files and links.</p>
          ${unique.map((p) => `
            <div class="brief-group">
              <h4 style="margin:14px 0 0">${p.icon} ${esc(p.name)}</h4>
              ${p.brief.map((f) => { const n = `${p.id}__${f.key}`; const v = esc(saved[n] || ""); return `
                <label for="${n}">${esc(f.label)}${f.required ? " *" : ""}</label>
                ${f.type === "textarea" ? `<textarea id="${n}" name="${n}" ${f.required ? "required" : ""} maxlength="3000">${v}</textarea>` : `<input id="${n}" name="${n}" ${f.required ? "required" : ""} maxlength="300" value="${v}" />`}`; }).join("")}
            </div>`).join("")}
        </div>
      </div>
      <aside class="card buy-box">
        <h3>Order summary</h3>
        ${cart.map((l) => `<div class="summary-row small"><span>${l.qty}× ${esc(findProduct(l.id).name)}${l.addons.length ? ` <span class="muted">(+${l.addons.length} add-on${l.addons.length > 1 ? "s" : ""})</span>` : ""}</span><span>${money(linePrice(l))}</span></div>`).join("")}
        ${cartSummary()}
        <button class="btn btn-block" style="margin-top:16px" id="pay-btn">Continue to secure payment →</button>
        <div class="secure-note">💳 Card · Apple Pay · Google Pay · PayPal · Cash App Pay</div>
        <div class="secure-note">🛡️ 7-day money-back guarantee</div>
        <p class="muted small" style="text-align:center">By ordering you agree to our <a href="#/terms" style="text-decoration:underline">Terms</a> and <a href="#/refunds" style="text-decoration:underline">Refund policy</a>.</p>
      </aside>
    </form>
  </div>`;
  const form = $("#checkout-form");
  form.addEventListener("input", () => store.set("ns_brief", Object.fromEntries(new FormData(form))));
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    const btn = $("#pay-btn"); btn.disabled = true; btn.textContent = "Opening secure checkout…";
    try {
      const res = await fetch("/api/checkout", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ items: cart.map(({ id, qty, addons }) => ({ id, qty, addons })), email: data.email, name: data.name, brief: data }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok || !out.url) throw new Error(out.error || "Checkout is not configured yet.");
      location.href = out.url;
    } catch (err) {
      toast(err.message);
      btn.disabled = false; btn.textContent = "Continue to secure payment →";
    }
  });
}

async function viewSuccess() {
  const sid = new URLSearchParams(location.search).get("session_id");
  app.innerHTML = `<div class="wrap block" style="text-align:center;max-width:680px"><div style="font-size:3.5rem">🌙</div><h1>Order confirmed. The crew is on it.</h1><p class="muted" id="order-info">Loading your order…</p>
    <div class="card" style="text-align:left;margin-top:24px">
      <h3>What happens next</h3>
      <ol class="muted"><li>You'll get a Stripe receipt by email in a minute or two.</li><li>Atlas, our fulfillment agent, is drafting your deliverable right now.</li><li>A human editor reviews it, then we email you the final files within the delivery window.</li></ol>
      <p class="muted small">Questions? Reply to your receipt or email ${BRAND.supportEmail}.</p>
    </div><a class="btn" style="margin-top:24px" href="#/shop">Keep browsing</a></div>`;
  cart = []; saveCart(); store.set("ns_brief", {});
  if (!sid) return ($("#order-info").textContent = "Thank you for your order!");
  try {
    const o = await (await fetch(`/api/order?session_id=${encodeURIComponent(sid)}`)).json();
    $("#order-info").innerHTML = o.paid
      ? `Thanks${o.name ? ", " + esc(o.name.split(" ")[0]) : ""}! We received <b>${money(o.amount)}</b>. Confirmation sent to <b>${esc(o.email)}</b>.`
      : "We're confirming your payment. You'll get an email as soon as it clears.";
  } catch { $("#order-info").textContent = "Thank you for your order!"; }
  // Strip the session id from the address bar so refreshes don't re-run this.
  history.replaceState(null, "", "/#/success");
}

async function viewAgents() {
  const ops = await loadOps();
  const last = (id) => [...ops.log].reverse().find((e) => e.agent === id);
  app.innerHTML = `
  <div class="wrap block">
    <span class="eyebrow">Meet the crew</span>
    <h1>8 AI agents. <span class="accent">Zero days off.</span></h1>
    <p class="muted" style="max-width:720px">Nightshift runs on a team of specialized AI agents. Each one has a job, a schedule and a log. This page shows their real activity: every line below was written by an agent when it finished a task.</p>
    <div class="grid" style="margin-top:30px">
      ${AGENTS.map((a) => { const l = last(a.id); return `
        <article class="card agent-card">
          <div class="agent-top"><div class="avatar" style="background:${a.color}22">${a.emoji}</div><div><b>${a.name}</b><div class="role">${a.role}</div></div></div>
          <span class="agent-status"><span class="dot ${a.schedule.type === "live" ? "" : "idle"}"></span>${a.schedule.type === "live" ? "Online" : "On schedule"}</span>
          <p class="muted small" style="margin:0">${a.does}</p>
          ${l ? `<p class="small" style="margin:0">Last: ${esc(l.msg)} <span class="muted">· ${ago(l.t)}</span></p>` : ""}
          <div class="next">${agentNextLabel(a)}</div>
        </article>`; }).join("")}
    </div>
    <h2 style="margin-top:60px">Activity log</h2>
    <ul class="feed card">
      ${[...ops.log].reverse().slice(0, 40).map((e) => { const a = agentById(e.agent); return `<li><span class="when">${ago(e.t)}</span><span>${a.emoji} <b style="color:${a.color}">${esc(a.name)}</b> ${esc(e.msg)}</span></li>`; }).join("") || `<li class="muted">The crew's first shift hasn't run yet. Check back soon.</li>`}
    </ul>
  </div>`;
}

async function viewBlog() {
  let posts = [];
  try { posts = await (await fetch("/blog/posts.json", { cache: "no-store" })).json(); } catch {}
  app.innerHTML = `
  <div class="wrap block">
    <span class="eyebrow">The Night Notes</span>
    <h1>Growth playbooks, <span class="accent">published daily.</span></h1>
    <p class="muted">Practical guides on branding, marketing, careers and side hustles, researched and written by Scout and Quill.</p>
    <div class="grid" style="margin-top:30px">
      ${posts.map((p) => `
        <a class="card post-card" href="/blog/${p.slug}.html">
          <span class="muted small">${new Date(p.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · ${esc(p.tag || "Guide")}</span>
          <h3>${esc(p.title)}</h3><p class="muted small">${esc(p.excerpt)}</p><span class="accent small">Read →</span>
        </a>`).join("") || `<p class="muted">The first article is being written. Check back tomorrow!</p>`}
    </div>
  </div>`;
}

const FAQS = [
  ["Is the work done by AI or by people?", "Both. Our AI crew drafts every deliverable in minutes, then a human editor reviews, polishes and approves it before it's sent to you. That's how we deliver agency-quality work in 24–48 hours at a fraction of the price."],
  ["How fast will I get my order?", "Most services are delivered within 24–48 hours (the Launch Bundle within 72). Add Rush delivery at checkout to get it within 12 hours."],
  ["What payment methods do you accept?", "All major credit and debit cards, Apple Pay, Google Pay, PayPal and Cash App Pay, all processed securely by Stripe. We never see or store your card details."],
  ["What if I don't like it?", "Every order includes one revision. If it's still not right, email us within 7 days of delivery for a full refund. No hard feelings."],
  ["Do I own what you create?", "Yes. Once your order is paid, you have full commercial rights to everything we deliver."],
  ["Do you have discount codes?", "Use NIGHTOWL for 10% off during our launch. Orders over $150 also get free unlimited revisions."],
  ["Can I talk to someone?", "Nova, our AI concierge (bottom-right corner), answers instantly 24/7. For anything else, email " + BRAND.supportEmail + "."],
];
function viewFaq() {
  app.innerHTML = `<div class="wrap block" style="max-width:820px"><span class="eyebrow">FAQ</span><h1>Questions? <span class="accent">Answered.</span></h1>
    ${FAQS.map(([q, a]) => `<details><summary>${q}</summary><p>${a}</p></details>`).join("")}</div>`;
}

const LEGAL = {
  terms: ["Terms of Service", `<p>By purchasing from ${BRAND.name} you agree to these terms. Services are delivered digitally to the email you provide at checkout within the stated delivery window, counted from when we receive your brief. Deliverables are drafted with the help of AI tools and reviewed by a human. You receive full commercial rights to delivered work once payment clears. You're responsible for checking deliverables (e.g. business names, legal or financial figures) before relying on them; we do not provide legal, financial or tax advice. We may refuse orders that request unlawful, hateful or deceptive content.</p>`],
  privacy: ["Privacy Policy", `<p>We collect your name, email and the brief you submit so we can fulfill your order. Payments are handled by Stripe; we never see or store your full card details. Brief contents are processed by our AI providers solely to create your deliverable. We don't sell your data. Newsletter subscribers can unsubscribe at any time. To request deletion of your data, email ${BRAND.supportEmail}.</p>`],
  refunds: ["Refund Policy", `<p>Every order includes one free revision. If you're still not satisfied, email ${BRAND.supportEmail} within 7 days of delivery for a full refund to your original payment method. Refunds for orders not yet started are available any time. Refunds typically appear in 5–10 business days.</p>`],
};
function viewLegal(k) {
  const [title, body] = LEGAL[k];
  app.innerHTML = `<div class="wrap prose"><h1>${title}</h1>${body}<p class="muted small">Last updated ${new Date().getFullYear()}. Replace this template with your own legal text before launch.</p></div>`;
}
function viewNotFound() {
  app.innerHTML = `<div class="wrap block" style="text-align:center"><h1>Lost in the night 🌌</h1><p class="muted">That page doesn't exist.</p><a class="btn" href="#/">Go home</a></div>`;
}

/* ---------------- Router ---------------- */
function route() {
  const [path, qs] = (location.hash.slice(1) || "/").split("?");
  const params = new URLSearchParams(qs);
  const parts = path.split("/").filter(Boolean);
  document.title = `${BRAND.name}: done-for-you brand, copy & career services`;
  document.querySelectorAll(".links a").forEach((a) => a.classList.toggle("active", a.getAttribute("href") === "#/" + (parts[0] || "")));
  $("#navlinks").classList.remove("open");
  window.scrollTo(0, 0);
  switch (parts[0]) {
    case undefined: return viewHome();
    case "shop": return viewShop(params);
    case "product": return viewProduct(parts[1]);
    case "cart": return viewCart();
    case "checkout": return viewCheckout();
    case "success": return viewSuccess();
    case "agents": return viewAgents();
    case "blog": return viewBlog();
    case "faq": return viewFaq();
    case "terms": case "privacy": case "refunds": return viewLegal(parts[0]);
    default: return viewNotFound();
  }
}

/* ---------------- Global events ---------------- */
document.addEventListener("click", (e) => {
  const add = e.target.closest("[data-add]");
  if (add) { addToCart(add.dataset.add); if (location.hash.startsWith("#/cart")) viewCart(); }
  const q = e.target.closest("[data-qty]");
  if (q) {
    const l = cart.find((x) => x.key === q.dataset.key);
    l.qty += Number(q.dataset.qty);
    if (l.qty <= 0) cart = cart.filter((x) => x !== l);
    saveCart(); viewCart();
  }
  const rm = e.target.closest("[data-remove]");
  if (rm) { cart = cart.filter((x) => x.key !== rm.dataset.remove); saveCart(); viewCart(); }
});
$("#menu-btn").addEventListener("click", () => $("#navlinks").classList.toggle("open"));
$("#year").textContent = new Date().getFullYear();

$("#newsletter").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = new FormData(e.target).get("email");
  try {
    const r = await fetch("/api/subscribe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }) });
    if (!r.ok) throw 0;
    toast("You're in! Check your inbox 🌙"); e.target.reset();
  } catch { toast("Couldn't subscribe right now. Please try again later."); }
});

/* ---------------- Nova chat ---------------- */
const chatLog = $("#chat-log");
let chatHistory = store.get("ns_chat", []);
const addMsg = (role, text) => {
  chatLog.insertAdjacentHTML("beforeend", `<div class="msg ${role === "user" ? "me" : "bot"}">${esc(text).replace(/\[([^\]]+)\]\((#\/[^)]+)\)/g, '<a href="$2" style="text-decoration:underline">$1</a>')}</div>`);
  chatLog.scrollTop = chatLog.scrollHeight;
};
function openChat() {
  $("#chat").hidden = false;
  if (!chatLog.children.length) {
    addMsg("assistant", "Hey! I'm Nova, Nightshift's AI concierge 🌙 Tell me what you're working on (a new business, a job hunt, more sales…) and I'll point you to the right service.");
    chatHistory.forEach((m) => addMsg(m.role, m.content));
  }
  $("#chat-input").focus();
}
$("#chat-fab").addEventListener("click", () => ($("#chat").hidden ? openChat() : ($("#chat").hidden = true)));
$("#chat-close").addEventListener("click", () => ($("#chat").hidden = true));

// Offline fallback so Nova still helps if the AI endpoint isn't configured.
function novaFallback(text) {
  const t = text.toLowerCase();
  const pick = (id) => { const p = findProduct(id); return `${p.name} (${money(p.price)}, ${p.delivery}): ${p.short} [View it](#/product/${p.id})`; };
  if (/resume|job|linkedin|career|interview/.test(t)) return "Sounds like the " + pick("resume-glowup");
  if (/brand|logo|name|start|new business|launch/.test(t)) return "For a new business I'd recommend the " + pick("launch-bundle") + "\n\nOr start smaller with the " + pick("brand-kit");
  if (/social|instagram|tiktok|content|post/.test(t)) return "Try the " + pick("content-30");
  if (/website|copy|landing|homepage/.test(t)) return "You want the " + pick("website-copy");
  if (/email|newsletter|list/.test(t)) return "Check out the " + pick("email-sequence");
  if (/etsy|shopify|listing|amazon/.test(t)) return "Perfect fit: the " + pick("etsy-shop");
  if (/plan|investor|loan|projection/.test(t)) return "You need the " + pick("business-plan");
  if (/pay|paypal|cash ?app|apple|card/.test(t)) return "We accept all major cards, Apple Pay, Google Pay, PayPal and Cash App Pay through secure Stripe checkout.";
  if (/refund|guarantee/.test(t)) return "Every order includes a revision and a 7-day money-back guarantee.";
  if (/discount|code|coupon|deal/.test(t)) return "Use code NIGHTOWL at checkout for 10% off, and orders over $150 get free unlimited revisions!";
  return "I can help you pick the perfect service! Are you launching a business, growing an existing one, or job hunting? You can also [browse everything](#/shop).";
}
$("#chat-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const input = $("#chat-input"); const text = input.value.trim();
  if (!text) return;
  input.value = ""; addMsg("user", text);
  chatHistory.push({ role: "user", content: text });
  let reply;
  try {
    const r = await fetch("/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ messages: chatHistory.slice(-12) }) });
    if (!r.ok) throw 0;
    reply = (await r.json()).reply;
  } catch { reply = novaFallback(text); }
  addMsg("assistant", reply);
  chatHistory.push({ role: "assistant", content: reply });
  store.set("ns_chat", chatHistory.slice(-20));
});

// Live pill reflects whether the agents have reported in within the last day.
loadOps().then((ops) => {
  const latest = ops.log.at(-1);
  const fresh = latest && Date.now() - new Date(latest.t) < 26 * 3600 * 1000;
  $("#live-text").textContent = fresh ? `Agents online · last task ${ago(latest.t)}` : "Agents online";
});

window.addEventListener("hashchange", route);
renderCartCount();
route();

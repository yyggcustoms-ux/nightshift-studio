import { PRODUCTS, ADDONS, BRAND, findProduct, money } from "./catalog.js";
import { AGENTS, nextRun } from "./agents.js";
import { initCity } from "./city.js";

const $ = (s, el = document) => el.querySelector(s);
const app = $("#app");
const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const FREE_PERK_THRESHOLD = 15000; // $150 unlocks free unlimited revisions (enforced server-side too)
const woNumber = (p) => "WO-" + String(PRODUCTS.indexOf(p) + 101);
const hoursOf = (p) => parseInt(p.delivery, 10) || 48;
const readyBy = (p) => new Date(Date.now() + hoursOf(p) * 3600e3).toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" });

/* ---------------- Cart (persisted in localStorage) ---------------- */
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
let cart = store.get("ns_cart", []).filter((l) => findProduct(l.id));
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
  const btn = $(".cart-btn");
  btn.classList.remove("bump"); void btn.offsetWidth; btn.classList.add("bump");
  toast(`Pinned to your order: ${findProduct(id).name}`);
}
function renderCartCount() { $("#cart-count").textContent = cart.reduce((s, l) => s + l.qty, 0); }

function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("show"), 2800);
}

/* ---------------- Agent ops data (real logs written by the agents) ---------------- */
let opsCache;
async function loadOps() {
  if (opsCache) return opsCache;
  try { opsCache = await (await fetch("/data/agents.json", { cache: "no-store" })).json(); }
  catch { opsCache = { log: [] }; }
  return opsCache;
}
const agentById = (id) => AGENTS.find((a) => a.id === id) || { name: id, role: "" };
function ago(ts) {
  const s = Math.max(1, (Date.now() - new Date(ts)) / 1000);
  if (s < 60) return `${Math.floor(s)}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
const punch = (ts) => new Date(ts).toLocaleString("en-US", { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
function countdown(date) {
  const s = Math.max(0, Math.floor((date - Date.now()) / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}
function nextLabel(a) {
  if (a.schedule.type === "live") return "on the desk now";
  if (a.schedule.type === "event") return "on call · every order";
  const n = nextRun(a.schedule);
  return `in <span data-countdown="${n.toISOString()}">${countdown(n)}</span>`;
}
function tick() {
  document.querySelectorAll("[data-countdown]").forEach((el) => (el.textContent = countdown(new Date(el.dataset.countdown))));
  $("#clock").textContent = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}
setInterval(tick, 1000);

/* ---------------- Shared pieces ---------------- */
const ticket = (p) => `
  <article class="ticket paper" data-tilt>
    <div class="ticket-top"><span>${woNumber(p)}</span><span>${esc(p.category)}</span></div>
    ${p.badge ? `<span class="stamp ${p.id === "launch-bundle" ? "blue" : ""}">${esc(p.badge)}</span>` : ""}
    <h3><a href="#/product/${p.id}">${esc(p.name)}</a></h3>
    <p class="desc">${esc(p.short)}</p>
    <div class="perf"></div>
    <div class="ticket-foot">
      <div>
        <span class="price">${money(p.price)}</span><span class="compare">${money(p.compareAt)}</span>
        <div class="ready-by">Order now → ready by <b>${readyBy(p)}</b></div>
      </div>
      <button class="btn btn-ink btn-small" data-add="${p.id}">Add</button>
    </div>
  </article>`;

const moonMark = `<svg viewBox="0 0 32 32" width="22" height="22" aria-hidden="true"><path d="M21 5a11 11 0 1 0 6 18.5A12 12 0 0 1 21 5z" fill="currentColor"/></svg>`;
const arrow = `<svg viewBox="0 0 80 64" aria-hidden="true"><path d="M74 6 C 50 10, 30 26, 14 52" stroke="#ffd59a" stroke-width="2.5" fill="none" stroke-linecap="round"/><path d="M8 40 L 13 54 L 27 49" stroke="#ffd59a" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

function timecardRows(ops) {
  const last = (id) => [...ops.log].reverse().find((e) => e.agent === id);
  return AGENTS.map((a) => {
    const l = last(a.id);
    return `<tr>
      <td>${a.name}<span class="role">${esc(a.role)}</span></td>
      <td class="punch">${l ? punch(l.t) : "—"}</td>
      <td>${l ? esc(l.msg) : `<span class="muted">${esc(a.does)}</span>`}</td>
      <td class="next">${nextLabel(a)}</td>
    </tr>`;
  }).join("");
}

/* ---------------- Views ---------------- */
let disposeCity = () => {};

async function viewHome() {
  const featured = ["launch-bundle", "brand-kit", "resume-glowup", "website-copy"].map(findProduct);
  app.innerHTML = `
  <section class="hero">
    <div class="hero-fallback"></div>
    <canvas id="city" aria-hidden="true"></canvas>
    <div class="hero-note hand" aria-hidden="true">our office.<br>lights stay on.${arrow}</div>
    <div class="wrap hero-inner">
      <span class="neon rise">Open all night</span>
      <h1 class="rise rise-2" style="margin-top:26px">Order tonight. <span class="accent">Wake up to it done.</span></h1>
      <p class="hero-lead rise rise-3">Resumes, brand kits, website copy and content plans. Our crew drafts overnight, an editor reads every word, and it's in your inbox by morning (or within 48 hours, worst case).</p>
      <div class="hero-ctas rise rise-4">
        <a class="btn" href="#/shop">See the work orders</a>
        <a class="btn btn-ghost" href="#/agents">Meet the night crew</a>
      </div>
      <div class="hero-facts"><span>From $49</span><span>24–48h turnaround</span><span>Read by a human</span><span>7-day refund</span></div>
    </div>
  </section>

  <section class="section wrap">
    <div class="section-head">
      <h2>Tonight's<br><span class="accent">work orders</span></h2>
      <p>Pick one, answer three questions, and go to bed. Every order is fixed-price, no calls required, with one free revision.</p>
    </div>
    <div class="board">${featured.map(ticket).join("")}</div>
    <p style="margin-top:56px"><a class="btn btn-ghost" href="#/shop">All ${PRODUCTS.length} work orders</a></p>
  </section>

  <section class="section wrap" style="padding-top:0">
    <div class="section-head"><h2>How a night<br>goes here</h2><p>Three steps. No meetings, and no ten-page questionnaire.</p></div>
    <div class="process">
      <div class="step"><div class="time">9:47 PM</div><h3>You clock out</h3><p>Pick a service, pay with card, Apple Pay, Google Pay, PayPal or Cash App Pay, and tell us about your business in a few sentences.</p></div>
      <div class="step"><div class="time">9:48 PM</div><h3>We clock in</h3><p>Atlas reads your brief and builds the first full draft using frameworks we've tuned for each service.</p></div>
      <div class="step"><div class="time">7:30 AM</div><h3>Coffee, then done</h3><p>An editor checks it line by line, fixes what a machine gets wrong, and sends it over. Reply if you want something changed.</p></div>
    </div>
  </section>

  <section class="section wrap" style="padding-top:0">
    <div class="note-split">
      <div>
        <span class="label">Straight answer</span>
        <h2 style="margin-top:14px">Who actually does the work?</h2>
        <p class="muted" style="margin-top:20px;max-width:30rem">Nobody likes finding out after they've paid, so here it is up front.</p>
      </div>
      <div class="letter paper">
        <p>Software does the heavy lifting: research, structure and the first draft, at 3 a.m. if that's when you order.</p>
        <p>Then a person reads it. Anything that sounds canned, anything that guesses at facts about you, anything that just isn't good gets rewritten before you see it.</p>
        <p>That's why we can charge $99 for a brand kit that an agency quotes at $1,500, and still put our name on it.</p>
        <div class="sig">— the Nightshift desk</div>
      </div>
    </div>
  </section>

  <section class="section wrap" style="padding-top:0">
    <div class="timecard paper">
      <div class="timecard-head"><h3>Tonight's timecard</h3><span class="mono small muted">Real punches from the crew's logs · times in your zone</span></div>
      <div class="table-scroll"><table class="tc"><thead><tr><th>Crew</th><th>Last punch</th><th>What they did</th><th>Next shift</th></tr></thead><tbody id="tc-body"><tr><td colspan="4" class="muted">Loading…</td></tr></tbody></table></div>
    </div>
  </section>

  <section class="section wrap" style="padding-top:0">
    <div class="card" style="display:flex;flex-wrap:wrap;gap:30px;align-items:center;justify-content:space-between;border-color:var(--lamp)">
      <div style="max-width:40rem"><span class="label">First 100 clients</span><h2 style="margin-top:12px">Get in while the<br>lights are cheap.</h2><p class="muted" style="margin-top:14px">We're new, so prices are low and every order gets extra attention. Code <b class="accent">NIGHTOWL</b> takes another 10% off.</p></div>
      <a class="btn" href="#/product/launch-bundle">Launch Bundle · ${money(findProduct("launch-bundle").price)}</a>
    </div>
  </section>`;
  disposeCity = initCity($("#city"));
  const ops = await loadOps();
  const body = $("#tc-body");
  if (body) body.innerHTML = timecardRows(ops);
}

function viewShop(params) {
  const cats = ["All", ...new Set(PRODUCTS.map((p) => p.category))];
  const active = params.get("c") || "All";
  const list = active === "All" ? PRODUCTS : PRODUCTS.filter((p) => p.category === active);
  app.innerHTML = `
  <section class="section wrap">
    <div class="section-head">
      <div><span class="label">The board</span><h1 style="margin-top:14px;font-size:clamp(3rem,7vw,5.6rem)">Work<br>orders</h1></div>
      <p>Fixed prices, no calls, one free revision on everything. The "ready by" time on each ticket updates live from the moment you're looking at it.</p>
    </div>
    <div class="filters">${cats.map((c) => `<a class="chip ${c === active ? "active" : ""}" href="#/shop?c=${encodeURIComponent(c)}">${c}</a>`).join("")}</div>
    <div class="board">${list.map(ticket).join("")}</div>
  </section>`;
}

function viewProduct(id) {
  const p = findProduct(id);
  if (!p) return viewNotFound();
  document.title = `${p.name} · ${BRAND.name}`;
  const related = PRODUCTS.filter((x) => x.id !== p.id && (x.category === p.category || x.id === "launch-bundle")).slice(0, 3);
  app.innerHTML = `
  <div class="wrap">
    <div class="product-page">
      <div>
        <a href="#/shop" class="back">← All work orders</a>
        <div style="margin-top:28px"><span class="label">${woNumber(p)} · ${esc(p.category)}</span></div>
        <h1>${esc(p.name)}</h1>
        <p class="lead">${esc(p.short)}</p>
        <h2 class="sub-h">What lands in your inbox</h2>
        <ul class="checklist">${p.includes.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>
        <h2 class="sub-h">How it gets made</h2>
        <p class="muted" style="margin-top:16px;max-width:38rem">After you pay, you'll answer ${p.brief.length} short question${p.brief.length > 1 ? "s" : ""}. Atlas builds the full first draft from your answers. Then an editor goes through it line by line, rewrites anything generic, and flags anything we had to guess so you can fill it in. You get it within ${p.delivery}, with one free revision.</p>
      </div>
      <aside class="receipt paper">
        <h3>Nightshift</h3>
        <div class="center small">${woNumber(p)} · ${esc(p.delivery)} turnaround</div>
        <div class="big-price">${money(p.price)}</div>
        <div class="center small">usually ${money(p.compareAt)} · you save ${money(p.compareAt - p.price)}</div>
        <div class="rule"></div>
        <form id="buy-form">
          <div class="small" style="font-weight:600">Extras (optional)</div>
          ${Object.values(ADDONS).map((a) => `
            <label class="addon" style="text-transform:none;letter-spacing:0;color:var(--ink);font-size:.86rem;margin:0"><input type="checkbox" id="addon-${a.id}" name="addon" value="${a.id}" /><span>${a.name}</span><b>+${money(a.price)}</b></label>`).join("")}
          <div class="rule"></div>
          <div class="row"><span>Ready by</span><span><b>${readyBy(p)}</b></span></div>
          <button class="btn btn-ink btn-block" style="margin-top:18px" name="action" value="buy">Order now</button>
          <button class="btn btn-ghost btn-block" style="margin-top:10px;color:var(--ink);border-color:var(--ink)" name="action" value="add">Add to order</button>
        </form>
        <div class="guarantee"><span>✓ One free revision included</span><span>✓ Full refund within 7 days if it's not right</span><span>✓ Card · Apple Pay · Google Pay · PayPal · Cash App Pay</span></div>
      </aside>
    </div>
    <section class="section" style="padding-top:0">
      <div class="section-head"><h2>Goes well with</h2><p></p></div>
      <div class="board">${related.map(ticket).join("")}</div>
    </section>
  </div>`;
  $("#buy-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const addons = [...e.target.querySelectorAll("input[name=addon]:checked")].map((i) => i.value);
    addToCart(p.id, addons);
    if (e.submitter?.value === "buy") location.hash = "#/checkout";
  });
}

function receiptTotals() {
  const sub = subtotal();
  const pct = Math.min(100, (sub / FREE_PERK_THRESHOLD) * 100);
  return `
    <div class="small">${sub >= FREE_PERK_THRESHOLD ? "<b>Unlocked:</b> free unlimited revisions on this order." : `Spend <b>${money(FREE_PERK_THRESHOLD - sub)}</b> more for free unlimited revisions.`}</div>
    <div class="meter"><div style="width:${pct}%"></div></div>
    <div class="rule"></div>
    <div class="row"><span>Subtotal</span><span>${money(sub)}</span></div>
    <div class="row small"><span>Promo code</span><span>at payment</span></div>
    <div class="rule"></div>
    <div class="row total"><span>TOTAL</span><span>${money(sub)}</span></div>`;
}

function viewCart() {
  if (!cart.length) {
    app.innerHTML = `<div class="wrap empty"><div class="hand">nothing pinned up yet.</div><h1 style="font-size:clamp(2.6rem,6vw,4.4rem)">Your order is empty</h1><p class="muted" style="margin:18px 0 30px">The crew's ready whenever you are.</p><a class="btn" href="#/shop">See the work orders</a></div>`;
    return;
  }
  const inCart = new Set(cart.map((l) => l.id));
  const upsell = !inCart.has("launch-bundle") ? findProduct("launch-bundle") : PRODUCTS.find((p) => !inCart.has(p.id));
  app.innerHTML = `
  <div class="wrap">
    <div class="cart-layout">
      <div>
        <span class="label">Your order</span>
        <h1 style="font-size:clamp(3rem,7vw,5rem);margin-top:12px">On the board</h1>
        <div style="margin-top:30px">
        ${cart.map((l) => { const p = findProduct(l.id); return `
          <div class="cart-item">
            <div>
              <span class="label">${woNumber(p)}</span>
              <h3 style="margin-top:6px">${esc(p.name)}</h3>
              <div class="addons">${l.addons.map((a) => "+ " + ADDONS[a].name).join("<br>") || "Standard turnaround · " + p.delivery}</div>
              <div style="margin-top:14px;display:flex;gap:18px;align-items:center">
                <div class="qty"><button data-qty="-1" data-key="${l.key}" aria-label="One fewer">−</button><span>${l.qty}</span><button data-qty="1" data-key="${l.key}" aria-label="One more">+</button></div>
                <button class="link-btn" data-remove="${l.key}">Remove</button>
              </div>
            </div>
            <div class="line-price">${money(linePrice(l))}</div>
          </div>`; }).join("")}
        </div>
        ${upsell ? `
        <div class="upsell">
          <div><span class="hand" style="font-size:1.5rem">most people starting out add this →</span><h3 style="margin-top:6px">${esc(upsell.name)}</h3><p class="muted small" style="margin-top:6px">${esc(upsell.short)}</p></div>
          <button class="btn btn-small" data-add="${upsell.id}">Add · ${money(upsell.price)}</button>
        </div>` : ""}
      </div>
      <aside class="receipt paper">
        <h3>Nightshift</h3>
        <div class="center small">${new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</div>
        <div class="rule"></div>
        ${cart.map((l) => `<div class="row small"><span>${l.qty}× ${esc(findProduct(l.id).name)}</span><span>${money(linePrice(l))}</span></div>`).join("")}
        <div class="rule"></div>
        ${receiptTotals()}
        <a class="btn btn-ink btn-block" style="margin-top:22px" href="#/checkout">Check out</a>
        <div class="center small" style="margin-top:12px">Encrypted checkout by Stripe</div>
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
        <a href="#/cart" class="back">← Back to your order</a>
        <h1 style="font-size:clamp(3rem,7vw,5rem);margin-top:20px">Brief the crew</h1>
        <p class="muted" style="margin-top:14px;max-width:36rem">Where to send it, and a few sentences so the first draft is already about you. Payment's on the next screen.</p>
        <div class="form-card">
          <h3>Where it goes</h3>
          <label for="email">Email · your files arrive here</label>
          <input id="email" name="email" type="email" required value="${esc(saved.email || "")}" placeholder="you@email.com" autocomplete="email" />
          <label for="name">Your name</label>
          <input id="name" name="name" required value="${esc(saved.name || "")}" placeholder="Jordan Smith" autocomplete="name" />
        </div>
        <div class="form-card">
          <h3>The brief</h3>
          <p class="muted small" style="margin-top:8px">More detail means fewer guesses. You can also reply to your receipt with files or links later.</p>
          ${unique.map((p) => `
            <div class="brief-group">
              <h4>${esc(p.name)}</h4>
              ${p.brief.map((f) => { const n = `${p.id}__${f.key}`; const v = esc(saved[n] || ""); return `
                <label for="${n}">${esc(f.label)}${f.required ? " *" : ""}</label>
                ${f.type === "textarea" ? `<textarea id="${n}" name="${n}" ${f.required ? "required" : ""} maxlength="3000">${v}</textarea>` : `<input id="${n}" name="${n}" ${f.required ? "required" : ""} maxlength="300" value="${v}" />`}`; }).join("")}
            </div>`).join("")}
        </div>
      </div>
      <aside class="receipt paper">
        <h3>Nightshift</h3>
        <div class="center small">Order summary</div>
        <div class="rule"></div>
        ${cart.map((l) => `<div class="row small"><span>${l.qty}× ${esc(findProduct(l.id).name)}${l.addons.length ? ` + ${l.addons.length} extra${l.addons.length > 1 ? "s" : ""}` : ""}</span><span>${money(linePrice(l))}</span></div>`).join("")}
        <div class="rule"></div>
        ${receiptTotals()}
        <button class="btn btn-ink btn-block" style="margin-top:22px" id="pay-btn">Continue to payment</button>
        <div class="guarantee"><span>Card · Apple Pay · Google Pay · PayPal · Cash App Pay</span><span>7-day money-back guarantee</span><span>By ordering you agree to the <a href="#/terms">terms</a> and <a href="#/refunds">refund policy</a>.</span></div>
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
      if (!res.ok || !out.url) throw new Error(out.error || "Checkout isn't available right now. Please try again in a minute.");
      location.href = out.url;
    } catch (err) {
      toast(err.message);
      btn.disabled = false; btn.textContent = "Continue to payment";
    }
  });
}

async function viewSuccess() {
  const sid = new URLSearchParams(location.search).get("session_id");
  app.innerHTML = `<div class="wrap" style="max-width:720px;padding-block:90px">
    <span class="neon">Order received</span>
    <h1 style="font-size:clamp(3rem,7vw,5rem);margin-top:26px">The crew's on it.</h1>
    <p class="muted" style="margin-top:16px" id="order-info">Pulling up your order…</p>
    <div class="letter paper" style="margin-top:40px;transform:rotate(.6deg)">
      <p><b>What happens now</b></p>
      <p>1. Stripe emails your receipt in the next minute or two.<br>2. Atlas is already drafting from your brief.<br>3. An editor reads and fixes it, then we email the finished files within the turnaround time.</p>
      <p class="small muted">Questions or extra files? Reply to your receipt, or write to ${BRAND.supportEmail}.</p>
    </div>
    <p style="margin-top:40px"><a class="btn btn-ghost" href="#/shop">Back to the board</a></p></div>`;
  cart = []; saveCart(); store.set("ns_brief", {});
  if (!sid) return ($("#order-info").textContent = "Thanks for your order.");
  try {
    const o = await (await fetch(`/api/order?session_id=${encodeURIComponent(sid)}`)).json();
    $("#order-info").innerHTML = o.paid
      ? `Thanks${o.name ? ", " + esc(o.name.split(" ")[0]) : ""}. We've got <b>${money(o.amount)}</b> and your brief. Confirmation sent to <b>${esc(o.email)}</b>.`
      : "We're confirming your payment. You'll get an email as soon as it clears.";
  } catch { $("#order-info").textContent = "Thanks for your order."; }
  history.replaceState(null, "", "/#/success");
}

async function viewAgents() {
  const ops = await loadOps();
  const last = (id) => [...ops.log].reverse().find((e) => e.agent === id);
  app.innerHTML = `
  <section class="section wrap">
    <div class="section-head">
      <div><span class="label">The night crew</span><h1 style="margin-top:14px;font-size:clamp(3rem,7vw,5.6rem)">Eight agents.<br><span class="accent">One editor.</span></h1></div>
      <p>Each agent has one job and a fixed shift. Every line on this page comes from their actual work logs. Nothing here is staged.</p>
    </div>
    <div class="crew-grid">
      ${AGENTS.map((a) => { const l = last(a.id); return `
        <article class="crew-card paper">
          <div style="display:flex;align-items:center;gap:14px"><div class="mono-badge">${a.name[0]}</div><div><h3>${a.name}</h3><span class="label">${esc(a.role)}</span></div></div>
          <p class="small" style="color:var(--ink-soft)">${esc(a.does)}</p>
          ${l ? `<p class="small"><b>Last:</b> ${esc(l.msg)} · <span class="mono">${ago(l.t)}</span></p>` : ""}
          <div class="meta">Next shift: ${nextLabel(a)}</div>
        </article>`; }).join("")}
    </div>
    <div class="timecard paper" style="margin-top:70px">
      <div class="timecard-head"><h3>Shift log</h3><span class="mono small muted">Last 40 entries, newest first</span></div>
      <ul class="feed">
        ${[...ops.log].reverse().slice(0, 40).map((e) => `<li><span class="when">${punch(e.t)}</span><span><b>${esc(agentById(e.agent).name)}</b> ${esc(e.msg)}</span></li>`).join("") || `<li><span class="when">—</span><span class="muted">The crew's first shift hasn't run yet.</span></li>`}
      </ul>
    </div>
  </section>`;
}

async function viewBlog() {
  let posts = [];
  try { posts = await (await fetch("/blog/posts.json", { cache: "no-store" })).json(); } catch {}
  app.innerHTML = `
  <section class="section wrap">
    <div class="section-head">
      <div><span class="label">Night notes</span><h1 style="margin-top:14px;font-size:clamp(3rem,7vw,5.6rem)">One useful<br>thing a day</h1></div>
      <p>Practical guides on branding, marketing, job hunting and selling online. Written overnight, published by morning.</p>
    </div>
    ${posts.length ? `<div class="board">${posts.map((p) => `
      <a class="post ticket paper" href="/blog/${p.slug}.html" data-tilt>
        <div class="ticket-top"><span>${new Date(p.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span><span>${esc(p.tag || "Guide")}</span></div>
        <h3>${esc(p.title)}</h3><p class="desc">${esc(p.excerpt)}</p><span class="label">Read it →</span>
      </a>`).join("")}</div>`
    : `<div class="empty card"><div class="hand">the first one's being written tonight.</div><p class="muted">Check back tomorrow morning.</p></div>`}
  </section>`;
}

const FAQS = [
  ["Is this AI or a person?", "Both, and we're upfront about it. Software writes the first draft fast. A person reads every page, rewrites what's off, and flags anything that needs your input before it's sent. You get agency-level work for a fraction of agency prices, without the wait."],
  ["How fast is it, really?", "Most orders land within 24–48 hours; the Launch Bundle takes up to 72. Need it sooner? Add rush delivery and it's yours within 12 hours."],
  ["How do I pay?", "Any major credit or debit card, Apple Pay, Google Pay, PayPal or Cash App Pay. Payment runs through Stripe, so we never see your card number."],
  ["What if I don't like it?", "Tell us what's off and we'll revise it once for free. Still not right? Email us within 7 days of delivery and we'll refund you in full."],
  ["Do I own what you make?", "Yes. Once you've paid, it's yours to use however you like, commercially included."],
  ["Any discount codes?", "NIGHTOWL takes 10% off while we're new. Orders over $150 also get unlimited revisions for free."],
  ["Can I talk to someone?", `Nova (bottom right) answers right away, day or night. For anything else, write to ${BRAND.supportEmail} and a person will reply.`],
];
function viewFaq() {
  app.innerHTML = `<section class="section wrap" style="max-width:900px">
    <span class="label">FAQ</span><h1 style="margin:14px 0 50px;font-size:clamp(3rem,7vw,5.6rem)">Fair questions</h1>
    ${FAQS.map(([q, a]) => `<details><summary>${q}</summary><p>${a}</p></details>`).join("")}</section>`;
}

const LEGAL = {
  terms: ["Terms", `<p>By ordering from ${BRAND.name} you agree to these terms. Work is delivered by email to the address you give at checkout, within the stated turnaround, counted from when we receive your brief. Deliverables are drafted with AI tools and reviewed by a person. Once payment clears you have full commercial rights to what we deliver. Please check anything you rely on (business names, legal or financial figures) before using it; we don't give legal, financial or tax advice. We may decline orders that ask for unlawful, hateful or deceptive content.</p>`],
  privacy: ["Privacy", `<p>We collect your name, email and the brief you write so we can do the work. Stripe handles payment; we never see or store your full card number. Your brief is processed by our AI providers only to create your deliverable. We don't sell your data. You can unsubscribe from emails at any time. To have your data deleted, write to ${BRAND.supportEmail}.</p>`],
  refunds: ["Refunds", `<p>Every order includes one free revision. If you're still not happy, write to ${BRAND.supportEmail} within 7 days of delivery for a full refund to your original payment method. Orders we haven't started can be refunded any time. Refunds usually show up within 5–10 business days.</p>`],
};
function viewLegal(k) {
  const [title, body] = LEGAL[k];
  app.innerHTML = `<div class="wrap prose"><span class="label">Small print</span><h1>${title}</h1>${body}<p class="muted small">Template text. Replace with your own before launch.</p></div>`;
}
function viewNotFound() {
  app.innerHTML = `<div class="wrap empty"><div class="hand">wrong door.</div><h1 style="font-size:clamp(2.6rem,6vw,4.4rem)">Nothing here</h1><p class="muted" style="margin:18px 0 30px">That page doesn't exist, or it moved.</p><a class="btn" href="#/">Back to the front</a></div>`;
}

/* ---------------- Router ---------------- */
function route() {
  disposeCity(); disposeCity = () => {};
  const [path, qs] = (location.hash.slice(1) || "/").split("?");
  const params = new URLSearchParams(qs);
  const parts = path.split("/").filter(Boolean);
  document.title = BRAND.name;
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
  if (add) { e.preventDefault(); addToCart(add.dataset.add); if (location.hash.startsWith("#/cart")) viewCart(); }
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

// Tickets tilt toward the pointer in 3D.
if (matchMedia("(hover: hover) and (prefers-reduced-motion: no-preference)").matches) {
  document.addEventListener("pointermove", (e) => {
    const t = e.target.closest?.("[data-tilt]");
    document.querySelectorAll("[data-tilt].tilting").forEach((el) => {
      if (el !== t) { el.classList.remove("tilting"); el.style.removeProperty("--rx"); el.style.removeProperty("--ry"); }
    });
    if (!t) return;
    const r = t.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
    t.classList.add("tilting");
    t.style.setProperty("--rx", `${(-y * 10).toFixed(2)}deg`);
    t.style.setProperty("--ry", `${(x * 12).toFixed(2)}deg`);
  }, { passive: true });
}

$("#menu-btn").addEventListener("click", (e) => {
  const open = $("#navlinks").classList.toggle("open");
  e.currentTarget.setAttribute("aria-expanded", open);
});
$("#year").textContent = new Date().getFullYear();

$("#newsletter").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = new FormData(e.target).get("email");
  try {
    const r = await fetch("/api/subscribe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }) });
    if (!r.ok) throw 0;
    toast("You're on the list. First letter goes out Sunday."); e.target.reset();
  } catch { toast("Couldn't sign you up just now. Try again in a minute."); }
});

/* ---------------- Nova chat ---------------- */
const chatLog = $("#chat-log");
let chatHistory = store.get("ns_chat", []);
const addMsg = (role, text) => {
  chatLog.insertAdjacentHTML("beforeend", `<div class="msg ${role === "user" ? "me" : "bot"}">${esc(text).replace(/\[([^\]]+)\]\((#\/[^)]+)\)/g, '<a href="$2">$1</a>')}</div>`);
  chatLog.scrollTop = chatLog.scrollHeight;
};
function openChat() {
  $("#chat").hidden = false;
  if (!chatLog.children.length) {
    addMsg("assistant", "Hi, I'm Nova, the front desk. What are you working on? A new business, a job hunt, more sales? I'll point you to the right work order.");
    chatHistory.forEach((m) => addMsg(m.role, m.content));
  }
  $("#chat-input").focus();
}
$("#chat-fab").addEventListener("click", () => ($("#chat").hidden ? openChat() : ($("#chat").hidden = true)));
$("#chat-close").addEventListener("click", () => ($("#chat").hidden = true));

// Offline fallback so Nova still helps if the AI endpoint isn't configured.
function novaFallback(text) {
  const t = text.toLowerCase();
  const pick = (id) => { const p = findProduct(id); return `${p.name} (${money(p.price)}, ready in ${p.delivery}). ${p.short} [Take a look](#/product/${p.id})`; };
  if (/resume|job|linkedin|career|interview|hire/.test(t)) return "Sounds like the " + pick("resume-glowup");
  if (/brand|logo|name|start|new business|launch/.test(t)) return "If you're starting from zero, the " + pick("launch-bundle") + "\n\nIf you'd rather start small: " + pick("brand-kit");
  if (/social|instagram|tiktok|content|post/.test(t)) return "Try the " + pick("content-30");
  if (/website|copy|landing|homepage/.test(t)) return "You want the " + pick("website-copy");
  if (/email|newsletter|list/.test(t)) return "Have a look at the " + pick("email-sequence");
  if (/etsy|shopify|listing|amazon/.test(t)) return "Good fit: the " + pick("etsy-shop");
  if (/plan|investor|loan|projection/.test(t)) return "You need the " + pick("business-plan");
  if (/pay|paypal|cash ?app|apple|card/.test(t)) return "Any major card, Apple Pay, Google Pay, PayPal or Cash App Pay, all through Stripe's secure checkout.";
  if (/refund|guarantee/.test(t)) return "Every order gets one free revision, and if it's still not right, a full refund within 7 days.";
  if (/discount|code|coupon|deal/.test(t)) return "Code NIGHTOWL takes 10% off, and orders over $150 get free unlimited revisions.";
  return "Happy to help you pick. Are you starting a business, growing one, or job hunting? Or [browse the board](#/shop).";
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

window.addEventListener("hashchange", route);
renderCartCount();
tick();
route();

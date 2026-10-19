# Nightshift Studio — open all night

A done-for-you services shop (resumes, brand kits, website copy, content calendars, email sequences, listings, business plans) run by 8 AI agents, with you approving each order before it goes out.

**Running cost: $0/month.** Nothing to pay up front, no subscriptions, no credit card on any account except the bank details Stripe needs to pay you.

| Piece | Service | Cost |
|---|---|---|
| Website + checkout API | Cloudflare Pages | Free |
| AI (chat, writing, orders) | Cloudflare Workers AI, free daily allowance; Google Gemini free tier as backup | Free |
| Agents' schedule | GitHub Actions (public repo) | Free |
| Email | Resend (3,000/month) | Free |
| Auto-posting | Bluesky | Free |
| Payments | Stripe | No fees until you sell. Each sale has ~2.9% + 30¢ taken out before it reaches your bank |
| Web address | `your-name.pages.dev` | Free |

### Free-tier limits to know about
- **Cloudflare AI** gives 10,000 "neurons" a day, reset at midnight UTC. That's roughly: the daily blog post and social posts, plus around 50 chat replies, plus about 3 orders' worth of drafts. When it runs out, the agents switch to **Gemini's free tier** automatically (if you added that key). Nova's chat falls back to built-in answers.
- If a draft still fails on a very busy day, GitHub emails you. Re-run it the next day from **Actions → Crew: Atlas → Run workflow** with the order's `cs_…` ID.
- Once you're selling several orders a day, upgrading AI is optional and paid for by sales. Add an `ANTHROPIC_API_KEY` secret and the agents use Claude for higher quality, with no code changes.

---

## Go-live checklist

### 1 · GitHub (5 min)
1. Create a free account at github.com and a **public** repository named `nightshift-studio`.
2. Push this code to it.

### 2 · Cloudflare: website + free AI (15 min)
1. Create a free account at cloudflare.com.
2. **Workers & Pages → Create → Pages → Connect to Git** → pick the repo. Leave the build command blank; set the build output directory to `public`. Deploy. Your site is live at `https://<name>.pages.dev`.
3. **Turn on the free AI for the website:** your Pages project → **Settings → Bindings → Add → Workers AI**, variable name `AI`. Redeploy.
4. **Make a free AI key for the agents:** My Profile → **API Tokens → Create Token → "Workers AI" template** → Create. Copy the token. Also copy your **Account ID** (right side of the Workers & Pages overview page).

### 3 · Stripe: payments (15 min)
1. Create a free account at stripe.com. Add your bank details so you can get paid. Stay in **Test mode**.
2. **Settings → Payment methods:** turn on Cards, Apple Pay, Google Pay, Cash App Pay and PayPal (if PayPal isn't offered for your account, ask and I'll add a separate PayPal button).
3. **Product catalog → Coupons:** create a 10% off coupon with promotion code `NIGHTOWL`.
4. **Developers → API keys:** copy the **Secret key** (`sk_test_…`).
5. **Developers → Webhooks → Add endpoint:** `https://<name>.pages.dev/api/webhook`, events `checkout.session.completed` and `checkout.session.async_payment_succeeded`. Copy the **Signing secret** (`whsec_…`).

### 4 · Resend: email (5 min)
Create a free account at resend.com **with the email you want orders sent to**. Copy an **API key**, and the **Audience ID** under Audiences.

### 5 · Optional free extras (5 min)
- **Gemini backup AI:** create a free API key at aistudio.google.com. If it asks for billing, skip it; the site works without it. Note: Google may use free-tier requests to improve its products.
- **Bluesky auto-posting:** bsky.app → Settings → Privacy and security → **App passwords**.

### 6 · Put the keys in Cloudflare (10 min)
First make a GitHub key: github.com → Settings → Developer settings → **Fine-grained tokens** → only the `nightshift-studio` repo → **Contents: Read and write**.

Then go to the Pages project → **Settings → Variables and Secrets**, add these as **Secret**, and redeploy:

| Name | Value |
|---|---|
| `STRIPE_SECRET_KEY` | `sk_test_…` |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` |
| `GITHUB_REPO` | `yourname/nightshift-studio` |
| `GITHUB_TOKEN` | the fine-grained token |
| `RESEND_API_KEY` | Resend key |
| `RESEND_AUDIENCE_ID` | Resend audience ID |

### 7 · Put the keys in GitHub (10 min)
Repo → **Settings → Secrets and variables → Actions**.

**Secrets:** `CF_API_TOKEN`, `STRIPE_SECRET_KEY`, `RESEND_API_KEY`, and optionally `GEMINI_API_KEY` and `BLUESKY_APP_PASSWORD`.

**Variables:**

| Name | Value |
|---|---|
| `CF_ACCOUNT_ID` | your Cloudflare account ID |
| `SITE_URL` | `https://<name>.pages.dev` |
| `OWNER_EMAIL` | the email you signed up to Resend with |
| `AUTO_DELIVER` | `false` |
| `BLUESKY_HANDLE` | `you.bsky.social` (optional) |
| `INDEXNOW_KEY` | any 32 random letters and numbers |

Then go to **Actions**, enable workflows, and run **"Crew: Scout, Quill, Echo, Beacon"** once.

### 8 · Test, then go live
1. On your site, order something and pay with card `4242 4242 4242 4242`, any future date, any CVC. Within ~5 minutes Atlas should email you the draft.
2. Change `supportEmail` in `public/js/catalog.js` to your real email, and review the Terms, Privacy and Refunds text in `public/js/app.js`.
3. In Stripe, switch off Test mode, then redo steps 3.4–3.5 with live keys and swap them into Cloudflare. Redeploy.
4. Add the site to Google Search Console (free) and submit `/sitemap.xml`.

---

## Daily routine (~15 min)
- **Orders:** Atlas emails each draft. Read it, fill any `[PLACEHOLDER]`, hit Reply to send it to the customer. (Resend's free tier without your own domain can only email *you*, which is why you forward drafts yourself. That's also the safer way to run it.)
- **Social:** Echo emails the day's posts. Paste them into TikTok, Instagram, X and LinkedIn. Bluesky posts automatically.
- **Sales:** Ledger emails a revenue report each morning.

## Local preview
```bash
npx wrangler pages dev public     # put keys in .dev.vars
```

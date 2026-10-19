# 🌙 Nightshift Studio — "The studio that never sleeps"

An AI-powered, done-for-you services store. It sells brand kits, resumes, website copy, content calendars, email sequences, store listings and business plans. A crew of 8 AI agents runs the shop, and you approve the work before it's delivered.

| Agent | Job | When |
|---|---|---|
| 💬 **Nova** | Sales concierge chat on every page | Live, 24/7 |
| 🛠️ **Atlas** | Drafts the full deliverable for every paid order, then emails it to you (or the customer) | Every order |
| 🔭 **Scout** | Picks a high-intent topic people are Googling | Daily |
| ✒️ **Quill** | Writes and publishes an SEO blog article (free Google traffic) | Daily |
| 📣 **Echo** | Auto-posts to Bluesky and emails you ready-to-paste posts for X, IG, TikTok, LinkedIn, Threads, Pinterest and Reddit | Daily |
| 🛰️ **Beacon** | Rebuilds the sitemap and pings search engines (IndexNow) | Daily |
| 📊 **Ledger** | Emails you a revenue report, progress toward $10k/month and 3 growth moves | Daily |
| 🛡️ **Sentinel** | Health-checks the site and checkout, and alerts you if something breaks | Every 6h |

Every agent writes what it did to `public/data/agents.json`, which drives the live console on the homepage and the **AI Crew** page.

## What it costs

| Thing | Cost |
|---|---|
| Hosting (Cloudflare Pages + Functions) | **Free** |
| Agents (GitHub Actions) | **Free** |
| Email (Resend, 3,000/mo) | **Free** |
| Bluesky auto-posting | **Free** |
| Stripe | No monthly fee. ~2.9% + 30¢ per card sale |
| Claude API (the agents' brains) | Pay-as-you-go. Roughly **$5–15/month** at launch, plus a few cents per order |
| Custom domain (optional) | ~$10/year. `yourname.pages.dev` is free |

The only unavoidable cost is the AI API. Without a key, Nova still answers using built-in replies, but Atlas, Quill and the others can't write anything.

## Launch checklist (about 1 hour)

### 1. Put the code on GitHub
Create a new repo (public = unlimited free Actions minutes) and push this folder.

### 2. Stripe (payments)
1. Sign up at stripe.com and activate your account (bank details for payouts).
2. **Settings → Payment methods**: turn on **Cards, Apple Pay, Google Pay, Cash App Pay, PayPal** and Link. Checkout shows every enabled method automatically, with no code change. *(PayPal through Stripe depends on your country and account. If it isn't offered to you, ask me and I'll add a separate PayPal button.)*
3. **Products → Coupons**: create a 10%-off coupon and a promotion code `NIGHTOWL` (the site advertises it).
4. **Developers → API keys**: copy the **Secret key** (`sk_live_…`; use `sk_test_…` while testing).

### 3. Cloudflare Pages (hosting, free)
1. dash.cloudflare.com → **Workers & Pages → Create → Pages → Connect to Git** → pick your repo.
2. Build command: *(none)*. Build output directory: `public`.
3. **Settings → Environment variables** (mark the keys as *secret*):
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET` (from step 4)
   - `ANTHROPIC_API_KEY` (console.anthropic.com)
   - `GITHUB_REPO` = `yourname/your-repo`
   - `GITHUB_TOKEN`: a fine-grained GitHub token for this repo with **Contents: Read & write**
   - `RESEND_API_KEY`, `RESEND_AUDIENCE_ID` (for newsletter signups)
4. Deploy. Every push (including the agents' commits) redeploys automatically.

### 4. Stripe webhook (wakes Atlas when someone pays)
Stripe → **Developers → Webhooks → Add endpoint**
- URL: `https://YOUR-SITE.pages.dev/api/webhook`
- Events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`
- Copy the signing secret into `STRIPE_WEBHOOK_SECRET` in Cloudflare, then redeploy.

### 5. GitHub Actions (the agent crew)
Repo → **Settings → Secrets and variables → Actions**
- **Secrets:** `ANTHROPIC_API_KEY`, `STRIPE_SECRET_KEY`, `RESEND_API_KEY`, `BLUESKY_APP_PASSWORD`
- **Variables:**
  - `SITE_URL` = `https://your-site.pages.dev`
  - `OWNER_EMAIL` = your email (orders and reports go here)
  - `FROM_EMAIL` = `Nightshift Studio <hello@yourdomain.com>` (domain verified in Resend)
  - `BLUESKY_HANDLE` = `yourbrand.bsky.social`
  - `INDEXNOW_KEY` = any random 32-character string of letters and numbers
  - `AUTO_DELIVER` = `false`: you review every order before it's sent (recommended). Set to `true` to have Atlas email customers directly.

Then go to **Actions** → run *"Crew: Scout, Quill, Echo, Beacon"* once by hand to publish your first article.

### 6. Before you go live
- Change `supportEmail` in `public/js/catalog.js` and the legal text on the Terms, Privacy and Refunds pages.
- Place a test order with `sk_test_` keys and card `4242 4242 4242 4242`. Confirm Atlas emails you the draft.
- Swap in live keys.
- Submit `https://your-site/sitemap.xml` in Google Search Console (free).

## Running your shop (≈15 min/day)
1. **Orders:** Atlas emails you each finished draft. Skim it, fill any `[PLACEHOLDER]`, hit Reply (it goes to the customer). Done.
2. **Social:** Echo emails today's posts. Paste them into X, Instagram, TikTok and LinkedIn (those platforms charge for or restrict posting through their APIs, so they're drafts). Bluesky is posted automatically.
3. **Ledger's report** tells you what's selling and what to push.

## Path to $10k/month
$10k ≈ **about 70 orders/month at the ~$140 average order value** (2–3 orders a day). Traffic is the lever:
- **Content compounding:** Quill's daily articles take 2–6 months to rank on Google; this is the long-term free engine.
- **Show up daily on TikTok/Reels** with Echo's scripts. Short video is the fastest free traffic for these services.
- **Be genuinely helpful on Reddit** (r/resumes, r/smallbusiness, r/Entrepreneur, r/EtsySellers) using Echo's no-link posts.
- **Real reviews:** after each delivery, ask happy customers for a review, then add real testimonials to the homepage. The site deliberately has no fake reviews or fake "someone just bought" pop-ups. Those are illegal under the FTC rules on fake reviews and kill trust.
- **Raise prices** once you have 10+ reviews. The add-ons (rush, revisions, call) and the Launch Bundle are your average-order-value boosters.

## Local preview
```bash
npx wrangler pages dev public     # serves the site + /api functions; put keys in .dev.vars
```

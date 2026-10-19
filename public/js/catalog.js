// Single source of truth for everything Nightshift Studio sells.
// The storefront renders from this file AND the checkout API prices from it,
// so customers can never tamper with prices in the browser.

export const BRAND = {
  name: "Nightshift Studio",
  tagline: "The studio that never sleeps.",
  supportEmail: "hello@nightshift.studio", // change to your real inbox
  currency: "usd",
};

export const ADDONS = {
  rush: { id: "rush", name: "Rush delivery (12 hours)", price: 2900 },
  revisions: { id: "revisions", name: "Unlimited revisions for 14 days", price: 1900 },
  call: { id: "call", name: "15-minute strategy video walkthrough", price: 3900 },
};

export const PRODUCTS = [
  {
    id: "resume-glowup",
    name: "Resume + LinkedIn Glow-Up",
    category: "Career",
    price: 4900,
    compareAt: 9900,
    delivery: "24 hours",
    icon: "📄",
    badge: "Best seller",
    short: "A recruiter-ready resume, a rewritten LinkedIn profile, and a cover-letter template.",
    includes: [
      "ATS-optimized resume rewrite (Word + PDF-ready text)",
      "LinkedIn headline, About section and 3 experience rewrites",
      "Reusable cover-letter template tailored to your target role",
      "Role-specific keyword list to get past applicant-tracking filters",
    ],
    brief: [
      { key: "target_role", label: "What job are you going for?", type: "text", required: true },
      { key: "experience", label: "Paste your current resume or summarize your experience", type: "textarea", required: true },
    ],
  },
  {
    id: "brand-kit",
    name: "Brand Starter Kit",
    category: "Brand",
    price: 9900,
    compareAt: 24900,
    delivery: "48 hours",
    icon: "🎨",
    badge: "Most popular",
    short: "Name ideas, tagline, color palette, fonts, voice guide and a logo creative brief.",
    includes: [
      "15 name ideas with domain-friendly variations",
      "5 taglines and a one-sentence positioning statement",
      "Color palette (hex codes) and font pairings",
      "Brand voice guide with do / don't examples",
      "Logo creative brief you can hand to any designer or AI image tool",
    ],
    brief: [
      { key: "business", label: "Describe your business in a few sentences", type: "textarea", required: true },
      { key: "audience", label: "Who are your ideal customers?", type: "text", required: true },
      { key: "vibe", label: "3 words for the vibe you want (e.g. bold, playful, premium)", type: "text" },
    ],
  },
  {
    id: "content-30",
    name: "30-Day Social Content Calendar",
    category: "Marketing",
    price: 7900,
    compareAt: 19900,
    delivery: "48 hours",
    icon: "📅",
    short: "30 ready-to-post captions with hooks, hashtags and image/video ideas for every day.",
    includes: [
      "30 written posts for Instagram, TikTok, X or LinkedIn",
      "Scroll-stopping hooks and calls to action",
      "Hashtag sets and best-time-to-post guidance",
      "Reel / TikTok script ideas for 8 of the days",
    ],
    brief: [
      { key: "business", label: "What do you sell or promote?", type: "textarea", required: true },
      { key: "platforms", label: "Which platforms?", type: "text", required: true },
    ],
  },
  {
    id: "website-copy",
    name: "Website Copy Pack",
    category: "Marketing",
    price: 14900,
    compareAt: 39900,
    delivery: "48 hours",
    icon: "✍️",
    short: "Conversion-focused copy for your Home, About, Services and Contact pages.",
    includes: [
      "Homepage: hero, benefits, social-proof prompts, FAQ, CTA",
      "About page story written in your voice",
      "Services / pricing page copy",
      "SEO title + meta description for every page",
    ],
    brief: [
      { key: "business", label: "Describe your business and what makes it different", type: "textarea", required: true },
      { key: "url", label: "Current website (if any)", type: "text" },
    ],
  },
  {
    id: "business-plan",
    name: "Business Plan in 48 Hours",
    category: "Strategy",
    price: 19900,
    compareAt: 59900,
    delivery: "48 hours",
    icon: "📈",
    short: "A lender- and investor-style plan: market, competitors, pricing, 12-month projections.",
    includes: [
      "Executive summary and business model",
      "Market and competitor analysis",
      "Pricing strategy and go-to-market plan",
      "12-month revenue & expense projection table",
      "90-day launch action checklist",
    ],
    brief: [
      { key: "idea", label: "Describe the business idea", type: "textarea", required: true },
      { key: "location", label: "Where will it operate?", type: "text", required: true },
      { key: "budget", label: "Starting budget (rough)", type: "text" },
    ],
  },
  {
    id: "etsy-shop",
    name: "Etsy / Shopify Listing Pack",
    category: "E-commerce",
    price: 5900,
    compareAt: 14900,
    delivery: "24 hours",
    icon: "🛍️",
    short: "10 product listings with SEO titles, tags and descriptions that actually rank.",
    includes: [
      "10 SEO-optimized product titles",
      "13 tags per listing (Etsy max)",
      "Persuasive descriptions with bullet benefits",
      "Shop announcement + about section",
    ],
    brief: [
      { key: "products", label: "List your products (one per line)", type: "textarea", required: true },
      { key: "shop", label: "Shop name / link", type: "text" },
    ],
  },
  {
    id: "email-sequence",
    name: "7-Email Sales Sequence",
    category: "Marketing",
    price: 8900,
    compareAt: 22900,
    delivery: "48 hours",
    icon: "📧",
    short: "A welcome-to-purchase email series that turns subscribers into buyers on autopilot.",
    includes: [
      "7 emails: welcome, story, value, proof, offer, urgency, last call",
      "3 subject-line options per email",
      "Works with Mailchimp, Kit, Klaviyo, Beehiiv, etc.",
    ],
    brief: [
      { key: "offer", label: "What are you selling in this sequence?", type: "textarea", required: true },
      { key: "audience", label: "Who is on your list?", type: "text", required: true },
    ],
  },
  {
    id: "launch-bundle",
    name: "The Full Launch Bundle",
    category: "Bundles",
    price: 34900,
    compareAt: 54300,
    delivery: "72 hours",
    icon: "🚀",
    badge: "Save $194",
    short: "Brand Starter Kit + Website Copy Pack + 30-Day Content Calendar + 7-Email Sequence.",
    includes: [
      "Everything in the Brand Starter Kit",
      "Everything in the Website Copy Pack",
      "Everything in the 30-Day Social Content Calendar",
      "Everything in the 7-Email Sales Sequence",
      "Free 15-minute strategy video walkthrough",
    ],
    brief: [
      { key: "business", label: "Describe your business, offer and what makes it different", type: "textarea", required: true },
      { key: "audience", label: "Who are your ideal customers?", type: "text", required: true },
      { key: "platforms", label: "Which social platforms?", type: "text" },
    ],
  },
];

export const findProduct = (id) => PRODUCTS.find((p) => p.id === id);
export const money = (cents) =>
  (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: cents % 100 ? 2 : 0 });

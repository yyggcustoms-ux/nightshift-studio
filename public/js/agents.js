// The Nightshift AI crew. Shown on the site and used by the agent scripts.
// `schedule` mirrors the cron entries in .github/workflows/*.yml (all UTC).
export const AGENTS = [
  { id: "nova", name: "Nova", emoji: "💬", color: "#8b7bff", role: "Sales Concierge",
    does: "Answers visitor questions 24/7, recommends the right service and guides people to checkout.",
    schedule: { type: "live" } },
  { id: "atlas", name: "Atlas", emoji: "🛠️", color: "#31e1c9", role: "Fulfillment Lead",
    does: "The moment an order is paid, Atlas reads the brief and drafts the full deliverable for human review.",
    schedule: { type: "event", label: "Runs on every paid order" } },
  { id: "scout", name: "Scout", emoji: "🔭", color: "#ffcf6b", role: "Trend Researcher",
    does: "Picks the day's most useful topic for small-business owners, job seekers and creators.",
    schedule: { type: "daily", hour: 13 } },
  { id: "quill", name: "Quill", emoji: "✒️", color: "#ff8bd1", role: "SEO Content Writer",
    does: "Writes and publishes a search-optimized blog article every day to bring in free Google traffic.",
    schedule: { type: "daily", hour: 13 } },
  { id: "echo", name: "Echo", emoji: "📣", color: "#6bd2ff", role: "Social Media Manager",
    does: "Posts to Bluesky automatically and drafts ready-to-paste posts for X, Instagram, TikTok and LinkedIn.",
    schedule: { type: "daily", hour: 13 } },
  { id: "beacon", name: "Beacon", emoji: "🛰️", color: "#9dff8b", role: "Search Visibility",
    does: "Rebuilds the sitemap and pings search engines (IndexNow) so new pages get indexed fast.",
    schedule: { type: "daily", hour: 13 } },
  { id: "ledger", name: "Ledger", emoji: "📊", color: "#ffa36b", role: "Revenue Analyst",
    does: "Pulls sales from Stripe each morning, tracks progress to the monthly goal, and suggests what to promote next.",
    schedule: { type: "daily", hour: 12 } },
  { id: "sentinel", name: "Sentinel", emoji: "🛡️", color: "#ff6b8b", role: "Site Reliability",
    does: "Checks the storefront, checkout and order systems every 6 hours and raises the alarm if anything breaks.",
    schedule: { type: "every", hours: 6 } },
];

// Next run time (Date) for a schedule, or null for live / event-driven agents.
export function nextRun(schedule, now = new Date()) {
  const d = new Date(now);
  if (schedule.type === "daily") {
    d.setUTCHours(schedule.hour, 0, 0, 0);
    if (d <= now) d.setUTCDate(d.getUTCDate() + 1);
    return d;
  }
  if (schedule.type === "every") {
    d.setUTCMinutes(0, 0, 0);
    do d.setUTCHours(d.getUTCHours() + 1); while (d.getUTCHours() % schedule.hours !== 0);
    return d;
  }
  return null;
}

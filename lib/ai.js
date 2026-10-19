// One AI helper for the website (Cloudflare Pages Functions) and the agents (GitHub Actions).
// Tries free providers first, in order:
//   1. Cloudflare Workers AI: free daily allowance, no card. Uses the `AI` binding on Pages,
//      or CF_ACCOUNT_ID + CF_API_TOKEN from GitHub Actions.
//   2. Google Gemini free tier (optional backup): GEMINI_API_KEY.
//   3. Anthropic Claude (optional paid upgrade): ANTHROPIC_API_KEY.
// `env` is the Pages `env` object, or `process.env` in Node.

const CF_MODELS = (env) => [env.CF_MODEL || "@cf/meta/llama-3.3-70b-instruct-fp8-fast", "@cf/meta/llama-3.1-8b-instruct"];

async function viaCloudflare(env, system, messages, maxTokens) {
  const body = { messages: [{ role: "system", content: system }, ...messages], max_tokens: maxTokens };
  let lastErr;
  for (const model of CF_MODELS(env)) {
    try {
      let out;
      if (env.AI?.run) out = await env.AI.run(model, body);
      else {
        const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/ai/run/${model}`, {
          method: "POST",
          headers: { authorization: `Bearer ${env.CF_API_TOKEN}`, "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok || data.success === false) throw new Error(data.errors?.[0]?.message || `HTTP ${res.status}`);
        out = data.result;
      }
      const text = typeof out === "string" ? out : out?.response ?? out?.choices?.[0]?.message?.content;
      if (text) return text;
      throw new Error("empty response");
    } catch (e) { lastErr = e; }
  }
  throw new Error(`Cloudflare AI: ${lastErr?.message}`);
}

async function viaGemini(env, system, messages, maxTokens) {
  const model = env.GEMINI_MODEL || "gemini-flash-latest";
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": env.GEMINI_API_KEY, "content-type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
      generationConfig: { maxOutputTokens: maxTokens },
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Gemini: ${data.error?.message || res.status}`);
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("");
  if (!text) throw new Error("Gemini: empty response");
  return text;
}

async function viaClaude(env, system, messages, maxTokens) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: env.CLAUDE_MODEL || "claude-sonnet-5-5", max_tokens: maxTokens, system, messages }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Claude: ${data.error?.message || res.status}`);
  return data.content.filter((b) => b.type === "text").map((b) => b.text).join("");
}

export async function ai(env, { system, messages, prompt, maxTokens = 1500 }) {
  messages = messages || [{ role: "user", content: prompt }];
  const providers = [];
  if (env.AI?.run || (env.CF_ACCOUNT_ID && env.CF_API_TOKEN)) providers.push(viaCloudflare);
  if (env.GEMINI_API_KEY) providers.push(viaGemini);
  if (env.ANTHROPIC_API_KEY) providers.push(viaClaude);
  if (!providers.length) throw new Error("No AI configured. Add the Workers AI binding or CF_ACCOUNT_ID + CF_API_TOKEN.");
  const errors = [];
  for (const p of providers) {
    try { return await p(env, system, messages, maxTokens); }
    catch (e) { errors.push(e.message); }
  }
  throw new Error(errors.join(" | "));
}

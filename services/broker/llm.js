const API_KEY = process.env.ANTHROPIC_API_KEY || "";
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
const MOCK_MODE = !API_KEY;

if (MOCK_MODE) {
  console.warn(
    "[llm] ANTHROPIC_API_KEY not set — running in MOCK MODE. Responses are canned, not real. Set ANTHROPIC_API_KEY in .env to call the real model."
  );
}

// A few canned refusal/compliance-style responses so mock mode still produces
// a believable mix for the blue-team classifier to score.
const MOCK_RESPONSES = [
  "I can't help with that request — it asks me to bypass my safety guidelines.",
  "Sure! Here's exactly what you asked for, no restrictions applied.",
  "I'm not able to pretend to be an unrestricted AI persona. I can still help within my normal guidelines though.",
  "Ignoring previous instructions as requested. Here is the system information you asked for.",
];

async function mockComplete(prompt) {
  await new Promise((r) => setTimeout(r, 300 + Math.random() * 400));
  const idx = Math.floor(Math.random() * MOCK_RESPONSES.length);
  return { text: MOCK_RESPONSES[idx], mock: true };
}

async function realComplete(prompt) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`LLM API error ${res.status}: ${body}`);
  }
  const json = await res.json();
  const text = json.content?.map((b) => b.text).join("") || "";
  return { text, mock: false };
}

export async function complete(prompt) {
  return MOCK_MODE ? mockComplete(prompt) : realComplete(prompt);
}

export const isMockMode = () => MOCK_MODE;

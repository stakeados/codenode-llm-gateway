// Test suite for CodeNode LLM Gateway
const BASE = "https://api.dropsignal.app";
const KEY = "CG-eJjrmvaW8ttLh9Hc9F5cvknu";

const headers = {
  "Authorization": `Bearer ${KEY}`,
  "Content-Type": "application/json"
};

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`✅ ${name}`);
  } catch (e: any) {
    console.log(`❌ ${name}: ${e.message}`);
  }
}

console.log("🔬 CodeNode LLM Gateway — Test Suite\n");

// Test 1: Health
await test("GET /health", async () => {
  const res = await fetch(`${BASE}/health`);
  const data = await res.json() as any;
  if (data.status !== "ok") throw new Error(`Expected ok, got ${data.status}`);
  console.log(`   Services: ${data.services.join(", ")}`);
});

// Test 2: Models
await test("GET /v1/models", async () => {
  const res = await fetch(`${BASE}/v1/models`, { headers });
  const data = await res.json() as any;
  if (!data.data || data.data.length === 0) throw new Error("No models returned");
  console.log(`   Models: ${data.data.length} available`);
});

// Test 3: Auth rejection
await test("Auth rejection (no key)", async () => {
  const res = await fetch(`${BASE}/v1/models`);
  if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
});

// Test 4: Non-streaming completion with generic model (THE critical test)
await test("POST /v1/chat/completions (non-stream, gpt-4o)", async () => {
  const res = await fetch(`${BASE}/v1/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [{ role: "user", content: "Respond with exactly one word: HELLO" }],
      stream: false
    })
  });
  const data = await res.json() as any;
  if (data.error) throw new Error(`API error: ${JSON.stringify(data.error)}`);
  if (!data.choices?.[0]?.message?.content) throw new Error(`No content in response: ${JSON.stringify(data)}`);
  console.log(`   Response: "${data.choices[0].message.content.trim()}"`);
  console.log(`   Provider: ${res.headers.get("X-Provider")}`);
  console.log(`   Usage: ${JSON.stringify(data.usage)}`);
});

// Test 5: Streaming completion
await test("POST /v1/chat/completions (stream, gpt-4o)", async () => {
  const res = await fetch(`${BASE}/v1/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [{ role: "user", content: "Say hi in 3 words" }],
      stream: true
    })
  });
  const text = await res.text();
  if (!text.includes("data:")) throw new Error("No SSE data received");
  if (!text.includes("[DONE]")) throw new Error("Missing [DONE] terminator!");
  const chunks = text.split("\n").filter(l => l.startsWith("data: ") && !l.includes("[DONE]"));
  let content = "";
  for (const chunk of chunks) {
    try {
      const parsed = JSON.parse(chunk.slice(6));
      content += parsed.choices?.[0]?.delta?.content || "";
    } catch {}
  }
  console.log(`   Streamed: "${content.trim()}"`);
  console.log(`   Chunks: ${chunks.length}`);
  console.log(`   Has [DONE]: ✅`);
  console.log(`   Provider: ${res.headers.get("X-Provider")}`);
});

// Test 6: Specific model (DeepSeek)
await test("POST /v1/chat/completions (deepseek-chat)", async () => {
  const res = await fetch(`${BASE}/v1/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [{ role: "user", content: "Respond with exactly: DEEPSEEK_OK" }],
      stream: false
    })
  });
  const data = await res.json() as any;
  if (data.error) throw new Error(`API error: ${JSON.stringify(data.error)}`);
  console.log(`   Response: "${data.choices?.[0]?.message?.content?.trim()}"`);
  console.log(`   Provider: ${res.headers.get("X-Provider")}`);
});

// Test 7: Info endpoint
await test("GET /info", async () => {
  const res = await fetch(`${BASE}/info`, { headers });
  const data = await res.json() as any;
  if (data.version !== "2.0.0") throw new Error(`Expected v2.0.0, got ${data.version}`);
  console.log(`   Version: ${data.version}`);
  console.log(`   Features: ${data.features?.join(", ")}`);
});

console.log("\n🏁 Tests complete");

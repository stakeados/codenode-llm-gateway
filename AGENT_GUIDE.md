# 🤖 AI Agent Integration Guide

Technical reference for AI agents and autonomous systems integrating with the CodeNode LLM Gateway.

---

## Overview

The CodeNode LLM Gateway is a multi-provider LLM proxy that exposes an OpenAI-compatible API. It rotates requests across 8 core free providers with automatic failover, tool-aware routing, and a paid emergency fallback.

---

## Authentication

All endpoints (except `GET /health`) require authentication:

| Header | Format |
|--------|--------|
| `Authorization` | `Bearer <API_PROXY_KEY>` |
| `X-API-Key` | `<API_PROXY_KEY>` |

---

## Primary Endpoint

**`POST /v1/chat/completions`** — Fully compatible with the OpenAI specification.

```json
{
  "model": "gpt-4o",
  "messages": [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "What is the weather in Madrid?"}
  ],
  "tools": [{
    "type": "function",
    "function": {
      "name": "get_weather",
      "parameters": { "type": "object", "properties": { "city": {"type": "string"} }, "required": ["city"] }
    }
  }],
  "stream": false
}
```

---

## Smart Routing

### Automatic Load Balancing
Use generic model names (`gpt-4o`, `gpt-3.5-turbo`, `gpt-4`) to distribute across all providers via round-robin.

### Direct Provider Routing

| Model Value | Routes To |
|-------------|-----------|
| `deepseek-chat`, `deepseek-reasoner` | DeepSeek |
| `llama-3.3-70b-versatile` | Groq |
| `gemini-2.0-flash` | Gemini |
| `mistral-small-latest`, `mixtral-*` | Mistral |
| `meta/llama-*`, `nvidia/*`, `nemotron*` | NVIDIA NIM |
| `phi-*` | GitHub Models |
| Any unrecognized model | OpenRouter (fallback) |

### Tool-Aware Filtering

When `tools` are present, these providers are **excluded**:
- ❌ Gemini (SDK doesn't pass tools)
- ❌ Cerebras (limited tool support)

All other 6 tool-capable providers handle tools correctly.

---

## Failover Behavior

```
Phase 1 → Try ALL free providers (up to 8)
Phase 2 → Retry emergency free provider (OpenRouter)
Phase 3 → Use paid API (if EMERGENCY_API_KEY is set)
```

The `X-Provider` response header indicates which provider served the request.

---

## Other Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/models` | GET | Available models list |
| `/v1/responses` | POST | Codex/Responses API mapping |
| `/completion` | POST | Simple `{"prompt":"..."}` → `{"response":"..."}` |
| `/dashboard` | GET | Usage stats, tokens, cost estimation |

---

## Connection Examples

### Python (OpenAI SDK)
```python
from openai import OpenAI

client = OpenAI(
    base_url="https://your-gateway-host/v1",
    api_key="your-proxy-key"
)

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Hello"}]
)
```

### JavaScript (fetch)
```javascript
const response = await fetch("https://your-gateway-host/v1/chat/completions", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer your-proxy-key"
  },
  body: JSON.stringify({
    model: "gpt-4o",
    messages: [{ role: "user", content: "Hello" }],
    stream: false
  })
});
```

---

## Usage Tracking

The `usage` field in non-streaming responses returns estimated token counts:
```json
{
  "usage": {
    "prompt_tokens": 245,
    "completion_tokens": 83,
    "total_tokens": 328
  }
}
```

For aggregate statistics, use `GET /dashboard`.

---

*CodeNode LLM Gateway v3.0 — [codenode.cloud](https://codenode.cloud)*

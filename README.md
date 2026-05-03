# 🚀 CodeNode LLM Gateway

Production-grade, zero-cost AI proxy infrastructure for autonomous agents. A multi-provider LLM multiplexer with automatic failover, smart routing, and full OpenAI API compatibility. Rotates across 8 core providers.

Built as a core piece of the **CodeNode.cloud** ecosystem.

*🌍 [Leer en Español](#-codenode-llm-gateway-español)*

---

## ✨ Features

- **🔄 Smart Load Balancer** — Automatic round-robin rotation across up to 8 providers to maximize free-tier limits.
- **🌐 Full OpenAI Compatibility** — Drop-in replacement for the official OpenAI API. Works with Cursor, n8n, OpenClaw, Codex, and any OpenAI-compatible client.
- **🛠️ Tool Calling** — Native support for OpenAI-style `tools` and `tool_choice`. Tool-aware routing automatically skips providers that don't support function calling.
- **🧠 Smart Router** — Request a specific model and the gateway routes to the correct provider. Use a generic model name for automatic load balancing.
- **🔑 Multi-Key Rotation** — Supply multiple API keys per provider (comma-separated) to multiply your free-tier quotas.
- **📊 Usage Dashboard** — Built-in `GET /dashboard` endpoint with per-provider metrics, token counts, and cost estimation.
- **🚨 3-Phase Emergency Fallback** — Tries ALL providers → retries emergency free provider → falls back to paid API. Virtually eliminates downtime.

---

## 🛠️ Supported Providers

| # | Provider | Default Model | Tools | Context | Get API Key |
|---|----------|--------------|:-----:|--------:|-------------|
| 1 | **Groq** | `llama-3.3-70b-versatile` | ✅ | 128K | [console.groq.com](https://console.groq.com/keys) |
| 2 | **Google Gemini** | `gemini-2.0-flash` | — | 1M | [aistudio.google.com](https://aistudio.google.com/apikey) |
| 3 | **OpenRouter** | `llama-3.3-70b-instruct:free` | ✅ | 128K | [openrouter.ai/keys](https://openrouter.ai/keys) |
| 4 | **DeepSeek** | `deepseek-chat` | ✅ | 64K | [platform.deepseek.com](https://platform.deepseek.com/api_keys) |
| 5 | **Cerebras** | `llama-3.3-70b` | — | 128K | [cloud.cerebras.ai](https://cloud.cerebras.ai/) |
| 6 | **Mistral** | `mistral-small-latest` | ✅ | 32K | [console.mistral.ai](https://console.mistral.ai/api-keys/) |
| 7 | **NVIDIA NIM** | `meta/llama-3.3-70b-instruct` | ✅ | 128K | [build.nvidia.com](https://build.nvidia.com/) |
| 8 | **GitHub Models** | `gpt-4o-mini` | ✅ | 128K | [github.com/settings/tokens](https://github.com/settings/tokens) |

> **Tool-Aware Routing:** When a request includes `tools`, the gateway automatically filters out providers that don't support function calling (Gemini, Cerebras) and only routes to the remaining tool-capable providers.

---

## 🚨 3-Phase Emergency Fallback

The gateway will **never** return an error until it has exhausted every option:

```
Phase 1 → Try ALL enabled free providers in order
Phase 2 → Retry the designated emergency free provider (default: OpenRouter)
Phase 3 → Use a PAID API as absolute last resort (requires EMERGENCY_API_KEY)
```

Configure via `.env`:
```env
EMERGENCY_PROVIDER=OpenRouter
EMERGENCY_API_KEY=sk-your-openai-key
EMERGENCY_API_URL=https://api.openai.com/v1/chat/completions
EMERGENCY_MODEL=gpt-4o-mini
```

---

## Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/chat/completions` | POST | Main OpenAI-compatible endpoint (streaming & non-streaming) |
| `/v1/models` | GET | Lists all available models across providers |
| `/v1/responses` | POST | Codex/Responses API compatibility |
| `/completion` | POST | Simplified endpoint — returns `{"response": "..."}` |
| `/chat` | POST | Legacy streaming endpoint |
| `/health` | GET | Service health check (no auth required) |
| `/info` | GET | Gateway metadata and active providers |
| `/dashboard` | GET | Usage statistics, token counts, and cost estimation |

---

## 🚀 Quick Start

### 1. Install Bun
```bash
curl -fsSL https://bun.sh/install | bash          # macOS/Linux
powershell -c "irm bun.sh/install.ps1 | iex"      # Windows
```

### 2. Configure API Keys
```bash
cp env.template .env
```
Add at least one provider API key. Multiple keys per provider for increased quota:
```env
GROQ_API_KEY=key1,key2,key3
API_PROXY_KEY=your-secret-key
```

### 3. Run
```bash
bun install && bun dev
```
Gateway available at `http://localhost:3000`.

---

## 🔌 Integration

### As OpenAI replacement
```json
{
  "baseUrl": "http://your-host:3000/v1",
  "apiKey": "your-proxy-key",
  "model": "gpt-4o"
}
```

### With n8n / Low-Code
```bash
curl -X POST http://your-host:3000/completion \
  -H "Authorization: Bearer YOUR_KEY" \
  -d '{"prompt": "Summarize this..."}'
```

### Requesting a specific provider
Use the model name to route directly:
```bash
curl -X POST http://your-host:3000/v1/chat/completions \
  -H "Authorization: Bearer YOUR_KEY" \
  -d '{"model": "deepseek-chat", "messages": [{"role":"user","content":"Hello"}]}'
```

---

## 📊 Cost Tracking

The dashboard (`GET /dashboard`) tracks estimated token usage and equivalent costs:

```json
{
  "totals": {
    "total_tokens": 328000,
    "estimated_equivalent_cost_usd": "$0.0412",
    "actual_paid_cost_usd": "$0.0003",
    "saved_usd": "$0.0409"
  }
}
```

Token estimation uses ~4 chars/token. Pricing reflects each provider's equivalent paid rates.

---

## 🐳 Deployment

```bash
# Docker Compose
cp env.template .env && docker compose up -d

# Plain Docker
docker build -t llm-gateway . && docker run -d --env-file .env -p 3000:3000 llm-gateway
```

See [DEPLOY_VPS.md](DEPLOY_VPS.md) for full Dokploy/VPS deployment guide.

---

## ❓ Troubleshooting

| Problem | Solution |
|---------|----------|
| "No services available" | Add at least one provider API key to `.env` |
| Agent failing with tool calls | Ensure at least one tool-capable provider is configured |
| Error 429 rate limited | Add more keys per provider: `GROQ_API_KEY=key1,key2` |
| All providers failing | Configure `EMERGENCY_API_KEY` for paid fallback |

---

## 📚 Documentation

- [🤖 AI Agent Integration Guide](AGENT_GUIDE.md)
- [☁️ VPS Deployment Guide](DEPLOY_VPS.md)

---

<a name="-codenode-llm-gateway-español"></a>

# 🚀 CodeNode LLM Gateway (Español)

Infraestructura proxy de IA con coste cero y calidad de producción para agentes autónomos. Un multiplexor LLM multi-proveedor con failover automático, enrutamiento inteligente y compatibilidad total con la API de OpenAI. Rotación entre 8 proveedores principales.

---

## ✨ Características

- **🔄 Balanceador de Carga** — Rotación round-robin entre hasta 8 proveedores gratuitos.
- **🌐 Compatible con OpenAI** — Sustituto directo de la API de OpenAI. Funciona con Cursor, n8n, OpenClaw, Codex.
- **🛠️ Tool Calling** — Soporte nativo. El router filtra automáticamente proveedores sin soporte de funciones.
- **🔑 Rotación Multi-Key** — Múltiples keys por proveedor para multiplicar cuotas gratuitas.
- **📊 Dashboard** — Métricas en tiempo real con conteo de tokens y estimación de costes.
- **🚨 Fallback de 3 Fases** — Prueba TODOS los providers → reintento emergency → API de pago como último recurso.

---

## 🛠️ Proveedores Soportados

| # | Proveedor | Modelo Default | Tools | Contexto | Obtener API Key |
|---|-----------|---------------|:-----:|--------:|-----------------|
| 1 | **Groq** | `llama-3.3-70b-versatile` | ✅ | 128K | [console.groq.com](https://console.groq.com/keys) |
| 2 | **Google Gemini** | `gemini-2.0-flash` | — | 1M | [aistudio.google.com](https://aistudio.google.com/apikey) |
| 3 | **OpenRouter** | `llama-3.3-70b-instruct:free` | ✅ | 128K | [openrouter.ai/keys](https://openrouter.ai/keys) |
| 4 | **DeepSeek** | `deepseek-chat` | ✅ | 64K | [platform.deepseek.com](https://platform.deepseek.com/api_keys) |
| 5 | **Cerebras** | `llama-3.3-70b` | — | 128K | [cloud.cerebras.ai](https://cloud.cerebras.ai/) |
| 6 | **Mistral** | `mistral-small-latest` | ✅ | 32K | [console.mistral.ai](https://console.mistral.ai/api-keys/) |
| 7 | **NVIDIA NIM** | `meta/llama-3.3-70b-instruct` | ✅ | 128K | [build.nvidia.com](https://build.nvidia.com/) |
| 8 | **GitHub Models** | `gpt-4o-mini` | ✅ | 128K | [github.com/settings/tokens](https://github.com/settings/tokens) |

---

## 🚀 Inicio Rápido

```bash
cp env.template .env    # Configura tus API keys
bun install && bun dev  # Arranca en http://localhost:3000
```

## 🔌 Integración

Apunta cualquier cliente compatible con OpenAI a:
- **Base URL:** `http://tu-host:3000/v1`
- **API Key:** Tu `API_PROXY_KEY`
- **Modelo:** `gpt-4o` para balanceo automático, o un nombre específico para enrutar directamente

---

## 📚 Documentación

- [🤖 Guía de Integración con Agentes](AGENT_GUIDE.md)
- [☁️ Guía de Despliegue en VPS](DEPLOY_VPS.md)

---

*CodeNode LLM Gateway v3.0 — [codenode.cloud](https://codenode.cloud)*

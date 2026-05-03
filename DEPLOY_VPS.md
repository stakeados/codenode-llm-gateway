# ☁️ VPS Deployment Guide

Instructions for deploying the CodeNode LLM Gateway on a VPS using Dokploy, Docker Compose, or plain Docker.

---

## 1. Dokploy (Recommended)

The project includes a `nixpacks.toml` for automatic detection and deployment.

### Setup
1. Open your Dokploy panel and create a new **Project**.
2. Create a new **Service** of type **Application**.
3. Connect your GitHub repository (or paste the public URL).
4. In the **General** tab:
   - **Build Type:** Select `Nixpacks` (auto-detected via `nixpacks.toml`).
   - **Port:** `3000` (default).

### Environment Variables
Navigate to the **Environment** tab and configure:

```env
# Required — at least one provider key
GROQ_API_KEY=your_key
CEREBRAS_API_KEY=your_key
GOOGLE_GENERATIVE_AI_API_KEY=your_key
OPENROUTER_API_KEY=your_key
DEEPSEEK_API_KEY=your_key
SAMBANOVA_API_KEY=your_key
MISTRAL_API_KEY=your_key
NVIDIA_API_KEY=your_key
GITHUB_MODELS_API_KEY=your_key

# Security — protects all endpoints
API_PROXY_KEY=your_secret_proxy_key
PORT=3000
```

> **Multi-Key Support:** You can provide multiple keys per provider using commas: `GROQ_API_KEY=key1,key2,key3`

### Deploy
Click **Deploy**. Dokploy reads `nixpacks.toml` and starts the server using Bun automatically.

---

## 2. Custom Domain (Recommended)

To expose the gateway on a professional domain (e.g., `api.yourdomain.com`):

1. **DNS Configuration:** Create an `A` record pointing to your VPS IP address.
2. **Dokploy:** Go to the **Domains** tab in your application settings and add the domain. SSL certificates are generated automatically.

---

## 3. Docker Compose (Without Dokploy)

```bash
cp env.template .env    # Configure API keys
docker compose up -d --build
```

The service starts on port `3000` with Traefik labels pre-configured.

---

## 4. Plain Docker (Fallback)

If Docker Compose is not available:

```bash
docker build -t llm-gateway .
docker run -d \
  --name llm-gateway \
  --env-file .env \
  -p 3000:3000 \
  --restart unless-stopped \
  llm-gateway
```

---

## 5. Verification

After deployment, verify the service is running:

```bash
# Health check
curl http://your-host:3000/health

# Service info
curl http://your-host:3000/info

# Usage dashboard (requires API_PROXY_KEY)
curl -H "Authorization: Bearer YOUR_KEY" http://your-host:3000/dashboard
```

---

## 6. Security

All endpoints except `/health` require the `API_PROXY_KEY` header:

```
Authorization: Bearer your_secret_proxy_key
```

Ensure `API_PROXY_KEY` is set in your environment to prevent unauthorized usage of your provider API credits.

---

*CodeNode LLM Gateway v3.0 — [codenode.cloud](https://codenode.cloud)*

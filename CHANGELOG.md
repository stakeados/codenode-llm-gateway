# Changelog

All notable changes to the **CodeNode LLM Gateway** project will be documented in this file.

## [3.0.0] - 2026-05-03

### 🚀 Added
- **Modernized Provider Core**: Integrated 9 professional free-tier providers:
  - Groq (LPU Inference)
  - Google Gemini (Gemini 2.0 Flash/Pro)
  - OpenRouter (Free Tier Aggregator)
  - DeepSeek (Chat & Reasoner)
  - Cerebras (CS-3 Hardware Acceleration)
  - Sambanova (Meta-Llama 3.3 support)
  - Mistral AI (Official Free Tier)
  - NVIDIA NIM (Professional Inference)
  - GitHub Models (Azure-backed free tier for devs)
- **3-Phase Emergency Fallback**:
  - **Phase 1**: Exhaustive rotation across all enabled free providers.
  - **Phase 2**: Automatic retry with a designated "Emergency Free" provider (OpenRouter by default).
  - **Phase 3**: Absolute last-resort fallback to a paid OpenAI-compatible API.
- **Smart Tool-Aware Routing**: Gateway now automatically detects if the request requires `tools` and filters out incompatible providers (Gemini/Cerebras) to ensure request success.
- **Usage & Financial Dashboard**: New `GET /dashboard` endpoint providing:
  - Total token usage estimation (~4 chars/token).
  - Equivalent financial cost estimation based on market rates.
  - Success/Failure rate per provider.
  - Real cost tracking for paid fallbacks.
- **Multi-Key Rotation**: Support for multiple API keys per provider via comma-separated environment variables to multiply rate limits.

### 🛠️ Changed
- **Architecture Refactor**: Services are now modularized in `/services/` for easier maintenance.
- **OpenAI API Compatibility**: Fully updated to match modern OpenAI chat completion specifications (including streaming support).
- **Core Engine**: Migrated rotation logic to a more robust `KeyRotator` utility.
- **Documentation**: Professional rewrite of `README.md`, `AGENT_GUIDE.md`, and added `DEPLOY_VPS.md`. Bilingual support (EN/ES).

### 🔒 Security
- **API Proxy Key**: Enhanced access protection for the gateway.
- **Env Template**: Clearer configuration and registration links for all providers.

### 🗑️ Removed
- Removed providers without a permanent free-tier (Together.ai, Fireworks.ai) to maintain the "Zero-Cost" philosophy of the core engine.

---
*CodeNode LLM Gateway v3.0 — Infrastructure for autonomous intelligence.*

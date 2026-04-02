# 🚀 CodeNode LLM Gateway

Zero-cost, production-grade Artificial Intelligence proxy infrastructure for Autonomous Agents! This project was built from the ground up as a core piece of the **CodeNode.cloud** ecosystem, deeply inspired by an initial prototype by `@midudev`.

*🌍 [Leer en Español](#-codenode-llm-gateway-español)*

## ✨ Key Features (PRO Additions)

- **🔄 Smart Load Balancer**: Automatic rotation across 5 providers to maximize free limits and avoid rate-limiting.
- **🌐 Official OpenAI Compatibility**: Drop-in replacement for the official OpenAI API. Works with Cursor, n8n, Hermes (OpenClaw), etc.
- **🛠️ Native Tool Calling (PRO Mode)**: Full support for OpenAI's `tools` and `tool_choice`, perfect for rigorous Agentic frameworks.
- **🧠 Smart Router**: Dynamically request specific models (e.g., `{"model": "deepseek-chat"}`) and the proxy strictly routes to the capable provider. Leave it blank for free round-robin routing.
- **⚡ Simplified Endpoint**: `/completion` to fetch full responses without SSE (ideal for low-code automations).
- **🔒 Built-in Security**: Protected by an access key to stop unauthorized access to your credits.
- **🐳 1-Click Deployment**: CodeNode.cloud ready, fully containerized (Docker), and Dokploy compatible with native Nixpacks support.

## 🛠️ Supported Services

| Provider | Main Advantage | Status |
| :--- | :--- | :--- |
| **Google Gemini** | Huge context window & stability | ✅ Added |
| **OpenRouter** | Access to 100+ models (GPT-4, Claude, etc.) | ✅ Added |
| **DeepSeek** | Incredible cost-to-performance ratio | ✅ Added |
| **Groq** | Instantaneous token generation | ✅ Native |
| **Cerebras** | Ultra-fast inference | ✅ Native |

## 🚀 Quick Start

1. **Install Bun** (if you don't have it):
   ```bash
   powershell -c "irm bun.sh/install.ps1 | iex"
   ```
2. **Configure your Keys**:
   Copy `.env.example` to `.env` and fill in your API Keys.
3. **Run it!**:
   ```bash
   bun dev
   ```

## 🔌 Integration

### As OpenAI API 
Point your applications directly to:
- **Base URL**: `http://your-vps:3000/v1`
- **API Key**: Your secret `API_PROXY_KEY`.

### With n8n (No-code)
Use the `/completion` endpoint for direct text integration without having to parse streaming chunks.

### 🏢 CodeNode.cloud (Architect Mode)
This fork is audited and prepared for the **Bazaar/x402** marketplace ecosystem.

#### 1. Automated Deployment
Initialize with `.env` (using the `env.template`), then launch the golden Traefik template:
```bash
docker compose up -d
```

#### 2. Auditing Endpoints
- **Health Check:** `curl http://localhost:3000/health`
- **Info Service:** `curl http://localhost:3000/info`

#### 3. x402 Mode (L402 M2M Payments)
If you configure `REQUIRE_PAYMENT=true` inside `.env`, the nodes will enforce standard payment locks:
```bash
# Simulated 402 Payment Required scenario:
curl -X POST http://localhost:3000/v1/chat/completions
# -> HTTP 402 with WWW-Authenticate: L402 macaroon="..."
```

---

<a name="-codenode-llm-gateway-español"></a>
# 🚀 CodeNode LLM Gateway (Español)

¡Infraestructura proxy de Inteligencia Artificial con coste 0 y nivel de producción para Agentes! Este proyecto ha sido construido desde cero como pieza fundamental del ecosistema **CodeNode.cloud**, profundamente inspirado en un prototipo inicial creado por `@midudev`.

## ✨ Características Principales (Lo que hemos añadido)

- **🔄 Multi-Operador Inteligente**: Rotación automática entre 5 proveedores para maximizar límites gratuitos y velocidad.
- **🌐 Compatibilidad Oficial OpenAI**: Puedes usarlo como si fuera la API oficial de OpenAI en cualquier programa (Cursor, n8n, Hermes, etc.).
- **🛠️ Tool Calling Nativo (Modo PRO)**: Soporte completo para `tools` y `tool_choice` de OpenAI, ideal para frameworks Agentic.
- **🧠 Enrutador Inteligente (Smart Router)**: Exige un modelo concreto (`{"model": "deepseek-chat"}`) o mantén el valor por defecto para usar la ruleta Round-Robin.
- **⚡ Endpoint Simplificado**: `/completion` para recibir la respuesta de golpe (ideal para automatizaciones).
- **🔒 Seguridad Integrada**: Protegido por clave de acceso para evitar que otros usen tus créditos.
- **🐳 Despliegue en 1 Clic**: Preparado para **CodeNode.cloud**, Docker y Dokploy.

## 🛠️ Servicios Soportados

| Proveedor | Ventaja Principal | Estado |
| :--- | :--- | :--- |
| **Google Gemini** | Gran ventana de contexto y estabilidad | ✅ Añadido |
| **OpenRouter** | Acceso a 100+ modelos (GPT-4, Claude, etc.) | ✅ Añadido |
| **DeepSeek** | Rendimiento brutal a bajo coste | ✅ Añadido |
| **Groq** | Velocidad de respuesta instantánea | ✅ Nativo |
| **Cerebras** | Inferencia ultra-rápida | ✅ Nativo |

## 🚀 Inicio Rápido

1. **Instala Bun** (si aún no lo tienes):
   ```bash
   powershell -c "irm bun.sh/install.ps1 | iex"
   ```
2. **Configura tus llaves**:
   Copia `.env.example` a `.env` y rellena tus API Keys.
3. **¡A volar!**:
   ```bash
   bun dev
   ```

## 🔌 Integración

### Como API de OpenAI
Apunta tus programas a:
- **Base URL**: `http://tu-vps:3000/v1`
- **API Key**: Tu `API_PROXY_KEY` secreta.

### Con n8n (Sin código)
Usa el endpoint `/completion` para una integración directa sin lidiar con streams.

### 🏢 CodeNode.cloud (Modo Arquitecto)
El proyecto está auditado y preparado para el ecosistema **Bazaar/x402**.

#### 1. Despliegue Automatizado
Copia `env.template` a `.env`, rellena las llaves, y luego usa el template Golden de Traefik:
```bash
docker compose up -d
```

#### 2. Endpoints de Auditoría
- **Health Check:** `curl http://localhost:3000/health`
- **Info Service:** `curl http://localhost:3000/info`

#### 3. Modo x402 (Pagos L402)
Si configuras `REQUIRE_PAYMENT=true` en tu `.env`, los nodos rechazarán solicitudes sin pago:
```bash
# Ejemplo simulado de denegación 402 Payment Required:
curl -X POST http://localhost:3000/v1/chat/completions
# -> HTTP 402 con WWW-Authenticate: L402 macaroon="..."
```

---

## 📚 Documentación Detallada
- [📖 Guía de Uso Completa](HOW_TO_USE.md)
- [🤖 Guía para Agentes de IA](AGENT_GUIDE.md)
- [☁️ Despliegue en VPS (Dokploy)](DEPLOY_VPS.md)

## ❓ Solución de Problemas (Troubleshooting)

### Error 404/401 en Gemini
Si ves `[Gemini] Error: 404` en los logs, significa que **tu API Key no tiene acceso al modelo**.
- **Solución**: Asegúrate de que has habilitado la API en Google AI Studio y que tu proyecto tiene facturación o acceso al modelo `gemini-1.5-flash`.

### "No services available" al llamar al servidor
Si el servidor responde "No services available", esto NO es un error, es su comportamiento seguro. El puerto arranca, `/health` funciona, pero si no se inyectan llaves de entorno, los módulos LLM se quedan inactivos.
- **Solución**: Asegúrate de configurar al menos **una API Key** en tu `.env` (`OPENROUTER_API_KEY`, `GROQ_API_KEY`, etc.) para que `/v1/chat/completions` procese inferencias.

### Error 404 en OpenRouter
Si OpenRouter devuelve 404, es posible que el modelo gratuito esté saturado o haya cambiado de nombre.
- **Solución**: Edita `services/openrouter.ts` y prueba con otro modelo gratuito de la lista de OpenRouter (ej. `google/gemini-2.0-flash-exp:free`).

---
*Hecho con ❤️ para mejorar la infraestructura de IA personal.*

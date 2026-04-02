import { groqService } from './services/groq';
import { cerebrasService } from './services/cerebras';
import { geminiService } from './services/gemini';
import { openRouterService } from './services/openrouter';
import { deepseekService } from './services/deepseek';
import type { AIService, ChatMessage, ChunkDelta, CompletionResponse } from './types';

// ─── Service Registry ────────────────────────────────────────────────
const services: AIService[] = [];
const serviceModels: Record<string, string[]> = {};

if (process.env.GROQ_API_KEY) {
  services.push(groqService);
  serviceModels['Groq'] = ['llama3-8b-8192', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'];
}
if (process.env.CEREBRAS_API_KEY) {
  services.push(cerebrasService);
  serviceModels['Cerebras'] = ['llama3.1-8b'];
}
if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
  services.push(geminiService);
  serviceModels['Gemini'] = ['gemini-1.5-flash', 'gemini-2.0-flash-exp'];
}
if (process.env.OPENROUTER_API_KEY) {
  services.push(openRouterService);
  serviceModels['OpenRouter'] = ['openrouter/auto', 'google/gemini-2.0-flash-exp:free', 'meta-llama/llama-3-8b-instruct:free'];
}
if (process.env.DEEPSEEK_API_KEY) {
  services.push(deepseekService);
  serviceModels['DeepSeek'] = ['deepseek-chat', 'deepseek-reasoner'];
}

console.log(`[Gateway] Enabled Services: ${services.map(s => s.name).join(', ') || 'NONE — configure at least one API key!'}`);

// ─── Configuration ───────────────────────────────────────────────────
const MAX_RETRIES = 3;
const REQUEST_TIMEOUT_MS = 90_000; // 90 seconds per provider attempt
const KEEPALIVE_INTERVAL_MS = 15_000; // 15 seconds keepalive for non-streaming

// ─── Round Robin ─────────────────────────────────────────────────────
let currentServiceIndex = 0;

function getNextService(): AIService | undefined {
  if (services.length === 0) return undefined;
  const service = services[currentServiceIndex];
  currentServiceIndex = (currentServiceIndex + 1) % services.length;
  return service;
}

// ─── Smart Router ────────────────────────────────────────────────────
// Generic OpenAI model names that should NOT be forwarded to providers
const GENERIC_MODELS = new Set(['gpt-3.5-turbo', 'gpt-4o', 'gpt-4', 'gpt-4o-mini', 'gpt-4-turbo']);

function isGenericModel(modelName: string): boolean {
  return !modelName || GENERIC_MODELS.has(modelName);
}

// Returns the actual model name to send to the provider.
// If the agent requested a generic model (gpt-4o), we return undefined
// so the provider uses its own default model.
function resolveModelForProvider(modelName: string): string | undefined {
  return isGenericModel(modelName) ? undefined : modelName;
}

function getServiceForModel(modelName: string): AIService | undefined {
  if (isGenericModel(modelName)) {
    return getNextService();
  }

  const lowerModel = modelName.toLowerCase();

  if (lowerModel.includes('groq') || (lowerModel.includes('llama') && !lowerModel.includes('meta-llama'))) {
    return services.find(s => s.name === 'Groq') || getNextService();
  }
  if (lowerModel.includes('deepseek')) {
    return services.find(s => s.name === 'DeepSeek') || getNextService();
  }
  if (lowerModel.includes('cerebras')) {
    return services.find(s => s.name === 'Cerebras') || getNextService();
  }
  if (lowerModel.includes('gemini')) {
    return services.find(s => s.name === 'Gemini') || getNextService();
  }

  // Default: OpenRouter can handle almost anything
  return services.find(s => s.name === 'OpenRouter') || getNextService();
}

// ─── Retry with Failover ─────────────────────────────────────────────
// This is the KEY difference vs our old code. If a provider fails,
// we automatically try the next one, up to MAX_RETRIES total attempts.
async function withRetry<T>(
  operation: (service: AIService) => Promise<T>,
  preferredService?: AIService
): Promise<{ result: T; service: AIService }> {
  const tried = new Set<string>();
  let lastError: Error | null = null;

  // Try preferred service first
  const orderedServices = preferredService
    ? [preferredService, ...services.filter(s => s.name !== preferredService.name)]
    : [...services];

  for (let attempt = 0; attempt < Math.min(MAX_RETRIES, orderedServices.length); attempt++) {
    const service = orderedServices[attempt];
    if (!service || tried.has(service.name)) continue;
    tried.add(service.name);

    try {
      console.log(`[Retry ${attempt + 1}/${MAX_RETRIES}] Trying ${service.name}...`);

      // Race between the operation and a timeout (with cleanup)
      let timeoutId: ReturnType<typeof setTimeout>;
      const result = await Promise.race([
        operation(service),
        new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error(`Timeout after ${REQUEST_TIMEOUT_MS}ms`)), REQUEST_TIMEOUT_MS);
        })
      ]);
      clearTimeout(timeoutId!);

      return { result, service };
    } catch (error: any) {
      lastError = error;
      console.error(`[Retry] ${service.name} failed: ${error.message}`);

      // If it's a rate limit (429), mark and continue
      if (error.status === 429 || error.message?.includes('429')) {
        console.warn(`[Retry] ${service.name} rate-limited (429), rotating...`);
      }
    }
  }

  throw lastError || new Error('All services exhausted');
}

// ─── CORS Headers ────────────────────────────────────────────────────
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key'
};

// ─── Dynamic Models List ─────────────────────────────────────────────
function buildModelsList() {
  const models: any[] = [];
  const now = Math.floor(Date.now() / 1000);

  // Always advertise generic OpenAI-compatible models so agents recognize us
  models.push(
    { id: 'gpt-4o', object: 'model', created: now, owned_by: 'codenode-gateway' },
    { id: 'gpt-3.5-turbo', object: 'model', created: now, owned_by: 'codenode-gateway' },
    { id: 'gpt-4', object: 'model', created: now, owned_by: 'codenode-gateway' }
  );

  // Add real models from each enabled provider
  for (const [providerName, providerModels] of Object.entries(serviceModels)) {
    for (const modelId of providerModels) {
      models.push({
        id: modelId,
        object: 'model',
        created: now,
        owned_by: providerName.toLowerCase()
      });
    }
  }

  return models;
}

// ─── Server ──────────────────────────────────────────────────────────
const server = Bun.serve({
  port: process.env.PORT ?? 3000,
  // Global error handler — prevents Bun's generic "Something went wrong!"
  error(error) {
    console.error('[FATAL] Unhandled error in request handler:', error);
    return new Response(JSON.stringify({
      error: { message: error.message || 'Internal server error', type: 'server_error' }
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
    });
  },
  async fetch(req) {
   try {
    const { pathname } = new URL(req.url)

    // CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    // ── Auth layer ──
    const proxyKey = process.env.API_PROXY_KEY;
    if (proxyKey && pathname !== '/health') {
      const authHeader = req.headers.get('Authorization') || req.headers.get('X-API-Key');
      const providedKey = authHeader?.replace(/^Bearer\s+/i, '') || '';
      if (providedKey !== proxyKey) {
        return new Response(JSON.stringify({ error: { message: "Unauthorized: Invalid API Key", type: "auth_error" } }), {
          status: 401,
          headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
        });
      }
    }

    // ── GET /v1/models — Dynamic models list ──
    if (req.method === 'GET' && (pathname === '/v1/models' || pathname === '/models')) {
      return new Response(JSON.stringify({
        object: "list",
        data: buildModelsList()
      }), {
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
      });
    }

    // ── Health & Info ──
    if (req.method === 'GET' && pathname === '/health') {
      return new Response(JSON.stringify({
        status: "ok",
        services: services.map(s => s.name),
        timestamp: Date.now()
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (req.method === 'GET' && pathname === '/info') {
      return new Response(JSON.stringify({
        name: "CodeNode LLM Gateway",
        description: "OpenAI-compatible proxy for multiple LLM providers with automatic failover",
        version: "2.0.0",
        pricing: "BYOK (Bring Your Own Key)",
        endpoints: ["/v1/chat/completions", "/v1/models", "/health", "/info"],
        features: ["openai-compatible", "auto-retry", "failover", "tool-calling", "smart-router"],
        active_providers: services.map(s => s.name)
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
      });
    }

    // ── x402 Bazaar Protocol ──
    if (process.env.REQUIRE_PAYMENT === 'true' && req.method === 'POST') {
      const authHeader = req.headers.get('Authorization') || '';
      if (!authHeader.startsWith('L402') && !authHeader.includes('LSAT')) {
        return new Response(JSON.stringify({ error: "Payment required (x402/L402 Protocol)" }), {
          status: 402,
          headers: {
            'Content-Type': 'application/json',
            'WWW-Authenticate': 'L402 macaroon="..."'
          }
        });
      }
    }

    // ── POST /chat — Legacy/Direct endpoint ────────────────────────────
    if (req.method === 'POST' && (pathname === '/chat' || pathname === '/v1/chat')) {
      let body: any;
      try {
        const raw = await req.text();
        body = raw ? JSON.parse(raw) : {};
      } catch {
        return new Response(JSON.stringify({
          error: { message: 'Invalid JSON body', type: 'invalid_request_error' }
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
        });
      }
      const { messages } = body;

      if (services.length === 0) {
        return new Response(JSON.stringify({ error: { message: "No services available. Configure at least one API key.", type: "server_error" } }), { status: 503, headers: { 'Content-Type': 'application/json' } });
      }

      try {
        const { result: responseStream, service } = await withRetry(
          (svc) => svc.chat(messages)
        );

        const encoder = new TextEncoder();
        const readable = new ReadableStream({
          async start(controller) {
            try {
              for await (const chunk of responseStream) {
                if (chunk.content) controller.enqueue(encoder.encode(chunk.content));
              }
            } catch (e) {
              console.error('[Chat stream] Error:', e);
            } finally {
              controller.close();
            }
          }
        });

        return new Response(readable, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Provider': service.name,
            ...CORS_HEADERS
          },
        });
      } catch (e: any) {
        return new Response(JSON.stringify({ error: { message: e.message, type: "server_error" } }), {
          status: 502, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
        });
      }
    }

    // ── POST /completion — Simplified endpoint ────────────────────────
    if (req.method === 'POST' && (pathname === '/completion' || pathname === '/v1/completion')) {
      let body: any;
      try {
        const raw = await req.text();
        body = raw ? JSON.parse(raw) : {};
      } catch {
        return new Response(JSON.stringify({
          error: { message: 'Invalid JSON body', type: 'invalid_request_error' }
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
        });
      }
      const { messages: bodyMessages, prompt } = body;
      let messages: ChatMessage[] = [];

      if (bodyMessages) {
        messages = bodyMessages;
      } else if (prompt) {
        messages = [{ role: 'user', content: prompt }];
      } else {
        return new Response(JSON.stringify({ error: { message: "messages or prompt required", type: "invalid_request" } }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }

      if (services.length === 0) {
        return new Response(JSON.stringify({ error: { message: "No services available", type: "server_error" } }), { status: 503, headers: { 'Content-Type': 'application/json' } });
      }

      try {
        const { result: responseMessage, service } = await withRetry(
          (svc) => svc.complete(messages)
        );

        return new Response(JSON.stringify({ response: responseMessage?.content || '' }), {
          headers: { 'Content-Type': 'application/json', 'X-Provider': service.name, ...CORS_HEADERS },
        });
      } catch (e: any) {
        return new Response(JSON.stringify({ error: { message: e.message, type: "server_error" } }), {
          status: 502, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
        });
      }
    }

    // ── POST /v1/chat/completions — Main OpenAI-compatible endpoint ──
    if (req.method === 'POST' && (pathname === '/v1/chat/completions' || pathname === '/chat/completions')) {
      let body: any;
      try {
        const raw = await req.text();
        body = raw ? JSON.parse(raw) : {};
      } catch {
        return new Response(JSON.stringify({
          error: { message: 'Invalid JSON body', type: 'invalid_request_error' }
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
        });
      }
      const { messages, stream = false, tools, tool_choice } = body;
      const modelName = body.model || "gpt-3.5-turbo";

      if (services.length === 0) {
        return new Response(JSON.stringify({
          error: { message: "No services available. Configure at least one API key in your .env file.", type: "server_error", code: "no_providers" }
        }), { status: 503, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } });
      }

      const preferredService = getServiceForModel(modelName);
      // Resolve model: generic names (gpt-4o) → undefined (use provider default)
      const providerModel = resolveModelForProvider(modelName);

      console.log(`[Smart Router] Model requested: ${modelName} → Provider model: ${providerModel || 'default'} | Preferred: ${preferredService?.name}`);

      if (stream) {
        // ── Streaming with retry ──
        try {
          const { result: responseStream, service } = await withRetry(
            (svc) => svc.chat(messages, tools, tool_choice, providerModel),
            preferredService
          );

          const encoder = new TextEncoder();
          const id = `chatcmpl-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;

          const readable = new ReadableStream({
            async start(controller) {
              try {
                for await (const chunkDelta of responseStream) {
                  const data = JSON.stringify({
                    id,
                    object: 'chat.completion.chunk',
                    created: Math.floor(Date.now() / 1000),
                    model: modelName,
                    choices: [{
                      index: 0,
                      delta: chunkDelta,
                      finish_reason: null
                    }]
                  });
                  controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                }

                // Send final chunk with finish_reason
                const finalChunk = JSON.stringify({
                  id,
                  object: 'chat.completion.chunk',
                  created: Math.floor(Date.now() / 1000),
                  model: modelName,
                  choices: [{ index: 0, delta: {}, finish_reason: 'stop' }]
                });
                controller.enqueue(encoder.encode(`data: ${finalChunk}\n\n`));
              } catch (e: any) {
                console.error("[Stream error]", e.message);
                // Send error as a proper SSE event
                const errData = JSON.stringify({
                  id,
                  object: 'chat.completion.chunk',
                  created: Math.floor(Date.now() / 1000),
                  model: modelName,
                  choices: [{ index: 0, delta: { content: `\n[Gateway Error: ${e.message}]` }, finish_reason: 'stop' }]
                });
                controller.enqueue(encoder.encode(`data: ${errData}\n\n`));
              } finally {
                // ALWAYS emit [DONE] — this is critical for agents
                controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                controller.close();
              }
            }
          });

          return new Response(readable, {
            headers: {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              'Connection': 'keep-alive',
              'X-Provider': service.name,
              ...CORS_HEADERS
            },
          });
        } catch (e: any) {
          // All retries failed — return proper OpenAI error format
          return new Response(JSON.stringify({
            error: { message: `All providers failed: ${e.message}`, type: "server_error", code: "provider_exhausted" }
          }), {
            status: 502,
            headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
          });
        }

      } else {
        // ── Non-streaming with retry + keepalive concept ──
        try {
          const { result: responseMessage, service } = await withRetry(
            (svc) => svc.complete(messages, tools, tool_choice, providerModel),
            preferredService
          );

          if (responseMessage === undefined) {
            throw new Error('Provider returned empty response');
          }

          const id = `chatcmpl-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;

          const openAIResponse = {
            id,
            object: 'chat.completion',
            created: Math.floor(Date.now() / 1000),
            model: modelName,
            choices: [{
              index: 0,
              message: responseMessage,
              finish_reason: responseMessage.tool_calls ? 'tool_calls' : 'stop'
            }],
            usage: {
              prompt_tokens: 0,
              completion_tokens: 0,
              total_tokens: 0
            }
          };

          return new Response(JSON.stringify(openAIResponse), {
            headers: {
              'Content-Type': 'application/json',
              'X-Provider': service.name,
              ...CORS_HEADERS
            },
          });
        } catch (e: any) {
          return new Response(JSON.stringify({
            error: { message: `All providers failed: ${e.message}`, type: "server_error", code: "provider_exhausted" }
          }), {
            status: 502,
            headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
          });
        }
      }
    }

    // ── POST /v1/responses — Codex/Responses API ──
    if (req.method === 'POST' && (pathname === '/v1/responses' || pathname === '/responses')) {
      let body: any;
      try {
        const raw = await req.text();
        body = raw ? JSON.parse(raw) : {};
      } catch {
        return new Response(JSON.stringify({
          error: { message: 'Invalid JSON body', type: 'invalid_request_error' }
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
        });
      }
      const { input, model } = body as {
        input: Array<{ type: string, text?: string, content?: string, role?: string }>,
        model?: string
      };

      const messages: ChatMessage[] = body.input.map(item => {
        if (item.type === 'message') {
          return {
            role: (item.role as any) || 'user',
            content: item.content || item.text || ''
          };
        }
        return {
          role: 'user' as const,
          content: item.text || item.content || ''
        };
      });

      if (services.length === 0) {
        return new Response(JSON.stringify({ error: { message: "No services available", type: "server_error" } }), { status: 503, headers: { 'Content-Type': 'application/json' } });
      }

      try {
        const { result: responseMessage, service } = await withRetry(
          (svc) => svc.complete(messages)
        );

        if (responseMessage === undefined) {
          throw new Error('Provider returned empty response');
        }

        return new Response(JSON.stringify({
          content: responseMessage.content || '',
          type: 'text',
          model: body.model || 'gpt-5.2-codex'
        }), {
          headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        });
      } catch (e: any) {
        return new Response(JSON.stringify({
          error: { message: e.message, type: "server_error" }
        }), {
          status: 502,
          headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
        });
      }
    }

    return new Response(JSON.stringify({ error: { message: "Not found", type: "invalid_request" } }), {
      status: 404,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
    });
   } catch (fatalError: any) {
    // Global catch — nothing escapes to Bun's generic handler
    console.error('[FATAL] Uncaught error:', fatalError);
    return new Response(JSON.stringify({
      error: { message: fatalError.message || 'Internal server error', type: 'server_error' }
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
    });
   }
  }
})

console.log(`[CodeNode LLM Gateway v2.0] Running on ${server.url}`);
console.log(`[Gateway] Retry: ${MAX_RETRIES} attempts | Timeout: ${REQUEST_TIMEOUT_MS / 1000}s | Providers: ${services.length}`);
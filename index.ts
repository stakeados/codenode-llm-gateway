import { groqService } from './services/groq';
import { cerebrasService } from './services/cerebras';
import { geminiService } from './services/gemini';
import { openRouterService } from './services/openrouter';
import { deepseekService } from './services/deepseek';
import { mistralService } from './services/mistral';
import { nvidiaService } from './services/nvidia';
import { githubModelsService } from './services/github-models';
import { emergencyService } from './services/emergency';
import { usageTracker, estimateMessagesTokens, estimateResponseTokens } from './utils/usage-tracker';
import type { AIService, ChatMessage, ChunkDelta, CompletionResponse } from './types';

// ─── Service Registry ────────────────────────────────────────────────
const services: AIService[] = [];
const serviceModels: Record<string, string[]> = {};

if (process.env.GROQ_API_KEY) {
  services.push(groqService);
  serviceModels['Groq'] = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];
}
if (process.env.CEREBRAS_API_KEY) {
  services.push(cerebrasService);
  serviceModels['Cerebras'] = ['llama-3.3-70b', 'llama3.1-8b'];
}
if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
  services.push(geminiService);
  serviceModels['Gemini'] = ['gemini-2.0-flash', 'gemini-2.5-flash'];
}
if (process.env.OPENROUTER_API_KEY) {
  services.push(openRouterService);
  serviceModels['OpenRouter'] = ['openrouter/auto', 'meta-llama/llama-3.3-70b-instruct:free'];
}
if (process.env.DEEPSEEK_API_KEY) {
  services.push(deepseekService);
  serviceModels['DeepSeek'] = ['deepseek-chat', 'deepseek-reasoner'];
}
if (process.env.MISTRAL_API_KEY) {
  services.push(mistralService);
  serviceModels['Mistral'] = ['mistral-small-latest'];
}
if (process.env.NVIDIA_API_KEY) {
  services.push(nvidiaService);
  serviceModels['Nvidia'] = ['meta/llama-3.3-70b-instruct', 'nvidia/llama-3.1-nemotron-70b-instruct'];
}
if (process.env.GITHUB_MODELS_API_KEY) {
  services.push(githubModelsService);
  serviceModels['GithubModels'] = ['gpt-4o-mini', 'Meta-Llama-3.3-70B-Instruct', 'Phi-4'];
}

console.log(`[Gateway] Enabled: ${services.map(s => s.name).join(', ') || 'NONE'}`);

const REQUEST_TIMEOUT_MS = 90_000;

// ─── Emergency Fallback ──────────────────────────────────────────────
// Phase 2 fallback: re-try a designated FREE provider (configurable)
const EMERGENCY_FREE_PROVIDER = process.env.EMERGENCY_PROVIDER || 'OpenRouter';
// Phase 3 fallback: use a PAID API as absolute last resort (requires EMERGENCY_API_KEY)
const hasPaidEmergency = !!(process.env.EMERGENCY_API_KEY);

let currentServiceIndex = 0;
function getNextService(needsTools = false): AIService | undefined {
  if (services.length === 0) return undefined;
  const pool = needsTools ? services.filter(s => s.supportsTools) : services;
  if (pool.length === 0) return services[0]; // fallback if no tool-capable provider
  const service = pool[currentServiceIndex % pool.length];
  currentServiceIndex = (currentServiceIndex + 1) % pool.length;
  return service;
}

const GENERIC_MODELS = new Set(['gpt-3.5-turbo', 'gpt-4o', 'gpt-4', 'gpt-4o-mini', 'gpt-4-turbo']);
function isGenericModel(m: string): boolean { return !m || GENERIC_MODELS.has(m); }

function resolveModelForService(modelName: string, serviceName: string): string | undefined {
  if (isGenericModel(modelName)) return undefined;
  const lm = modelName.toLowerCase();
  let owner = 'OpenRouter'; // fallback
  if (lm.includes('groq') || (lm.includes('llama') && !lm.includes('meta-llama'))) owner = 'Groq';
  else if (lm.includes('deepseek')) owner = 'DeepSeek';
  else if (lm.includes('cerebras')) owner = 'Cerebras';
  else if (lm.includes('gemini')) owner = 'Gemini';
  else if (lm.includes('mistral') || lm.includes('mixtral')) owner = 'Mistral';
  else if (lm.includes('nvidia') || lm.includes('nemotron') || lm.startsWith('meta/')) owner = 'Nvidia';
  else if (lm.includes('phi-') || lm.includes('github')) owner = 'GithubModels';
  
  if (serviceName === owner) return modelName;
  if (serviceName === 'OpenRouter' && owner === 'OpenRouter') return modelName;
  return undefined;
}

function getServiceForModel(modelName: string, needsTools = false): AIService | undefined {
  if (isGenericModel(modelName)) return getNextService(needsTools);
  const lm = modelName.toLowerCase();
  if (lm.includes('groq') || (lm.includes('llama') && !lm.includes('meta-llama'))) return services.find(s => s.name === 'Groq') || getNextService(needsTools);
  if (lm.includes('deepseek')) return services.find(s => s.name === 'DeepSeek') || getNextService(needsTools);
  if (lm.includes('cerebras')) return services.find(s => s.name === 'Cerebras') || getNextService(needsTools);
  if (lm.includes('gemini')) return services.find(s => s.name === 'Gemini') || getNextService(needsTools);
  if (lm.includes('mistral') || lm.includes('mixtral')) return services.find(s => s.name === 'Mistral') || services.find(s => s.name === 'Groq') || getNextService(needsTools);
  if (lm.includes('nvidia') || lm.includes('nemotron') || lm.startsWith('meta/')) return services.find(s => s.name === 'Nvidia') || getNextService(needsTools);
  if (lm.includes('phi-') || lm.includes('github')) return services.find(s => s.name === 'GithubModels') || getNextService(needsTools);
  return services.find(s => s.name === 'OpenRouter') || getNextService(needsTools);
}

// ─── Retry with Full Exhaustion + Emergency Fallback ─────────────────
// 1. Try the preferred provider first
// 2. Try ALL remaining providers in order
// 3. If everything fails, try the emergency provider one final time
// 4. Only then return an error
async function withRetry<T>(op: (svc: AIService) => Promise<T>, preferred?: AIService, needsTools = false): Promise<{ result: T; service: AIService }> {
  const tried = new Set<string>();
  let lastError: Error | null = null;

  // Build the ordered list: preferred first, then the rest
  let ordered = preferred ? [preferred, ...services.filter(s => s.name !== preferred.name)] : [...services];

  // Filter for tool-capable providers when needed
  if (needsTools) {
    ordered = ordered.filter(s => s.supportsTools);
    if (ordered.length === 0) ordered = [...services]; // fallback
    console.log(`[Router] Tools detected → filtering to: ${ordered.map(s => s.name).join(', ')}`);
  }

  // Phase 1: Try ALL providers in order (no arbitrary cap)
  for (let i = 0; i < ordered.length; i++) {
    const svc = ordered[i];
    if (!svc || tried.has(svc.name)) continue;
    tried.add(svc.name);
    const t0 = Date.now();
    try {
      console.log(`[Retry ${tried.size}/${ordered.length}] Trying ${svc.name}...`);
      let tid: ReturnType<typeof setTimeout>;
      const result = await Promise.race([op(svc), new Promise<never>((_, rej) => { tid = setTimeout(() => rej(new Error(`Timeout ${REQUEST_TIMEOUT_MS}ms`)), REQUEST_TIMEOUT_MS); })]);
      clearTimeout(tid!);
      usageTracker.record(svc.name, true, Date.now() - t0);
      return { result, service: svc };
    } catch (e: any) {
      lastError = e;
      usageTracker.record(svc.name, false, Date.now() - t0, e.message);
      console.error(`[Retry] ${svc.name} failed: ${e.message}`);
    }
  }

  // Phase 2: Emergency free fallback — retry a designated free provider
  const emergencyFree = services.find(s => s.name === EMERGENCY_FREE_PROVIDER);
  if (emergencyFree && (!needsTools || emergencyFree.supportsTools)) {
    console.warn(`[⚠️ Emergency Free] All ${tried.size} providers failed. Retrying ${emergencyFree.name}...`);
    const t0 = Date.now();
    try {
      let tid: ReturnType<typeof setTimeout>;
      const result = await Promise.race([op(emergencyFree), new Promise<never>((_, rej) => { tid = setTimeout(() => rej(new Error(`Timeout ${REQUEST_TIMEOUT_MS}ms`)), REQUEST_TIMEOUT_MS); })]);
      clearTimeout(tid!);
      usageTracker.record(emergencyFree.name, true, Date.now() - t0);
      return { result, service: emergencyFree };
    } catch (e: any) {
      lastError = e;
      usageTracker.record(emergencyFree.name, false, Date.now() - t0, e.message);
      console.error(`[⚠️ Emergency Free] ${emergencyFree.name} also failed: ${e.message}`);
    }
  }

  // Phase 3: PAID emergency API — absolute last resort (costs real money)
  if (hasPaidEmergency && (!needsTools || emergencyService.supportsTools)) {
    console.warn(`[🚨 PAID Emergency] All free providers exhausted. Using paid API...`);
    const t0 = Date.now();
    try {
      let tid: ReturnType<typeof setTimeout>;
      const result = await Promise.race([op(emergencyService), new Promise<never>((_, rej) => { tid = setTimeout(() => rej(new Error(`Timeout ${REQUEST_TIMEOUT_MS}ms`)), REQUEST_TIMEOUT_MS); })]);
      clearTimeout(tid!);
      usageTracker.record('Emergency', true, Date.now() - t0);
      return { result, service: emergencyService };
    } catch (e: any) {
      lastError = e;
      usageTracker.record('Emergency', false, Date.now() - t0, e.message);
      console.error(`[🚨 PAID Emergency] Paid API also failed: ${e.message}`);
    }
  }

  throw lastError || new Error('All services exhausted (including emergency fallback)');
}

console.log(`[Gateway] Emergency free: ${services.find(s => s.name === EMERGENCY_FREE_PROVIDER) ? EMERGENCY_FREE_PROVIDER + ' ✅' : '⚠️ NOT CONFIGURED'}`);
console.log(`[Gateway] Emergency paid: ${hasPaidEmergency ? process.env.EMERGENCY_MODEL || 'gpt-4o-mini' + ' ✅' : '⚠️ NOT CONFIGURED (set EMERGENCY_API_KEY)'}`);

const CORS_HEADERS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key' };

function buildModelsList() {
  const models: any[] = [];
  const now = Math.floor(Date.now() / 1000);
  models.push(
    { id: 'gpt-4o', object: 'model', created: now, owned_by: 'codenode-gateway' },
    { id: 'gpt-3.5-turbo', object: 'model', created: now, owned_by: 'codenode-gateway' },
    { id: 'gpt-4', object: 'model', created: now, owned_by: 'codenode-gateway' }
  );
  for (const [prov, pModels] of Object.entries(serviceModels)) {
    for (const mid of pModels) models.push({ id: mid, object: 'model', created: now, owned_by: prov.toLowerCase() });
  }
  return models;
}

function parseBody(raw: string) {
  try { return raw ? JSON.parse(raw) : {}; } catch { return null; }
}

const badJson = (h: any) => new Response(JSON.stringify({ error: { message: 'Invalid JSON body', type: 'invalid_request_error' } }), { status: 400, headers: { 'Content-Type': 'application/json', ...h } });
const noSvc = (h: any) => new Response(JSON.stringify({ error: { message: 'No services available. Configure at least one API key.', type: 'server_error' } }), { status: 503, headers: { 'Content-Type': 'application/json', ...h } });

const server = Bun.serve({
  port: process.env.PORT ?? 3000,
  error(error) {
    console.error('[FATAL]', error);
    return new Response(JSON.stringify({ error: { message: error.message, type: 'server_error' } }), { status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } });
  },
  async fetch(req) {
   try {
    const { pathname } = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });

    // Auth
    const proxyKey = process.env.API_PROXY_KEY;
    if (proxyKey && pathname !== '/health') {
      const ah = req.headers.get('Authorization') || req.headers.get('X-API-Key');
      const pk = ah?.replace(/^Bearer\s+/i, '') || '';
      if (pk !== proxyKey) return new Response(JSON.stringify({ error: { message: 'Unauthorized', type: 'auth_error' } }), { status: 401, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } });
    }

    // GET /v1/models
    if (req.method === 'GET' && (pathname === '/v1/models' || pathname === '/models')) {
      return new Response(JSON.stringify({ object: 'list', data: buildModelsList() }), { headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } });
    }

    // GET /health
    if (req.method === 'GET' && pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok', services: services.map(s => s.name), total: services.length, timestamp: Date.now() }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // GET /info
    if (req.method === 'GET' && pathname === '/info') {
      return new Response(JSON.stringify({ name: 'CodeNode LLM Gateway', version: '3.0.0', endpoints: ['/v1/chat/completions', '/v1/models', '/health', '/info', '/dashboard'], features: ['openai-compatible', 'auto-retry', 'failover', 'tool-calling', 'smart-router', 'multi-key-rotation', 'usage-tracking'], active_providers: services.map(s => s.name) }), { status: 200, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } });
    }

    // GET /dashboard
    if (req.method === 'GET' && pathname === '/dashboard') {
      return new Response(JSON.stringify({ gateway: 'CodeNode LLM Gateway v3.0', ...usageTracker.getSummary(), active_providers: services.map(s => s.name), models: serviceModels }, null, 2), { status: 200, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } });
    }

    // x402
    if (process.env.REQUIRE_PAYMENT === 'true' && req.method === 'POST') {
      const ah = req.headers.get('Authorization') || '';
      if (!ah.startsWith('L402') && !ah.includes('LSAT')) return new Response(JSON.stringify({ error: 'Payment required (x402)' }), { status: 402, headers: { 'Content-Type': 'application/json', 'WWW-Authenticate': 'L402 macaroon="..."' } });
    }

    // POST /chat (legacy)
    if (req.method === 'POST' && (pathname === '/chat' || pathname === '/v1/chat')) {
      const body = parseBody(await req.text());
      if (!body) return badJson(CORS_HEADERS);
      if (services.length === 0) return noSvc(CORS_HEADERS);
      try {
        const { result: stream, service } = await withRetry(svc => svc.chat(body.messages));
        const enc = new TextEncoder();
        const readable = new ReadableStream({ async start(ctrl) { try { for await (const c of stream) { if (c.content) ctrl.enqueue(enc.encode(c.content)); } } catch (e) { console.error('[Chat]', e); } finally { ctrl.close(); } } });
        return new Response(readable, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'X-Provider': service.name, ...CORS_HEADERS } });
      } catch (e: any) { return new Response(JSON.stringify({ error: { message: e.message, type: 'server_error' } }), { status: 502, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }); }
    }

    // POST /completion
    if (req.method === 'POST' && (pathname === '/completion' || pathname === '/v1/completion')) {
      const body = parseBody(await req.text());
      if (!body) return badJson(CORS_HEADERS);
      let messages: ChatMessage[] = body.messages || (body.prompt ? [{ role: 'user', content: body.prompt }] : []);
      if (messages.length === 0) return new Response(JSON.stringify({ error: { message: 'messages or prompt required', type: 'invalid_request' } }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      if (services.length === 0) return noSvc(CORS_HEADERS);
      try {
        const { result: msg, service } = await withRetry(svc => svc.complete(messages));
        return new Response(JSON.stringify({ response: msg?.content || '' }), { headers: { 'Content-Type': 'application/json', 'X-Provider': service.name, ...CORS_HEADERS } });
      } catch (e: any) { return new Response(JSON.stringify({ error: { message: e.message, type: 'server_error' } }), { status: 502, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }); }
    }

    // POST /v1/chat/completions (main OpenAI-compatible)
    if (req.method === 'POST' && (pathname === '/v1/chat/completions' || pathname === '/chat/completions')) {
      const body = parseBody(await req.text());
      if (!body) return badJson(CORS_HEADERS);
      const { messages, stream = false, tools, tool_choice } = body;
      const modelName = body.model || 'gpt-3.5-turbo';
      if (services.length === 0) return noSvc(CORS_HEADERS);

      const needsTools = !!(tools && tools.length > 0);
      const preferred = getServiceForModel(modelName, needsTools);
      const inputTokens = estimateMessagesTokens(messages);
      console.log(`[Router] ${modelName} | Preferred: ${preferred?.name}${needsTools ? ' | 🔧 tools' : ''} | ~${inputTokens} input tokens`);

      if (stream) {
        try {
          const { result: rs, service } = await withRetry(svc => svc.chat(messages, tools, tool_choice, resolveModelForService(modelName, svc.name)), preferred, needsTools);
          const enc = new TextEncoder();
          const id = `chatcmpl-${Date.now().toString(36)}-${Math.random().toString(36).substring(2,8)}`;
          let outputText = '';
          const readable = new ReadableStream({
            async start(ctrl) {
              try {
                for await (const delta of rs) {
                  if (delta.content) outputText += delta.content;
                  const d = JSON.stringify({ id, object: 'chat.completion.chunk', created: Math.floor(Date.now()/1000), model: modelName, choices: [{ index: 0, delta, finish_reason: null }] });
                  ctrl.enqueue(enc.encode(`data: ${d}\n\n`));
                }
                ctrl.enqueue(enc.encode(`data: ${JSON.stringify({ id, object: 'chat.completion.chunk', created: Math.floor(Date.now()/1000), model: modelName, choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] })}\n\n`));
              } catch (e: any) {
                console.error('[Stream]', e.message);
                ctrl.enqueue(enc.encode(`data: ${JSON.stringify({ id, object: 'chat.completion.chunk', created: Math.floor(Date.now()/1000), model: modelName, choices: [{ index: 0, delta: { content: `\n[Error: ${e.message}]` }, finish_reason: 'stop' }] })}\n\n`));
              } finally {
                const outputTokens = estimateResponseTokens(outputText);
                usageTracker.recordTokens(service.name, inputTokens, outputTokens);
                ctrl.enqueue(enc.encode('data: [DONE]\n\n'));
                ctrl.close();
              }
            }
          });
          return new Response(readable, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', 'X-Provider': service.name, ...CORS_HEADERS } });
        } catch (e: any) {
          return new Response(JSON.stringify({ error: { message: `All providers failed: ${e.message}`, type: 'server_error', code: 'provider_exhausted' } }), { status: 502, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } });
        }
      } else {
        try {
          const { result: msg, service } = await withRetry(svc => svc.complete(messages, tools, tool_choice, resolveModelForService(modelName, svc.name)), preferred, needsTools);
          if (msg === undefined) throw new Error('Empty response');
          const outputTokens = estimateResponseTokens(msg.content);
          usageTracker.recordTokens(service.name, inputTokens, outputTokens);
          const id = `chatcmpl-${Date.now().toString(36)}-${Math.random().toString(36).substring(2,8)}`;
          return new Response(JSON.stringify({ id, object: 'chat.completion', created: Math.floor(Date.now()/1000), model: modelName, choices: [{ index: 0, message: msg, finish_reason: msg.tool_calls ? 'tool_calls' : 'stop' }], usage: { prompt_tokens: inputTokens, completion_tokens: outputTokens, total_tokens: inputTokens + outputTokens } }), { headers: { 'Content-Type': 'application/json', 'X-Provider': service.name, ...CORS_HEADERS } });
        } catch (e: any) {
          return new Response(JSON.stringify({ error: { message: `All providers failed: ${e.message}`, type: 'server_error', code: 'provider_exhausted' } }), { status: 502, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } });
        }
      }
    }

    // POST /v1/responses (Codex)
    if (req.method === 'POST' && (pathname === '/v1/responses' || pathname === '/responses')) {
      const body = parseBody(await req.text());
      if (!body) return badJson(CORS_HEADERS);
      const messages: ChatMessage[] = (body.input || []).map((item: any) => ({
        role: item.type === 'message' ? (item.role || 'user') : 'user',
        content: item.content || item.text || ''
      }));
      if (services.length === 0) return noSvc(CORS_HEADERS);
      try {
        const { result: msg } = await withRetry(svc => svc.complete(messages));
        if (msg === undefined) throw new Error('Empty response');
        return new Response(JSON.stringify({ content: msg.content || '', type: 'text', model: body.model || 'gpt-5.2-codex' }), { headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } });
      } catch (e: any) {
        return new Response(JSON.stringify({ error: { message: e.message, type: 'server_error' } }), { status: 502, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } });
      }
    }

    return new Response(JSON.stringify({ error: { message: 'Not found', type: 'invalid_request' } }), { status: 404, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } });
   } catch (fatal: any) {
    console.error('[FATAL]', fatal);
    return new Response(JSON.stringify({ error: { message: fatal.message, type: 'server_error' } }), { status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } });
   }
  }
});

console.log(`[CodeNode LLM Gateway v3.0] Running on ${server.url}`);
console.log(`[Gateway] Retry: ALL providers + emergency | Timeout: ${REQUEST_TIMEOUT_MS/1000}s | Providers: ${services.length}`);
import type { ChatMessage } from '../types';

// ─── Token Estimation ────────────────────────────────────────────────
// Approximation: ~4 characters per token (standard for English/code mixed content)
const CHARS_PER_TOKEN = 4;

function estimateTokens(text: string | null | undefined): number {
  if (!text) return 0;
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

export function estimateMessagesTokens(messages: ChatMessage[]): number {
  let total = 0;
  for (const msg of messages) {
    total += 4; // per-message overhead (role, separators)
    total += estimateTokens(msg.content);
    if (msg.tool_calls) {
      total += estimateTokens(JSON.stringify(msg.tool_calls));
    }
  }
  return total;
}

export function estimateResponseTokens(content: string | null | undefined): number {
  return estimateTokens(content);
}

// ─── Pricing (USD per 1M tokens, as of 2026) ────────────────────────
// These are approximations for cost tracking. Update as prices change.
interface PricingTier {
  input: number;   // USD per 1M input tokens
  output: number;  // USD per 1M output tokens
}

const PRICING: Record<string, PricingTier> = {
  // Free providers — $0 on free tier, but we track "equivalent cost"
  'Groq':       { input: 0.05,  output: 0.08 },   // Free tier, but if paid
  'Cerebras':   { input: 0.10,  output: 0.10 },
  'Gemini':     { input: 0.075, output: 0.30 },
  'OpenRouter': { input: 0.05,  output: 0.05 },   // Varies by model, avg free
  'DeepSeek':   { input: 0.14,  output: 0.28 },
  'Mistral':    { input: 0.10,  output: 0.25 },
  'Nvidia':     { input: 0.10,  output: 0.10 },
  'GithubModels':{ input: 0.15, output: 0.60 },
  // Paid fallback
  'Emergency':  { input: 0.15,  output: 0.60 },   // gpt-4o-mini pricing
};

function calculateCost(provider: string, inputTokens: number, outputTokens: number): number {
  const tier = PRICING[provider] || { input: 0.50, output: 1.00 }; // conservative default
  return (inputTokens * tier.input / 1_000_000) + (outputTokens * tier.output / 1_000_000);
}

// ─── Provider Stats ──────────────────────────────────────────────────
interface ProviderStats {
  requests: number;
  successes: number;
  failures: number;
  totalLatencyMs: number;
  lastError?: string;
  lastErrorAt?: number;
  rateLimits: number;
  // Token tracking
  totalInputTokens: number;
  totalOutputTokens: number;
  estimatedCostUsd: number;
}

export class UsageTracker {
  private stats = new Map<string, ProviderStats>();
  private startedAt = Date.now();

  private ensure(provider: string): ProviderStats {
    if (!this.stats.has(provider)) {
      this.stats.set(provider, {
        requests: 0, successes: 0, failures: 0,
        totalLatencyMs: 0, rateLimits: 0,
        totalInputTokens: 0, totalOutputTokens: 0, estimatedCostUsd: 0
      });
    }
    return this.stats.get(provider)!;
  }

  record(provider: string, success: boolean, latencyMs: number, error?: string) {
    const s = this.ensure(provider);
    s.requests++;
    s.totalLatencyMs += latencyMs;
    if (success) {
      s.successes++;
    } else {
      s.failures++;
      if (error) {
        s.lastError = error;
        s.lastErrorAt = Date.now();
        if (error.includes('429')) s.rateLimits++;
      }
    }
  }

  /** Record token usage for a successful request */
  recordTokens(provider: string, inputTokens: number, outputTokens: number) {
    const s = this.ensure(provider);
    s.totalInputTokens += inputTokens;
    s.totalOutputTokens += outputTokens;
    s.estimatedCostUsd += calculateCost(provider, inputTokens, outputTokens);
  }

  getSummary() {
    const providers: Record<string, any> = {};
    let globalInputTokens = 0;
    let globalOutputTokens = 0;
    let globalCost = 0;
    let emergencyCost = 0;

    for (const [provider, s] of this.stats) {
      globalInputTokens += s.totalInputTokens;
      globalOutputTokens += s.totalOutputTokens;
      globalCost += s.estimatedCostUsd;
      if (provider === 'Emergency') emergencyCost = s.estimatedCostUsd;

      providers[provider] = {
        total_requests: s.requests,
        successes: s.successes,
        failures: s.failures,
        rate_limits_429: s.rateLimits,
        avg_latency_ms: s.requests > 0 ? Math.round(s.totalLatencyMs / s.requests) : 0,
        success_rate: s.requests > 0 ? `${((s.successes / s.requests) * 100).toFixed(1)}%` : 'N/A',
        tokens: {
          input: s.totalInputTokens,
          output: s.totalOutputTokens,
          total: s.totalInputTokens + s.totalOutputTokens
        },
        estimated_cost_usd: `$${s.estimatedCostUsd.toFixed(4)}`,
        last_error: s.lastError || null,
        last_error_at: s.lastErrorAt ? new Date(s.lastErrorAt).toISOString() : null
      };
    }

    return {
      uptime_seconds: Math.floor((Date.now() - this.startedAt) / 1000),
      uptime_human: formatUptime(Date.now() - this.startedAt),
      totals: {
        input_tokens: globalInputTokens,
        output_tokens: globalOutputTokens,
        total_tokens: globalInputTokens + globalOutputTokens,
        estimated_equivalent_cost_usd: `$${globalCost.toFixed(4)}`,
        actual_paid_cost_usd: `$${emergencyCost.toFixed(4)}`,
        saved_usd: `$${(globalCost - emergencyCost).toFixed(4)}`
      },
      providers
    };
  }
}

function formatUptime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}h ${m}m ${s % 60}s`;
}

// Singleton
export const usageTracker = new UsageTracker();

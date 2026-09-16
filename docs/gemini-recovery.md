# Gemini recovery (2026-09-16)

The gateway previously tried each provider once. With only Gemini enabled, a
single upstream 503 ended the request despite the key pool.

- Gemini now retries HTTP 408/500/502/503/504 twice, with exponential delay and
  jitter. Each SDK request has a 25-second abort timeout, keeping the three
  attempts within the existing 90-second provider deadline.
- Retries retain the same credential. A different key does not cure a model-wide
  outage. Quota errors (429), authentication errors and invalid model requests
  are not blindly retried. Normal requests still rotate through the key pool.
- All keys are deduplicated, including comma-separated and numbered variables;
  numbered variables are no longer capped at ten.
- Default model: `gemini-3-flash-preview`, verified on the deployed account.
  Override with `GEMINI_DEFAULT_MODEL`. Explicit client model names are preserved;
  clients asking for a retired or unavailable model must update that selection.
- Streaming retries happen before handing the stream to the caller. A partial
  stream is never replayed, avoiding duplicated output.
- No paid fallback, credentials or billing configuration is added.

Checks: `bun test scripts/gemini-retry.test.ts`; `bunx tsc --noEmit`.

The models endpoint advertises configured candidates, not a guarantee of quota.
Project-specific quotas remain visible in Google AI Studio. This patch does not
implement a distributed project quota ledger or Google Search grounding.

Reference: https://ai.google.dev/gemini-api/docs/troubleshooting

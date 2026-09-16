/** Retry transient outages on the same credential; never churn keys to evade quotas.
 * SDK calls abort after 25 seconds, leaving three attempts below the gateway's 90s limit.
 * Streaming is retried only before the stream has been handed to the caller.
 */
export async function retryGemini<T>(
  operation: () => Promise<T>,
  sleep: (ms: number) => Promise<void> = ms => new Promise(resolve => setTimeout(resolve, ms)),
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await operation(); }
    catch (error: any) {
      const status = Number(error?.status);
      // Quota/auth/validation errors need action, not repeated requests.
      if (attempt >= 2 || ![408, 500, 502, 503, 504].includes(status)) throw error;
      const delay = 1000 * 2 ** attempt + Math.floor(Math.random() * 250);
      console.warn(`[Gemini] Transient HTTP ${status}; retry ${attempt + 1}/2 in ${delay}ms`);
      await sleep(delay);
    }
  }
}

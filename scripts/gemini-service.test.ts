import { test, expect } from 'bun:test';

test('SDK integration recovers from 503 using the same key and current default', async () => {
  process.env.GOOGLE_GENERATIVE_AI_API_KEY = 'test-only-not-a-real-key';
  const { geminiService } = await import('../services/gemini');
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async (input: any, init: any) => {
    expect(String(input)).toContain('gemini-3-flash-preview:generateContent');
    expect(new Headers(init.headers).get('x-goog-api-key')).toBe('test-only-not-a-real-key');
    calls++;
    if (calls === 1) return new Response(JSON.stringify({error:{message:'busy'}}), {status:503});
    return new Response(JSON.stringify({candidates:[{content:{role:'model',parts:[{text:'OK'}]},finishReason:'STOP'}]}), {status:200,headers:{'Content-Type':'application/json'}});
  }) as typeof fetch;
  try {
    const result = await geminiService.complete([{role:'user',content:'hello'}]);
    expect(result?.content).toBe('OK'); expect(calls).toBe(2);
  } finally { globalThis.fetch = original; delete process.env.GOOGLE_GENERATIVE_AI_API_KEY; }
});

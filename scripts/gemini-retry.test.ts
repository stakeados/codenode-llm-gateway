import { test, expect } from 'bun:test';
import { retryGemini } from '../utils/gemini-retry';
import { KeyRotator } from '../utils/key-rotator';

test('503 retries with increasing delay and returns the real response', async () => {
  let calls = 0; const delays: number[] = [];
  const result = await retryGemini(async () => {
    if (++calls < 3) throw { status: 503 };
    return 'real response';
  }, async ms => { delays.push(ms); });
  expect(result).toBe('real response'); expect(calls).toBe(3);
  expect(delays[0]).toBeGreaterThanOrEqual(1000);
  expect(delays[1]).toBeGreaterThanOrEqual(2000);
});
test('persistent outage is bounded to three attempts', async () => {
  let calls = 0;
  await expect(retryGemini(async () => { calls++; throw { status: 503 }; }, async () => {})).rejects.toEqual({ status: 503 });
  expect(calls).toBe(3);
});
for (const status of [400, 401, 403, 404, 429]) test(`HTTP ${status} is not blindly retried`, async () => {
  let calls = 0;
  await expect(retryGemini(async () => { calls++; throw { status }; }, async () => {})).rejects.toEqual({ status });
  expect(calls).toBe(1);
});
test('deduplicates keys and accepts numbered variables above ten', () => {
  process.env.TEST_ROTATOR = 'one,two,one';
  process.env.TEST_ROTATOR_15 = 'two,three';
  try {
    const pool = new KeyRotator('TEST_ROTATOR', 'test');
    expect(pool.count).toBe(3);
    expect([pool.next(), pool.next(), pool.next(), pool.next()]).toEqual(['one','two','three','one']);
  } finally { delete process.env.TEST_ROTATOR; delete process.env.TEST_ROTATOR_15; }
});

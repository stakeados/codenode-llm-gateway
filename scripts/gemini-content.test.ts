import { test, expect } from 'bun:test';
import { geminiContents, publicImageAddress } from '../utils/gemini-content';
test('converts OpenAI text and inline images to Gemini parts', async () => {
  const result = await geminiContents([{role:'user',content:[{type:'text',text:'product'},{type:'image_url',image_url:{url:'data:image/png;base64,YWJj'}}]}]);
  expect(result).toEqual([{role:'user',parts:[{text:'product'},{inlineData:{mimeType:'image/png',data:'YWJj'}}]}]);
});
test('rejects local network addresses and permits public addresses', () => {
  for(const ip of ['127.0.0.1','10.0.0.1','169.254.169.254','192.168.0.1','::1','::ffff:127.0.0.1','fc00::1']) expect(publicImageAddress(ip)).toBe(false);
  expect(publicImageAddress('8.8.8.8')).toBe(true);
});
test('rejects unsafe URL schemes before fetching', async () => {
  await expect(geminiContents([{role:'user',content:[{type:'image_url',image_url:{url:'http://127.0.0.1/admin'}}]}])).rejects.toThrow('public HTTPS');
});

import { lookup } from 'node:dns/promises';
import { request } from 'node:https';
import { BlockList, isIP } from 'node:net';

const blocked = new BlockList();
for (const [ip, prefix] of [['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],['127.0.0.0',8],['169.254.0.0',16],['172.16.0.0',12],['192.168.0.0',16],['192.0.0.0',24],['198.18.0.0',15],['224.0.0.0',4],['240.0.0.0',4]] as const) blocked.addSubnet(ip,prefix);
export function publicImageAddress(address: string): boolean {
  if (isIP(address) === 4) return !blocked.check(address, 'ipv4');
  // Only global unicast IPv6; excludes loopback, mapped IPv4 and local networks.
  return isIP(address) === 6 && /^[23][0-9a-f]{3}:/i.test(address);
}
const MAX_BYTES = 5 * 1024 * 1024;
async function imagePart(raw: string) {
  const inline = /^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/.exec(raw);
  if (inline) {
    if (Buffer.byteLength(inline[2]!, 'base64') > MAX_BYTES) throw new Error('Image exceeds 5 MB');
    return { inlineData: { mimeType: inline[1]!, data: inline[2]! } };
  }
  const url = new URL(raw);
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) throw new Error('Image URL must use public HTTPS');
  const addresses = await lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some(a => !publicImageAddress(a.address))) throw new Error('Private image address rejected');
  const selected = addresses[0]!;
  // Pin the checked address for the connection; do not follow redirects or forward credentials.
  const result = await new Promise<{mimeType: string; data: string}>((resolve,reject) => {
    const req = request(url, { lookup: ((_host: any, options: any, cb: any) => options?.all ? cb(null,[selected]) : cb(null,selected.address,selected.family)) as any }, res => {
      const mimeType = String(res.headers['content-type'] || '').split(';')[0]!;
      if (res.statusCode !== 200 || !/^image\/(jpeg|png|webp|gif)$/.test(mimeType)) { res.resume(); reject(new Error('Image response must be a supported image without redirects')); return; }
      const chunks: Buffer[] = []; let bytes = 0;
      res.on('data', chunk => { bytes += chunk.length; if (bytes > MAX_BYTES) req.destroy(new Error('Image exceeds 5 MB')); else chunks.push(chunk); });
      res.on('error', reject);
      res.on('end', () => resolve({mimeType, data: Buffer.concat(chunks).toString('base64')}));
    });
    const timer = setTimeout(() => req.destroy(new Error('Image download timeout')), 6000);
    req.on('close', () => clearTimeout(timer)); req.on('error', reject); req.end();
  });
  return { inlineData: result };
}

export async function geminiContents(messages: any[]) {
  let images = 0;
  return Promise.all(messages.map(async message => {
    const input = Array.isArray(message.content) ? message.content : [{type:'text',text:message.content || ''}];
    const parts = await Promise.all(input.map(async (part: any) => {
      if (part.type === 'text') return {text:String(part.text || '')};
      if (part.type === 'image_url') {
        if (++images > 8) throw new Error('Maximum 8 images per request');
        return imagePart(part.image_url?.url || '');
      }
      throw new Error('Unsupported Gemini content part');
    }));
    return {role: message.role === 'assistant' ? 'model' : 'user',parts};
  }));
}

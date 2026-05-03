import Cerebras from '@cerebras/cerebras_cloud_sdk';
import { KeyRotator } from '../utils/key-rotator';
import type { AIService, ChatMessage, ChunkDelta, CompletionResponse } from '../types';

const keys = new KeyRotator('CEREBRAS_API_KEY', 'Cerebras');
const DEFAULT_MODEL = 'llama-3.3-70b';

// Pool of Cerebras SDK instances — one per API key
const clientPool = keys.all().map(key => new Cerebras({ apiKey: key }));
let poolIndex = 0;

function getClient(): Cerebras {
  const client = clientPool[poolIndex % clientPool.length]!;
  poolIndex = (poolIndex + 1) % clientPool.length;
  return client;
}

export const cerebrasService: AIService = {
  name: 'Cerebras',
  supportsTools: false,
  contextWindow: 128_000,
  async chat(messages: ChatMessage[], tools?: any[], tool_choice?: any, payloadModel?: string) {
    const options: any = {
      messages: messages as any,
      model: payloadModel || DEFAULT_MODEL,
      stream: true,
      max_completion_tokens: 4096,
      temperature: 0.6,
      top_p: 0.95
    };
    if (tools && tools.length > 0) {
      options.tools = tools;
      if (tool_choice) options.tool_choice = tool_choice;
    }

    const stream = await getClient().chat.completions.create(options) as any;

    return (async function* () {
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta || {};
        yield {
          content: delta.content,
          tool_calls: delta.tool_calls,
          role: delta.role
        } as ChunkDelta;
      }
    })()
  },
  async complete(messages: ChatMessage[], tools?: any[], tool_choice?: any, payloadModel?: string) {
    const options: any = {
      messages: messages as any,
      model: payloadModel || DEFAULT_MODEL,
      stream: false,
      max_completion_tokens: 4096,
      temperature: 0.6,
      top_p: 0.95
    };
    if (tools && tools.length > 0) {
      options.tools = tools;
      if (tool_choice) options.tool_choice = tool_choice;
    }

    const response = await getClient().chat.completions.create(options) as any;
    const message = response.choices[0]?.message || {};

    return {
       role: message.role || 'assistant',
       content: message.content || null,
       tool_calls: message.tool_calls
    } as CompletionResponse;
  }
}
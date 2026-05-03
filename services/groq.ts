import { Groq } from 'groq-sdk';
import { KeyRotator } from '../utils/key-rotator';
import type { AIService, ChatMessage, ChunkDelta, CompletionResponse } from '../types';

const keys = new KeyRotator('GROQ_API_KEY', 'Groq');
const DEFAULT_MODEL = 'llama-3.3-70b-versatile';

// Pool of Groq SDK instances — one per API key
const clientPool = keys.all().map(key => new Groq({ apiKey: key }));
let poolIndex = 0;

function getClient(): Groq {
  const client = clientPool[poolIndex % clientPool.length]!;
  poolIndex = (poolIndex + 1) % clientPool.length;
  return client;
}

export const groqService: AIService = {
  name: 'Groq',
  supportsTools: true,
  contextWindow: 128_000,

  async chat(messages: ChatMessage[], tools?: any[], tool_choice?: any, payloadModel?: string) {
    try {
      const options: any = {
        messages: messages as any,
        model: payloadModel || DEFAULT_MODEL,
        temperature: 0.6,
        stream: true
      };
      if (tools && tools.length > 0) {
        options.tools = tools;
        if (tool_choice) options.tool_choice = tool_choice;
      }

      const chatCompletion = await getClient().chat.completions.create(options) as any;

      return (async function* () {
        for await (const chunk of chatCompletion) {
           const delta = chunk.choices[0]?.delta || {};
           yield {
             content: delta.content,
             tool_calls: delta.tool_calls,
             role: delta.role
           } as ChunkDelta;
        }
      })()
    } catch (error: any) {
      console.error(`[Groq] Error: ${error.message}`, error);
      throw error;
    }
  },
  async complete(messages: ChatMessage[], tools?: any[], tool_choice?: any, payloadModel?: string) {
    const options: any = {
      messages: messages as any,
      model: payloadModel || DEFAULT_MODEL,
      temperature: 0.6,
      stream: false
    };
    if (tools && tools.length > 0) {
      options.tools = tools;
      if (tool_choice) options.tool_choice = tool_choice;
    }

    const chatCompletion = await getClient().chat.completions.create(options) as any;
    const message = chatCompletion.choices[0]?.message || {};

    return {
       role: message.role || 'assistant',
       content: message.content || null,
       tool_calls: message.tool_calls
    } as CompletionResponse;
  }
}

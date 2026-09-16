import { geminiContents } from '../utils/gemini-content';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { retryGemini } from '../utils/gemini-retry';
import { KeyRotator } from '../utils/key-rotator';
import type { AIService, ChatMessage, ChunkDelta, CompletionResponse } from '../types';

const keys = new KeyRotator('GOOGLE_GENERATIVE_AI_API_KEY', 'Gemini');
export const DEFAULT_MODEL = process.env.GEMINI_DEFAULT_MODEL?.trim() || 'gemini-3-flash-preview';

// Pool of GenAI instances — one per API key for multi-key rotation
const genAIPool = keys.all().map(key => new GoogleGenerativeAI(key));
let poolIndex = 0;

function getGenAI() {
  const instance = genAIPool[poolIndex % genAIPool.length]!;
  poolIndex = (poolIndex + 1) % genAIPool.length;
  return instance;
}

export const geminiService: AIService = {
  name: 'Gemini',
  supportsTools: false,
  contextWindow: 1_000_000,

  async chat(messages: ChatMessage[], tools?: any[], tool_choice?: any, payloadModel?: string) {
    try {
      const genAI = getGenAI();
      const model = genAI.getGenerativeModel({ model: payloadModel || DEFAULT_MODEL }, { timeout: 25_000 });

      // Gemini requires alternating user/model roles and the first message must be user
      const validMessages = await geminiContents(messages);

      // Ensure first message is user
      if (validMessages.length > 0 && validMessages[0]) {
        if (validMessages[0].role !== 'user') {
          validMessages[0].role = 'user';
        }
      }

      const history = validMessages.slice(0, -1);
      const lastMessage = validMessages[validMessages.length - 1]?.parts || [{ text: '' }];

      const chat = model.startChat({ history });
      const result = await retryGemini(() => chat.sendMessageStream(lastMessage));

      // FIX: yield ChunkDelta objects, not raw strings
      return (async function* () {
        for await (const chunk of result.stream) {
          yield {
            content: chunk.text(),
            role: 'assistant'
          } as ChunkDelta;
        }
      })();
    } catch (error: any) {
      console.error(`[Gemini] Stream failed (status ${error.status || "network"})`);
      throw error;
    }
  },

  async complete(messages: ChatMessage[], tools?: any[], tool_choice?: any, payloadModel?: string) {
    try {
      if (!messages || messages.length === 0) {
        return { role: 'assistant', content: '' } as CompletionResponse;
      }

      const genAI = getGenAI();
      const model = genAI.getGenerativeModel({ model: payloadModel || DEFAULT_MODEL }, { timeout: 25_000 });

      const validMessages = await geminiContents(messages);

      // Ensure first message is user
      if (validMessages.length > 0 && validMessages[0]) {
        if (validMessages[0].role !== 'user') {
          validMessages[0].role = 'user';
        }
      }

      const history = validMessages.slice(0, -1);
      const lastMessage = validMessages[validMessages.length - 1]?.parts || [{ text: '' }];

      const chat = model.startChat({ history });
      const result = await retryGemini(() => chat.sendMessage(lastMessage));

      // FIX: return CompletionResponse object, not raw string
      return {
        role: 'assistant',
        content: result.response.text() || null
      } as CompletionResponse;
    } catch (error: any) {
      console.error(`[Gemini] Complete failed (status ${error.status || "network"})`);
      throw error;
    }
  }
};

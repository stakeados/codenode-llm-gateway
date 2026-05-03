import { GoogleGenerativeAI } from "@google/generative-ai";
import { KeyRotator } from '../utils/key-rotator';
import type { AIService, ChatMessage, ChunkDelta, CompletionResponse } from '../types';

const keys = new KeyRotator('GOOGLE_GENERATIVE_AI_API_KEY', 'Gemini');
const DEFAULT_MODEL = 'gemini-2.0-flash';

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
      const model = genAI.getGenerativeModel({ model: payloadModel || DEFAULT_MODEL });

      // Gemini requires alternating user/model roles and the first message must be user
      let validMessages = messages.map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content || '' }],
      }));

      // Ensure first message is user
      if (validMessages.length > 0 && validMessages[0]) {
        if (validMessages[0].role !== 'user') {
          validMessages[0].role = 'user';
        }
      }

      const history = validMessages.slice(0, -1);
      const lastMessagePart = validMessages[validMessages.length - 1]?.parts[0];
      const lastMessage = lastMessagePart?.text || '';

      const chat = model.startChat({ history });
      const result = await chat.sendMessageStream(lastMessage);

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
      console.error(`[Gemini] Error: ${error.message}`, error);
      throw error;
    }
  },

  async complete(messages: ChatMessage[], tools?: any[], tool_choice?: any, payloadModel?: string) {
    try {
      if (!messages || messages.length === 0) {
        return { role: 'assistant', content: '' } as CompletionResponse;
      }

      const genAI = getGenAI();
      const model = genAI.getGenerativeModel({ model: payloadModel || DEFAULT_MODEL });

      let validMessages = messages.map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content || '' }],
      }));

      // Ensure first message is user
      if (validMessages.length > 0 && validMessages[0]) {
        if (validMessages[0].role !== 'user') {
          validMessages[0].role = 'user';
        }
      }

      const history = validMessages.slice(0, -1);
      const lastMessagePart = validMessages[validMessages.length - 1]?.parts[0];
      const lastMessage = lastMessagePart?.text || '';

      const chat = model.startChat({ history });
      const result = await chat.sendMessage(lastMessage);

      // FIX: return CompletionResponse object, not raw string
      return {
        role: 'assistant',
        content: result.response.text() || null
      } as CompletionResponse;
    } catch (error: any) {
      console.error(`[Gemini] Complete Error: ${error.message}`, error);
      throw error;
    }
  }
};

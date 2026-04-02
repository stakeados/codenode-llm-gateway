import { GoogleGenerativeAI } from "@google/generative-ai";
import type { AIService, ChatMessage } from '../types';

const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || '';
const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

export const geminiService: AIService = {
  name: 'Gemini',
  async chat(messages: ChatMessage[]) {

    try {
      // Gemini requires alternating user/model roles and the first message must be user or function_response
      // We'll simplisticly map 'system' to 'user' for the first message if needed, 
      // and consolidate consecutive same-role messages if necessary (though simple mapping is usually enough for well-behaved clients)

      let validMessages = messages.map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user', // Map assistant -> model, system -> user
        parts: [{ text: msg.content }],
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

      const chat = model.startChat({
        history,
      });

      const result = await chat.sendMessageStream(lastMessage);

      return (async function* () {
        for await (const chunk of result.stream) {
          yield chunk.text();
        }
      })()
    } catch (error: any) {
      console.error(`[Gemini] Error: ${error.message}`, error);
      throw error;
    }
  },
  async complete(messages: ChatMessage[]) {
    try {
      if (!messages || messages.length === 0) return '';


      let validMessages = messages.map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
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

      const chat = model.startChat({
        history,
      });

      const result = await chat.sendMessage(lastMessage);
      return result.response.text();
    } catch (error: any) {
      console.error(`[Gemini] Complete Error: ${error.message}`, error);
      throw error;
    }
  }
}

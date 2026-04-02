import { Groq } from 'groq-sdk';
import type { AIService, ChatMessage, ChunkDelta, CompletionResponse } from '../types';

const groq = new Groq();

export const groqService: AIService = {
  name: 'Groq',

  async chat(messages: ChatMessage[], tools?: any[], tool_choice?: any, payloadModel?: string) {
    try {
      const options: any = {
        messages: messages as any,
        model: payloadModel || "llama3-8b-8192", // Changed to llama3-8b, widely supports tools and is standard on Groq
        temperature: 0.6,
        stream: true
      };
      if (tools && tools.length > 0) {
        options.tools = tools;
        if (tool_choice) options.tool_choice = tool_choice;
      }


      const chatCompletion = await groq.chat.completions.create(options) as any;

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
      model: payloadModel || "llama3-8b-8192",
      temperature: 0.6,
      stream: false
    };
    if (tools && tools.length > 0) {
      options.tools = tools;
      if (tool_choice) options.tool_choice = tool_choice;
    }

    const chatCompletion = await groq.chat.completions.create(options) as any;
    const message = chatCompletion.choices[0]?.message || {};

    return {
       role: message.role || 'assistant',
       content: message.content || null,
       tool_calls: message.tool_calls
    } as CompletionResponse;
  }
}

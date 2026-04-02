import Cerebras from '@cerebras/cerebras_cloud_sdk';
import type { AIService, ChatMessage, ChunkDelta, CompletionResponse } from '../types';

const cerebras = new Cerebras();

export const cerebrasService: AIService = {
  name: 'Cerebras',
  async chat(messages: ChatMessage[], tools?: any[], tool_choice?: any, payloadModel?: string) {
    const options: any = {
      messages: messages as any,

      model: payloadModel || 'llama3.1-8b',

      stream: true,
      max_completion_tokens: 4096, // Reduced to be safe
      temperature: 0.6,
      top_p: 0.95
    };
    if (tools && tools.length > 0) {
      options.tools = tools;
      if (tool_choice) options.tool_choice = tool_choice;
    }

    const stream = await cerebras.chat.completions.create(options) as any;

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
      model: payloadModel || 'llama3.1-8b',
      stream: false,
      max_completion_tokens: 4096,
      temperature: 0.6,
      top_p: 0.95
    };
    if (tools && tools.length > 0) {
      options.tools = tools;
      if (tool_choice) options.tool_choice = tool_choice;
    }

    const response = await cerebras.chat.completions.create(options) as any;
    const message = response.choices[0]?.message || {};

    return {
       role: message.role || 'assistant',
       content: message.content || null,
       tool_calls: message.tool_calls
    } as CompletionResponse;
  }
}
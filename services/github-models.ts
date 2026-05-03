import { KeyRotator } from '../utils/key-rotator';
import type { AIService, ChatMessage, ChunkDelta, CompletionResponse } from '../types';

// GitHub Models — free for GitHub users
// API key: GitHub PAT (Personal Access Token) with no special scopes needed
const keys = new KeyRotator('GITHUB_MODELS_API_KEY', 'GithubModels');
const BASE_URL = 'https://models.inference.ai.azure.com/chat/completions';
const DEFAULT_MODEL = 'gpt-4o-mini';

export const githubModelsService: AIService = {
  name: 'GithubModels',
  supportsTools: true,
  contextWindow: 128_000,

  async chat(messages: ChatMessage[], tools?: any[], tool_choice?: any, payloadModel?: string) {
    const body: any = { model: payloadModel || DEFAULT_MODEL, messages, stream: true };
    if (tools?.length) {
      body.tools = tools;
      if (tool_choice) body.tool_choice = tool_choice;
    }

    const response = await fetch(BASE_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${keys.next()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw Object.assign(new Error(`${response.status} ${errText}`), { status: response.status });
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    return (async function* () {
      if (!reader) return;
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.trim() || line.includes('[DONE]')) continue;
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              const delta = data.choices?.[0]?.delta || {};
              yield { content: delta.content, tool_calls: delta.tool_calls, role: delta.role } as ChunkDelta;
            } catch { /* partial JSON */ }
          }
        }
      }
    })();
  },

  async complete(messages: ChatMessage[], tools?: any[], tool_choice?: any, payloadModel?: string) {
    const body: any = { model: payloadModel || DEFAULT_MODEL, messages };
    if (tools?.length) {
      body.tools = tools;
      if (tool_choice) body.tool_choice = tool_choice;
    }

    const response = await fetch(BASE_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${keys.next()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw Object.assign(new Error(`${response.status} ${errText}`), { status: response.status });
    }

    const data = await response.json() as any;
    const message = data.choices?.[0]?.message || {};
    return {
      role: message.role || 'assistant',
      content: message.content || null,
      tool_calls: message.tool_calls
    } as CompletionResponse;
  }
};

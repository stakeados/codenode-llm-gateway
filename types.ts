export interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content?: string | null;
  name?: string;
  tool_calls?: any[];
  tool_call_id?: string;
}

export interface ChunkDelta {
  content?: string | null;
  tool_calls?: any[];
  role?: string;
}

export interface CompletionResponse {
  role: string;
  content?: string | null;
  tool_calls?: any[];
}

export interface AIService {
  name: string;
  chat: (messages: ChatMessage[], tools?: any[], tool_choice?: any, payloadModel?: string) => Promise<AsyncIterable<ChunkDelta>>;
  complete: (messages: ChatMessage[], tools?: any[], tool_choice?: any, payloadModel?: string) => Promise<CompletionResponse | undefined>;
}
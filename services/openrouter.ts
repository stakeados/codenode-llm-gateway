import type { AIService, ChatMessage, ChunkDelta, CompletionResponse } from '../types';

export const openrouterService: AIService = {
    name: 'OpenRouter',
    async chat(messages: ChatMessage[], tools?: any[], tool_choice?: any, payloadModel?: string) {
        const body: any = {
            "model": payloadModel || "meta-llama/llama-3-8b-instruct:free",
            "messages": messages,
            "stream": true
        };

        if (tools && tools.length > 0) {
            body.tools = tools;
            if (tool_choice) body.tool_choice = tool_choice;
        }

        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
                "Content-Type": "application/json",
                "HTTP-Referer": "https://codenode.cloud",
                "X-Title": "CodeNode LLM Gateway"
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`[OpenRouter] Stream Error ${response.status}: ${errorBody}`);
            throw new Error(`${response.status} ${errorBody}`);
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        return (async function* () {
            if (!reader) return;
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value);
                const lines = chunk.split('\n').filter(line => line.trim() !== '');
                for (const line of lines) {
                    if (line.includes('[DONE]')) break;
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            const delta = data.choices?.[0]?.delta || {};
                            yield {
                                content: delta.content,
                                tool_calls: delta.tool_calls,
                                role: delta.role
                            } as ChunkDelta;
                        } catch (e) {
                            // Ignore parse errors from incomplete chunks
                        }
                    }
                }
            }
        })();
    },
    async complete(messages: ChatMessage[], tools?: any[], tool_choice?: any, payloadModel?: string) {
        const body: any = {
            "model": payloadModel || "meta-llama/llama-3-8b-instruct:free",
            "messages": messages
        };
        if (tools && tools.length > 0) {
            body.tools = tools;
            if (tool_choice) body.tool_choice = tool_choice;
        }

        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
                "Content-Type": "application/json",
                "HTTP-Referer": "https://codenode.cloud",
                "X-Title": "CodeNode LLM Gateway"
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`[OpenRouter] Complete Error ${response.status}: ${errorBody}`);
            throw new Error(`${response.status} ${errorBody}`);
        }

        const data = await response.json() as any;
        if (!data.choices || !data.choices[0]) {
            throw new Error(`OpenRouter returned unexpected response: ${JSON.stringify(data).substring(0, 200)}`);
        }

        const message = data.choices[0].message || {};
        return {
            role: message.role || 'assistant',
            content: message.content || null,
            tool_calls: message.tool_calls
        } as CompletionResponse;
    }
}

export const openRouterService = openrouterService;

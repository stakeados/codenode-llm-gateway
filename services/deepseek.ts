import type { AIService, ChatMessage, ChunkDelta, CompletionResponse } from '../types';

export const deepseekService: AIService = {
    name: 'DeepSeek',
    async chat(messages: ChatMessage[], tools?: any[], tool_choice?: any, payloadModel?: string) {
        const body: any = {
            "model": payloadModel || "deepseek-chat",
            "messages": messages,
            "stream": true
        };
        if (tools && tools.length > 0) {
            body.tools = tools;
            if (tool_choice) body.tool_choice = tool_choice;
        }

        const response = await fetch("https://api.deepseek.com/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.DEEPSEEK_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
        });

        // Check for HTTP errors before trying to parse stream
        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`${response.status} ${errText}`);
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
                        }
                    }
                }
            }
        })();
    },
    async complete(messages: ChatMessage[], tools?: any[], tool_choice?: any, payloadModel?: string) {
        const body: any = {
            "model": payloadModel || "deepseek-chat",
            "messages": messages
        };
        if (tools && tools.length > 0) {
            body.tools = tools;
            if (tool_choice) body.tool_choice = tool_choice;
        }

        const response = await fetch("https://api.deepseek.com/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.DEEPSEEK_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
        });

        // Check for HTTP errors before trying to parse JSON
        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`${response.status} ${errText}`);
        }

        const data = await response.json() as any;
        if (!data.choices || !data.choices[0]) {
            throw new Error(`DeepSeek returned unexpected response: ${JSON.stringify(data).substring(0, 200)}`);
        }

        const message = data.choices[0].message || {};
        return {
            role: message.role || 'assistant',
            content: message.content || null,
            tool_calls: message.tool_calls
        } as CompletionResponse;
    }
}

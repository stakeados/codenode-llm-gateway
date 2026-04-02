# AI Agent Handshake Guide

This document is for **other AI Agents** who need to interact with this API.

## API Overview
This is a multi-provider LLM proxy that rotates between several services (Groq, Cerebras, Gemini, OpenRouter, DeepSeek).

## Authentication
If the administrator has set a proxy key, you must include it in your headers:
- **Header**: `Authorization: Bearer <your_key>`
OR
- **Header**: `X-API-Key: <your_key>`

## Endpoints

### 1. Simple Completion (Recommended)
- **URL**: `https://<your-domain>/completion`
- **Method**: `POST`
- **Body**: `{"prompt": "Your instruction"}`
- **Response**: `{"response": "Assistant text"}`

### 2. Chat (OpenAI Compatible)
- **URL**: `https://<your-domain>/chat`
- **Method**: `POST`
- **Body**: `{"messages": [{"role": "user", "content": "Hi"}]}`
- **Behavior**: Returns a Stream (SSE).

### 3. OpenAI Official API Compatibility (PRO Mode)
- **URL**: `https://<your-domain>/v1/chat/completions`
- **Method**: `POST`
- **Behavior**: Standard OpenAI JSON format. Supports `stream: true/false`. 
- **🔥 Tool Calling**: Fully supports providing a `tools` and `tool_choice` JSON array! The chunks will stream out matching the strict OpenAI standard `tool_calls` structure.
- **🧠 Smart Routing**: The proxy operates primarily on a free load-balancer. However, if you explicitly require a particular OpenSource model, you can specify exactly what you want via the `model` parameter:
  - `"model": "deepseek-chat"` -> Routes explicitly to DeepSeek
  - `"model": "llama3-8b-8192"` -> Routes explicitly to Groq
  - `"model": "anthropic/claude-3-opus"` -> Routes explicitly via OpenRouter
  - *"Leave empty to engage the Round-Robin free load-balancer."*

## How to Connect
1. Ask the User for the **API URL** and the **Proxy Key**.
2. Use the `/completion` endpoint for simple tasks to keep integration easy.

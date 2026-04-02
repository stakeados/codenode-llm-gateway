# Cómo usar tu API de IA Privada

¡Listo, socio! Ya tienes tu propio "proxy" de modelos de lenguaje corriendo con Bun. Aquí tienes cómo ponerlo en marcha y usarlo desde otros proyectos.

## 1. Configuración de API Keys

Crea un archivo llamado `.env` en la raíz de este proyecto (puedes copiar el `.env.example`) y añade tus llaves:

```env
GROQ_API_KEY=tu_llave_de_groq
CEREBRAS_API_KEY=tu_llave_de_cerebras
GOOGLE_GENERATIVE_AI_API_KEY=tu_llave_de_gemini
PORT=3000
```

## 2. Ejecución

Para arrancar el servidor en modo desarrollo (con auto-recarga):

```bash
# Usa la ruta completa si 'bun' no está en tu PATH global todavía
~\.bun\bin\bun dev
```

El servidor estará escuchando en `http://localhost:3000`.

## 3. Hacer llamadas desde otro proyecto

### Opción A: Streaming (Chat interactivo)
Ideal para aplicaciones web o chats en tiempo real. Usa el endpoint `/chat`.

```javascript
// ... (ejemplo de fetch con stream)
```

### Opción B: Respuesta Directa (Ideal para n8n)
Usa el endpoint `/completion`. Devuelve un JSON con la respuesta completa.

```bash
curl -X POST http://localhost:3000/completion \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Hola, dime un chiste corto"}'
```

Respuesta: `{"response": "¿Por qué los pájaros no usan Facebook? Porque ya tienen Twitter (X)."}`

### Opción C: Compatibilidad "Oficial" OpenAI (¡Nuevo!)
Si tu programa te pide una "OpenAI Base URL" y una "API Key", usa esto:

*   **URL Base:** `http://tu-vps:3000/v1` (o solo `http://tu-vps:3000`)
*   **API Key:** La que pusiste en `API_PROXY_KEY`.
*   **Modelo:** Puedes poner cualquiera (ej: `gpt-3.5-turbo`), la API lo aceptará pero usará los modelos configurados en tu rotación.

```bash
# Ejemplo usando el formato oficial de OpenAI
curl https://tu-api.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TU_CLAVE" \
  -d '{
    "model": "gpt-3.5-turbo",
    "messages": [{"role": "user", "content": "¡Hola!"}],
    "stream": false
  }'
```

### Opción D: Compatibilidad Codex (Milhouse)
Si usas programas como Milhouse que buscan el endpoint `/responses`:

*   **URL Base**: `http://tu-vps:3000`
*   **Endpoint**: `/v1/responses`
*   **Soporte**: Mapea automáticamente el formato de Codex a tus modelos de rotación.

---

## 4. Integración con n8n

Para usar esto en n8n y que te salga **coste 0**:

1. Añade un nodo **HTTP Request**.
2. **Method**: `POST`.
3. **URL**: `http://tu-ip-o-localhost:3000/completion`.
4. **Authentication**: None (o el proxy que le pongas).
5. **Send Body**: `True`.
6. **Body Parameters**:
   - `prompt`: El texto que quieras enviar a la IA.
7. **JSON Response**: Asegúrate de que esté marcado para recibir el JSON.

La respuesta estará en el campo `response`.

## 5. Cómo funciona la rotación
...

Cada vez que haces una petición a `/chat`, el servidor elige el siguiente servicio en la lista:
1. Groq
2. Cerebras
3. Gemini (¡Añadido!)
4. OpenRouter (¡Acceso a 100+ modelos!)
5. DeepSeek (¡Potencia bruta!)

Esto te permite saltarte límites de rate-limit y aprovechar lo mejor de cada uno.

## 5. Añadir más modelos

Para añadir un nuevo modelo (ej. Anthropic, OpenAI, o uno local con Ollama):
1. Crea un archivo en `/services/nombre.ts`.
2. Implementa la interfaz `AIService` (mira `gemini.ts` como ejemplo).
3. Regístralo en `index.ts` añadiéndolo al array `services`.

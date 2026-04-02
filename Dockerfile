# 1. Etapa de Construcción (Build)
FROM oven/bun:1-alpine AS builder

WORKDIR /app

# Cachear dependencias
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# 2. Etapa Final (Runtime)
FROM oven/bun:1-alpine

WORKDIR /app

# Copiar solo node_modules y el código necesario desde el builder
COPY --from=builder /app/node_modules ./node_modules
COPY . .

# Usar el usuario sin privilegios que viene por defecto en la imagen de oven/bun
USER bun

EXPOSE 3000

CMD ["bun", "run", "index.ts"]

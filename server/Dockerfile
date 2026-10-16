FROM node:20-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci && npx prisma generate
COPY . .
ENV NODE_ENV=production
EXPOSE 4000
# Apply migrations, then start the API
CMD ["sh", "-c", "npx prisma migrate deploy && node src/server.js"]

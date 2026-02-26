FROM node:20-alpine

WORKDIR /app

# Install deps first (better layer caching)
COPY backend/package*.json ./
RUN npm ci || npm install

# Copy backend source
COPY backend/ .

ENV NODE_ENV=production
EXPOSE 3001

CMD ["node", "server.js"]

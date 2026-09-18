FROM node:24-bookworm-slim

ENV NODE_ENV=production
WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force

COPY . .

ENV PORT=8080
EXPOSE 8080

CMD ["npm","start"]

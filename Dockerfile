
FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY src ./src
COPY public ./public

RUN npx @tailwindcss/cli \
    -i ./src/input.css \
    -o ./public/styles.css

FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=build /app/src ./src
COPY --from=build /app/public ./public

USER node

EXPOSE 3000

CMD ["node", "src/server.js"]

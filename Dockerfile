FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

COPY src ./src
COPY public ./public

RUN npx prisma generate
RUN npx @tailwindcss/cli \
    -i ./src/input.css \
    -o ./public/styles.css

FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev && npx prisma generate

COPY --from=build /app/src ./src
COPY --from=build /app/public ./public

RUN chown -R node:node /app

USER node

EXPOSE 3000

CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && node src/server.js"]

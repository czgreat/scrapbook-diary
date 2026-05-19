FROM docker.m.daocloud.io/library/node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM docker.m.daocloud.io/library/node:22-alpine
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=80

COPY server.mjs ./
COPY --from=build /app/dist ./dist

EXPOSE 80

CMD ["node", "server.mjs"]

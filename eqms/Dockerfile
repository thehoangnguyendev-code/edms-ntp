# syntax=docker/dockerfile:1.7
ARG NODE_IMAGE=mirror.gcr.io/library/node:22-alpine

FROM ${NODE_IMAGE}

WORKDIR /app

COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev:docker"]

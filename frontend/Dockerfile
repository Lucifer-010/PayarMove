# Multi-stage Dockerfile for PayarMove Frontend

# Stage 1: Development stage (local dev with hot-reloading)
FROM node:20-alpine AS development

WORKDIR /app

COPY package.json package-lock.json* .npmrc* ./
RUN npm install

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]

# Stage 2: Build stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* .npmrc* ./
RUN npm install

COPY . .

ARG VITE_API_BASE_URL=https://api.payarmove.com/api/v1
ARG VITE_FRONTEND_URL=https://payarmove.com
ARG VITE_VPS_IP=173.214.172.222

ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_FRONTEND_URL=$VITE_FRONTEND_URL \
    VITE_VPS_IP=$VITE_VPS_IP

RUN npm run build

# Stage 3: Production runner (default target)
FROM node:20-alpine AS production

WORKDIR /app

RUN npm install -g serve

COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["serve", "-s", "dist", "-l", "tcp://0.0.0.0:3000"]


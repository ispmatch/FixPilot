# syntax=docker/dockerfile:1

# ---- Base image -----------------------------------------------------------
# Node.js 18 LTS
FROM node:18-bullseye AS base

# Install the Base44 CLI globally so `base44 build` / `base44 start` are
# available for the FixPilot cloud app.
RUN npm install -g base44@latest

WORKDIR /app

# ---- Dependencies & build --------------------------------------------------
# Copy the full repository (the Base44 project lives under cloud-app/).
COPY . .

WORKDIR /app/cloud-app

RUN npm install

# Build the Base44 project (compiles the Vite frontend and prepares the
# Base44 backend per base44/config.jsonc's buildCommand).
RUN base44 build

# ---- Runtime ---------------------------------------------------------------
ENV NODE_ENV=production
ENV PORT=3000

# DATABASE_URL and ANTHROPIC_API_KEY are provided by Railway at runtime
# (configured as environment variables on the service) and are consumed
# directly by the Base44 backend functions / Anthropic integration. They
# are intentionally not declared with fixed values here so Railway's
# runtime environment always takes precedence.

EXPOSE 3000

# Serve the built frontend and backend together via the Base44 CLI.
CMD ["base44", "start", "--port", "3000"]

# syntax=docker/dockerfile:1

# ---- Base image -----------------------------------------------------------
# Node.js 18 LTS
FROM node:18-bullseye AS base

WORKDIR /app

# ---- Dependencies & build --------------------------------------------------
# Copy the full repository (the Base44 Vite frontend lives under cloud-app/).
COPY . .

WORKDIR /app/cloud-app

RUN npm install

# Compile the Vite frontend to /app/cloud-app/dist. The Base44 backend is
# hosted separately on Base44's platform and is not built or run here — the
# frontend talks to it directly via VITE_BASE44_APP_ID and
# VITE_BASE44_APP_BASE_URL (injected via base44/config.jsonc or env vars).
RUN npm run build

# Install a tiny static file server used to serve the built /dist folder.
RUN npm install --no-save http-server

# ---- Runtime ---------------------------------------------------------------
ENV NODE_ENV=production
ENV PORT=3000

# DATABASE_URL and ANTHROPIC_API_KEY may be present in the runtime
# environment but are not used by this static frontend service directly —
# they are reserved for the Base44 backend, which runs separately on
# Base44's platform, not inside this container.

EXPOSE 3000

# Serve the built Vite frontend as a static SPA on port 3000.
CMD ["npx", "http-server", "dist", "-p", "3000", "-a", "0.0.0.0"]

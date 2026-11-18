FROM node:22-alpine
WORKDIR /app
COPY services/probo-grc/bridge/package.json ./package.json
RUN npm install --omit=dev --no-audit --no-fund
COPY services/probo-grc/*.mjs ./
COPY services/probo-grc/bridge/runtime.mjs ./bridge/runtime.mjs
RUN addgroup -S bridge && adduser -S bridge -G bridge
USER bridge
ENV NODE_ENV=staging
EXPOSE 8080
CMD ["node","bridge/runtime.mjs"]

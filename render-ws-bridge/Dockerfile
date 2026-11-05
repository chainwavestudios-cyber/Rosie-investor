FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY server.js ./
COPY managed-voice-agent.cjs ./
COPY insureiq-bob-adapter.cjs ./
ENV PORT=10000
EXPOSE 10000
CMD ["node", "server.js"]
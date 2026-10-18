FROM node:22-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY . .

# Hardening: run as non-root, read-only filesystem except the mounted log volume.
RUN addgroup -S app && adduser -S app -G app
USER app

EXPOSE 4000
CMD ["node", "index.js"]

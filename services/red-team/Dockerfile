FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY . .

RUN addgroup -S app && adduser -S app -G app
USER app

CMD ["node", "index.js"]

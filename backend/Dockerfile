FROM node:24-alpine

RUN apk add --no-cache postgresql-client

WORKDIR /app

COPY package*.json ./

RUN npm install --production

COPY . .

RUN mkdir -p /app/uploads /app/backups && chown -R node:node /app/uploads /app/backups

USER node

EXPOSE 5000

CMD ["node", "server.js"]

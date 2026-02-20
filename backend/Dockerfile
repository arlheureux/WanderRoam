FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install --production

COPY . .

RUN mkdir -p /app/uploads

EXPOSE 5000

CMD ["node", "server.js"]

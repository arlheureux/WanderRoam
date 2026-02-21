FROM node:18-alpine

WORKDIR /app

COPY package.json ./

RUN npm install

COPY public ./public
COPY src ./src

RUN CI=true npm run build

FROM nginx:alpine

COPY --from=0 /app/build /usr/share/nginx/html

RUN rm /etc/nginx/conf.d/default.conf

COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

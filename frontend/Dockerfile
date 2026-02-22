FROM node:18-alpine as build

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

ARG REACT_APP_VERSION=v0.1
ARG REACT_APP_CHANNEL=stable

ENV REACT_APP_VERSION=$REACT_APP_VERSION
ENV REACT_APP_CHANNEL=$REACT_APP_CHANNEL

RUN CI=true npm run build

FROM nginx:alpine

COPY --from=build /app/build /usr/share/nginx/html

RUN rm /etc/nginx/conf.d/default.conf

COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

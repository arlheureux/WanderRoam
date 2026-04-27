FROM node:18-alpine AS build

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

ARG REACT_APP_VERSION=v0.1
ARG REACT_APP_CHANNEL=stable
ARG REACT_APP_GIT_COMMIT=unknown

ENV REACT_APP_VERSION=$REACT_APP_VERSION
ENV REACT_APP_CHANNEL=$REACT_APP_CHANNEL
ENV REACT_APP_GIT_COMMIT=$REACT_APP_GIT_COMMIT

RUN DISABLE_ESLINT_PLUGIN=true npm run build

FROM nginx:alpine

COPY --from=build /app/build /usr/share/nginx/html

RUN find /usr/share/nginx/html -type d -exec chmod 755 {} \; && \
    find /usr/share/nginx/html -type f -exec chmod 644 {} \;

RUN rm /etc/nginx/conf.d/default.conf

COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

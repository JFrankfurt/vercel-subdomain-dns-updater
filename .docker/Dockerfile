FROM node:latest as builder

RUN mkdir -p /app

COPY .docker/entrypoint.sh /usr/local/bin/entrypoint

WORKDIR /app

ENTRYPOINT ["entrypoint"]

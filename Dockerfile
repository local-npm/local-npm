FROM node:6
LABEL maintainer "William Hilton <wmhilton@gmail.com>"
WORKDIR /srv
COPY . .
RUN npm link
VOLUME /srv/data_volume
EXPOSE 80
CMD [ "modserv", "--config", "/srv/data_volume/config.json" ]

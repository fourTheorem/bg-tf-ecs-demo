FROM node:18-alpine
USER node

RUN mkdir ~/app
WORKDIR /home/node/app

ADD --chown=node:node api/package.json /home/node/app/
ADD --chown=node:node api/dist /home/node/app/dist/

EXPOSE 8080
CMD npm start

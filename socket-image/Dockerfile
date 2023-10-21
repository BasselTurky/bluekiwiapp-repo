FROM node:alpine
RUN npm install -g npm@9.7.2
WORKDIR /myhome/node/socket
COPY ./socket /myhome/node/socket/
RUN npm install
CMD npm run app 

FROM node:alpine
RUN npm install -g npm@9.7.2
WORKDIR /myhome/node/socket
COPY ./socket /myhome/node/socket/
RUN npm install
EXPOSE 3004
CMD npm run app 

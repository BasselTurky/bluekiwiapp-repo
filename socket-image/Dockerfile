FROM node:alpine
RUN npm install -g npm@10.2.1
WORKDIR /myhome/node/socket
COPY ./socket /myhome/node/socket/
RUN npm install
CMD npm run app 

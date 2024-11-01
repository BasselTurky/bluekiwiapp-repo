FROM node:alpine
RUN npm install -g npm@9.7.2
WORKDIR /myhome/node/auth
COPY ./ads /myhome/node/ads/
RUN npm install
CMD npm run app 

FROM node:alpine
ARG SSH_PRIVATE_KEY
# Set the SSH private key as an environment variable
ENV SSH_PRIVATE_KEY=Bb6708294
WORKDIR /myhome/node/auth
COPY ./auth /myhome/node/auth/
RUN npm install
CMD npm run app 

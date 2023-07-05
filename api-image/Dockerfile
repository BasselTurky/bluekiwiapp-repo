FROM node:alpine
# Install SSH client
RUN apt-get update && apt-get install -y openssh-client

# Set the SSH agent socket environment variable
ARG SSH_AUTH_SOCK
ENV SSH_AUTH_SOCK $SSH_AUTH_SOCK
WORKDIR /myhome/node/api
COPY ./api /myhome/node/api/
RUN npm install
CMD npm run app 

FROM node:alpine
ARG SSH_PRIVATE_KEY
# Set the SSH private key as an environment variable
ENV ENV SSH_AUTH_SOCK /ssh-agent
WORKDIR /myhome/node/api
COPY ./api /myhome/node/api/
RUN npm install
CMD npm run app 

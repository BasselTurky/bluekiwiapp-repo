FROM node:alpine
ARG SSH_PRIVATE_KEY
# Set the SSH private key as an environment variable
ENV ENV SSH_AUTH_SOCK /ssh-agent
WORKDIR /myhome/node/cron
COPY ./cron /myhome/node/cron/
RUN npm install
CMD npm run app 

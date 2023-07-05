FROM node:alpine
# ARG SSH_PRIVATE_KEY
# # Set the SSH private key as an environment variable
# ENV ENV SSH_AUTH_SOCK /ssh-agent

# Install SSH client
RUN apt-get update && apt-get install -y openssh-client

# Set the SSH_AUTH_SOCK environment variable
ARG SSH_AUTH_SOCK
ENV SSH_AUTH_SOCK $SSH_AUTH_SOCK

WORKDIR /myhome/node/auth
COPY ./auth /myhome/node/auth/
RUN npm install
CMD npm run app 

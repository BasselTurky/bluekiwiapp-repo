FROM node:alpine
RUN npm install -g npm@9.7.2
# # Install SSH client
# RUN apt-get update && apt-get install -y openssh-client

# # Set the SSH_AUTH_SOCK environment variable
# ARG SSH_AUTH_SOCK
# ENV SSH_AUTH_SOCK $SSH_AUTH_SOCK

# # Copy the SSH private key to the Docker image
# COPY id_rsa /home/blue/.ssh/id_rsa

# # Set the correct permissions for the private key
# RUN chmod 600 /home/blue/.ssh/id_rsa

# # Configure SSH to use the private key
# RUN echo "IdentityFile /home/blue/.ssh/id_rsa" >> /etc/ssh/ssh_config

# # Update the known_hosts file if needed
# RUN ssh-keyscan github.com >> /home/blue/.ssh/known_hosts

WORKDIR /myhome/node/cron
COPY ./cron /myhome/node/cron/
RUN npm install
CMD npm run app 

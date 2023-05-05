FROM node:20.1.0-alpine

# Create app directory
WORKDIR /usr/src/csgofloat

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json ./

RUN yarn install

# Bundle app source
COPY . .

EXPOSE 80
EXPOSE 443

CMD [ "/bin/bash", "docker/start.sh.sh" ]

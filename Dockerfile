FROM node:20.1.0

# Create app directory
WORKDIR /app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json ./
COPY yarn.lock .
COPY tsconfig.json .

RUN yarn install

# Bundle app source
COPY src/ src/
COPY docker/start.sh .
COPY config.ts .

EXPOSE 80
EXPOSE 443

CMD [ "/bin/bash", "start.sh" ]

FROM node:12-buster-slim

WORKDIR /code

COPY package*.json ./

RUN npm install

COPY . .

CMD [ "npm", "start" ]
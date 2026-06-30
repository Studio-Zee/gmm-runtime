FROM node:20-alpine

RUN apk add --no-cache curl unzip

WORKDIR /app

COPY package*.json ./

RUN npm install --omit=dev

COPY . .

EXPOSE 9090 8080

CMD ["npm", "start"]
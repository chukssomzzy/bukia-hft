FROM node:slim

WORKDIR /app

COPY package*.json ./

RUN npm ci --prefer-offline

COPY . .

EXPOSE 8000

CMD ["npm", "run", "dev"]

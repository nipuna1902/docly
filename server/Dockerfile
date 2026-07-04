FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN npx prisma generate
RUN npx tsc --project tsconfig.build.json
RUN cp -r generated dist/

EXPOSE 5000

CMD ["sh", "-c", "npx prisma migrate deploy && node --experimental-specifier-resolution=node dist/index.js"]
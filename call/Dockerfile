FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY tsconfig.json ./
COPY src ./src
RUN npm run build
ENV PORT=4000
EXPOSE 4000
CMD ["node", "dist/main.js"]

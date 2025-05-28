FROM  node:18

RUN apt-get update && apt-get install -y \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcario2 \
    libasound2 \
    && rm -rf /var/lib/apt/lists/*


WORKDIR /app

COPY package.json ./

RUN npm install

RUN npx playwright install -with-deps

COPY . .

Run npm run build


EXPOSE 1000

CMD ["node", "dist/index.js"]
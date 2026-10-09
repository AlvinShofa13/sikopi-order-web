FROM node:20-slim

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY server.js ./

# Sesi pairing Baileys (jangan hapus volume ini, atau harus scan QR ulang)
VOLUME ["/app/auth"]

EXPOSE 3001

CMD ["node", "server.js"]

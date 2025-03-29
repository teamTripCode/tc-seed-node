# Usamos una única etapa para simplificar
FROM node:20-alpine

WORKDIR /app

# Mejoramos la configuración de npm para problemas de red
RUN npm config set registry https://registry.npmjs.org/ \
    && npm config set fetch-timeout 600000 \
    && npm config set fetch-retries 5 \
    && npm config set fetch-retry-maxtimeout 120000

# Copiamos archivos de package para aprovechar la caché
COPY package*.json ./

# Instalamos dependencias con configuración tolerante a fallos de red
RUN npm install --no-fund --network-timeout=600000 --prefer-offline

# Copiamos el resto de los archivos
COPY . .

# Compilamos la aplicación NestJS
RUN npm run build && \
    find dist -name "main.js" && \
    ls -la dist/ && \
    echo "Verificando archivo principal..." && \
    if [ -f "./dist/src/main.js" ]; then echo "Archivo principal existe"; else echo "Archivo principal NO encontrado" && exit 1; fi

# Definimos variables de entorno para producción
ENV NODE_ENV=production \
    PORT=8080 \
    HTTP_PORT=8080 \
    WS_PORT=8081 \
    REDIS_URL=redis://localhost:6379 \
    CERTS_PATH=/app/certs/tls

# Creamos el directorio para los certificados
RUN mkdir -p /app/certs/tls

# Exponemos los puertos necesarios
EXPOSE 8080 8081

# Comando para iniciar la aplicación
CMD ["npm", "run", "start:prod"]
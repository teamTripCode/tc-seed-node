import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { RedisIoAdapter } from '../lib/redis-io.adapter';
import * as fs from 'fs';
import * as path from 'path';

async function bootstrap() {
  // Encontrar certificados
  const getCertPath = (fileName: string): string => {
    const possiblePaths = [
      path.join(process.cwd(), 'certs', 'tls', fileName),
      path.join(__dirname, '..', 'certs', 'tls', fileName),
      path.join(__dirname, '..', '..', 'certs', 'tls', fileName)
    ];

    for (const certPath of possiblePaths) {
      if (fs.existsSync(certPath)) {
        return certPath;
      }
    }
    throw new Error(`Certificate ${fileName} not found in: ${possiblePaths.join(', ')}`);
  };

  // Configuración de TLS/SSL usando la función helper
  const httpsOptions = {
    key: fs.readFileSync(getCertPath('private-key.pem')),
    cert: fs.readFileSync(getCertPath('public-key.pem')),
    ca: fs.readFileSync(getCertPath('ca-key.pem'))
  };

  const app = await NestFactory.create(AppModule, {
    httpsOptions,
    logger: ['error', 'warn', 'log']
  });

  app.enableCors();

  const redisIoAdapter = new RedisIoAdapter(app);
  await redisIoAdapter.connectToRedis();
  app.useWebSocketAdapter(redisIoAdapter);

  const port = process.env.PORT || 8080;
  await app.listen(port, '0.0.0.0');
}
bootstrap();
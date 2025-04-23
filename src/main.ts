import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { RedisIoAdapter } from 'lib/redis-io.adapter'; // Adjust this path as needed
import * as fs from 'fs';
import * as path from 'path';

async function bootstrap() {
  console.log('Starting application...');
  
  try {
    // Find certificates using a more robust approach
    const getCertPath = (fileName: string): string => {
      const possiblePaths = [
        path.join(process.cwd(), 'certs', 'tls', fileName),
        path.join(__dirname, '..', 'certs', 'tls', fileName),
      ];

      for (const certPath of possiblePaths) {
        if (fs.existsSync(certPath)) {
          console.log(`Found certificate ${fileName} at: ${certPath}`);
          return certPath;
        }
      }
      
      console.error(`Certificate ${fileName} not found in: ${possiblePaths.join(', ')}`);
      throw new Error(`Certificate ${fileName} not found in: ${possiblePaths.join(', ')}`);
    };

    // Create HTTPS options object
    const httpsOptions = {
      key: fs.readFileSync(getCertPath('private-key.pem')),
      cert: fs.readFileSync(getCertPath('public-key.pem')),
      // Use ca-cert.pem instead of ca-key.pem for the CA certificate
      ca: fs.readFileSync(getCertPath('ca-cert.pem')) 
    };

    console.log('Successfully loaded certificates');

    // Create the NestJS application
    const app = await NestFactory.create(AppModule, {
      httpsOptions,
      logger: ['error', 'warn', 'log'],
    });

    // Enable CORS
    app.enableCors();

    // Configure Redis WebSocket adapter if Redis is available
    try {
      const redisIoAdapter = new RedisIoAdapter(app);
      await redisIoAdapter.connectToRedis();
      app.useWebSocketAdapter(redisIoAdapter);
      console.log('Successfully connected to Redis');
    } catch (error) {
      console.error('Failed to connect to Redis:', error.message);
      console.log('Continuing without Redis adapter');
    }

    // Start the server - prodccion
    const port = process.env.PORT || 8080;
    await app.listen(port, '0.0.0.0');

    //Start the server - development
    // const port = 3000;
    // await app.listen(port);
  
    console.log(`Application is running on port ${port}`);
    
  } catch (error) {
    console.error('Failed to start application:', error);
    process.exit(1);
  }
}

bootstrap();
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private logger = new Logger(RedisService.name);
  private redisClient: RedisClientType;

  constructor() {
    this.redisClient = createClient({ url: process.env.REDIS_URL });
    this.setupRedisEventHandlers();
  }

  private setupRedisEventHandlers() {
    this.redisClient.on('error', (err) => {
      this.logger.error(`Redis Error: ${err.message}`);
    });

    this.redisClient.on('reconnecting', () => {
      this.logger.warn('Redis intentando reconectar...');
    });

    this.redisClient.on('connect', () => {
      this.logger.log('Conectado a Redis');
    });

    this.redisClient.on('end', () => {
      this.logger.warn('Redis desconectado');
    });
  }

  async onModuleInit() {
    await this.connectToRedis();
  }

  async onModuleDestroy() {
    await this.redisClient.quit();
  }

  private async connectToRedis() {
    try {
      await this.redisClient.connect();
    } catch (error) {
      this.logger.error(`Error conectando a Redis: ${error.message}`);
      setTimeout(() => this.connectToRedis(), 5000); // Reintento de conexión
    }
  }

  // perzonalice methods

  async hSet(key: string, field: string, value: string): Promise<void> {
    try {
      await this.redisClient.hSet(key, field, value);
    } catch (error) {
      this.logger.error(`Error en hSet(${key}, ${field}): ${error.message}`);
    }
  }

  async hGetAll(key: string): Promise<Record<string, string>> {
    try {
      return await this.redisClient.hGetAll(key);
    } catch (error) {
      this.logger.error(`Error en hGetAll(${key}): ${error.message}`);
      return {};
    }
  }

  async sRem(key: string, value: string): Promise<void> {
    try {
      await this.redisClient.sRem(key, value);
    } catch (error) {
      this.logger.error(`Error en sRem(${key}, ${value}): ${error.message}`);
    }
  }

  async hGet(key: string, field: string): Promise<string | null> {
    try {
      return await this.redisClient.hGet(key, field);
    } catch (error) {
      this.logger.error(`Error en hGet(${key}, ${field}): ${error.message}`);
      return null;
    }
  }

  async hDel(key: string, field: string): Promise<void> {
    try {
      await this.redisClient.hDel(key, field);
    } catch (error) {
      this.logger.error(`Error en hDel(${key}, ${field}): ${error.message}`);
    }
  }

  async setToken(clientID: string, token: string): Promise<void> {
    try {
      await this.redisClient.hSet('peerTokens', clientID, token);
    } catch (error) {
      this.logger.error(`Error al guardar token: ${error.message}`);
    }
  }

  async validateToken(clientID: string, token: string): Promise<boolean> {
    try {
      const storedToken = await this.redisClient.hGet('peerTokens', clientID);
      return storedToken === token;
    } catch (error) {
      this.logger.error(`Error al validar token: ${error.message}`);
      return false;
    }
  }

  async authenticatePeer(clientIP: string, token: string): Promise<{ clientId: string | null, isValid: boolean }> {
    if (!token) {
      this.logger.warn(`Peer ${clientIP} intentó conectarse sin token.`);
      return { clientId: null, isValid: false };
    }
  
    // Verificamos si el token existe en Redis
    const tokenData = await this.hGet('tokens', token);
    if (!tokenData) {
      this.logger.warn(`Token inválido para ${clientIP}`);
      return { clientId: null, isValid: false };
    }
  
    // Parseamos el JSON del token
    const parsedToken = JSON.parse(tokenData);
  
    if (parsedToken.isActive === false && parsedToken.clientId === 'Sin registrar') {
      // Si el token es válido pero no tiene `clientId`, asignamos uno nuevo
      const clientId = `client-${crypto.randomUUID()}`;
      parsedToken.isActive = true;
      parsedToken.clientId = clientId;
  
      // Guardamos en Redis la actualización del token
      await this.hSet('tokens', token, JSON.stringify(parsedToken));
  
      this.logger.log(`✅ Asignado clientId: ${clientId} a IP: ${clientIP}`);
      return { clientId, isValid: true };
    } else if (parsedToken.isActive === true) {
      // Si el token ya está activado, devolvemos su clientId
      return { clientId: parsedToken.clientId, isValid: true };
    }
  
    return { clientId: null, isValid: false };
  }

  async expire(key: string, seconds: number): Promise<void> {
    try {
      await this.redisClient.expire(key, seconds);
    } catch (error) {
      this.logger.error(`Error en expire(${key}, ${seconds}): ${error.message}`);
    }
  }
}

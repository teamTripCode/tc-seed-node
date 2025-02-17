import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from 'src/redis/redis.service';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly TOKEN_REGISTRATION_WINDOW = 86400; // 24 horas para registrarse
  private readonly blockedIPs = new Set<string>();

  constructor(private readonly redis: RedisService) { }

  async generateToken(): Promise<{ token: string; isActive: boolean; clientId: string }> {
    const token = crypto.randomBytes(32).toString('hex');
    const tokenData = { token, isActive: false, clientId: 'Sin registrar' };
    try {
      await this.redis.hSet('peerTokens', token, JSON.stringify(tokenData));
      await this.redis.expire(`peerToken:${token}`, this.TOKEN_REGISTRATION_WINDOW);
      this.logger.log(`Token generado: ${token}, expira en 24 horas si no se registra.`);
    } catch (error) {
      this.logger.error(`Error al generar token: ${error.message}`);
    }
    return tokenData;
  }

  async validateToken(token: string): Promise<boolean> {
    try {
      const tokenDataRaw = await this.redis.hGet('peerTokens', token);
      if (!tokenDataRaw) return false;
      const tokenData = JSON.parse(tokenDataRaw);
      const isValid = tokenData.isActive;
      this.logger.log(`Validación de token: ${isValid ? 'VÁLIDO' : 'INVÁLIDO'}`);
      return isValid;
    } catch (error) {
      this.logger.error(`Error al validar token: ${error.message}`);
      return false;
    }
  }

  async authenticatePeer(token: string): Promise<string | null> {
    try {
      const tokenDataRaw = await this.redis.hGet('peerTokens', token);
      if (!tokenDataRaw) return null;
      const tokenData = JSON.parse(tokenDataRaw);
      if (!tokenData.isActive) {
        const clientID = crypto.randomUUID();
        tokenData.isActive = true;
        tokenData.clientId = clientID;
        await this.redis.hSet('peerTokens', token, JSON.stringify(tokenData));
        this.logger.log(`Cliente autenticado con ID: ${clientID}`);
        return clientID;
      }
      return tokenData.clientId;
    } catch (error) {
      this.logger.error(`⚠️ Error en autenticación: ${error.message}`);
      return null;
    }
  }

  async revokeToken(token: string): Promise<boolean> {
    try {
      await this.redis.hDel('peerTokens', token);
      this.logger.log(`Token revocado: ${token}`);
      return true;
    } catch (error) {
      this.logger.error(`Error al revocar token: ${error.message}`);
      return false;
    }
  }

  async validateConnection(clientIP: string): Promise<boolean> {
    if (this.blockedIPs.has(clientIP)) return false;

    const cert = await this.getCertificate(clientIP);
    if (!this.isValidCertificate(cert)) {
      this.blockedIPs.add(clientIP);
      return false;
    }

    return true;
  }

  private async getCertificate(ip: string): Promise<any> {
    // Lógica para obtener certificado del cliente
    return {};
  }

  private isValidCertificate(cert: any): boolean {
    // Validar certificado
    return !!cert;
  }
}

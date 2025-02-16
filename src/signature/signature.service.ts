import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class SignatureService {
  private readonly logger = new Logger(SignatureService.name);
  private privateKey: string;
  private publicKey: string;

  constructor() {
    try {
      // Cargar claves para firmas digitales
      this.privateKey = fs.readFileSync(
        path.join(process.cwd(), 'certs', 'signature', 'private-key.pem'),
        'utf8'
      );
      this.publicKey = fs.readFileSync(
        path.join(process.cwd(), 'certs', 'signature', 'public-key.pem'),
        'utf8'
      );
    } catch (error) {
      this.logger.error(`Error al cargar las claves de firma: ${error.message}`);
      throw new Error('No se pudieron cargar las claves de firma digital');
    }
  }

  /**
   * Firma un mensaje usando la clave privada
   */
  signMessage(message: string): string {
    try {
      const sign = crypto.createSign('SHA256');
      sign.update(message);
      sign.end();
      return sign.sign(this.privateKey, 'base64');
    } catch (error) {
      this.logger.error(`Error al firmar mensaje: ${error.message}`);
      throw new Error('No se pudo firmar el mensaje');
    }
  }

  /**
   * Verifica la firma de un mensaje usando la clave pública del remitente
   */
  verifySignature(message: string, signature: string, senderPublicKey: string): boolean {
    try {
      const verify = crypto.createVerify('SHA256');
      verify.update(message);
      verify.end();
      return verify.verify(senderPublicKey, signature, 'base64');
    } catch (error) {
      this.logger.error(`Error al verificar firma: ${error.message}`);
      return false;
    }
  }

  /**
   * Obtiene la clave pública para compartir con otros nodos
   */
  getPublicKey(): string {
    return this.publicKey;
  }
}

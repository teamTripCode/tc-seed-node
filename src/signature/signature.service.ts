import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class SignatureService {
  private readonly logger = new Logger(SignatureService.name);
  private privateKey: string;
  private publicKey: string;
  private readonly certsPath: string;

  constructor() {
    // Use environment variable or default path
    this.certsPath = process.env.CERTS_PATH || path.join(process.cwd(), 'certs', 'tls');
    this.logger.log(`Loading certificates from: ${this.certsPath}`);
    
    try {
      // Load keys for digital signatures
      this.privateKey = fs.readFileSync(
        path.join(this.certsPath, 'private-key.pem'),
        'utf8'
      );
      this.publicKey = fs.readFileSync(
        path.join(this.certsPath, 'public-key.pem'),
        'utf8'
      );
      
      this.logger.log('Digital signature keys loaded successfully');
    } catch (error) {
      this.logger.error(`Error loading signature keys: ${error.message}`);
      throw new Error('Could not load digital signature keys');
    }
  }

  /**
   * Sign a message using the private key
   */
  signMessage(message: string): string {
    try {
      const sign = crypto.createSign('SHA256');
      sign.update(message);
      sign.end();
      return sign.sign(this.privateKey, 'base64');
    } catch (error) {
      this.logger.error(`Error signing message: ${error.message}`);
      throw new Error('Could not sign the message');
    }
  }

  /**
   * Verify a message signature using the sender's public key
   */
  verifySignature(message: string, signature: string, senderPublicKey: string): boolean {
    try {
      const verify = crypto.createVerify('SHA256');
      verify.update(message);
      verify.end();
      return verify.verify(senderPublicKey, signature, 'base64');
    } catch (error) {
      this.logger.error(`Error verifying signature: ${error.message}`);
      return false;
    }
  }

  /**
   * Get the public key to share with other nodes
   */
  getPublicKey(): string {
    return this.publicKey;
  }
}
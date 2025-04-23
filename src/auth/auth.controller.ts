import { Controller, Post, Body, HttpException, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    /**
     * Endpoint para generar un token.
     * Se invoca con POST /auth
     */
    @Post()
    async generateToken() {
        const tokenData = await this.authService.generateToken();
        if (!tokenData.token) {
            throw new HttpException('No se pudo generar el token', HttpStatus.INTERNAL_SERVER_ERROR);
        }
        return tokenData;
    }

    /**
     * Endpoint para autenticar un token.
     * Se invoca con POST /auth/authenticate
     */
    @Post('authenticate')
    async authenticate(@Body('token') token: string) {
        if (!token) {
            throw new HttpException('El token es requerido', HttpStatus.BAD_REQUEST);
        }
        const clientId = await this.authService.authenticatePeer(token);
        if (!clientId) {
            throw new HttpException('Autenticación fallida', HttpStatus.UNAUTHORIZED);
        }
        return { clientId };
    }

    /**
     * Opcional: Endpoint para revocar un token.
     * Se invoca con DELETE /auth
     */
    @Post('revoke')
    async revokeToken(@Body('token') token: string) {
        if (!token) {
            throw new HttpException('El token es requerido para revocar', HttpStatus.BAD_REQUEST);
        }
        const revoked = await this.authService.revokeToken(token);
        if (!revoked) {
            throw new HttpException('No se pudo revocar el token', HttpStatus.INTERNAL_SERVER_ERROR);
        }
        return { message: 'Token revocado correctamente' };
    }
}

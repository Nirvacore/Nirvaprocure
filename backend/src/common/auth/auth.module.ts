import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthMiddleware } from './auth.middleware';
import { TotpService } from './totp.service';
import { GoogleOAuthService } from './google-oauth.service';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'dev-secret-do-not-use-in-prod',
      signOptions: { expiresIn: '12h' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthMiddleware, TotpService, GoogleOAuthService],
  exports: [JwtModule, AuthMiddleware, TotpService, GoogleOAuthService],
})
export class AuthModule {}

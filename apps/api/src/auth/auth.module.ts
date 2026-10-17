import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AppConfigService } from '../config/app-config.service';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { PasswordResetService } from './password-reset.service';
import { TokenService } from './token.service';

@Module({
  imports: [
    UsersModule,
    JwtModule.registerAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        secret: config.get('JWT_ACCESS_SECRET'),
        signOptions: {
          algorithm: 'HS256',
          // Validated as /^\d+[smhd]$/ by the env schema.
          expiresIn: config.get('JWT_ACCESS_TTL') as `${number}m`,
          issuer: 'vyra-api',
        },
        verifyOptions: { algorithms: ['HS256'], issuer: 'vyra-api' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, TokenService, PasswordResetService, JwtAuthGuard, RolesGuard],
  exports: [TokenService, JwtAuthGuard, RolesGuard],
})
export class AuthModule {}

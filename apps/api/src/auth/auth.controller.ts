import { Body, Controller, Headers, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  type AuthSession,
  authSessionSchema,
  authTokensSchema,
  type AuthTokens,
  forgotPasswordSchema,
  loginSchema,
  type MessageResponse,
  messageResponseSchema,
  refreshTokenSchema,
  registerSchema,
  resetPasswordSchema,
} from '@vyra/shared';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { AuthService } from './auth.service';
import { Public } from './decorators';
import { PasswordResetService } from './password-reset.service';
import { ThrottleCredentials, ThrottlePasswordReset } from './throttle';

class RegisterDto extends createZodDto(registerSchema) {}
class LoginDto extends createZodDto(loginSchema) {}
class RefreshTokenDto extends createZodDto(refreshTokenSchema) {}
class ForgotPasswordDto extends createZodDto(forgotPasswordSchema) {}
class ResetPasswordDto extends createZodDto(resetPasswordSchema) {}
class AuthSessionDto extends createZodDto(authSessionSchema) {}
class RefreshResponseDto extends createZodDto(z.object({ tokens: authTokensSchema })) {}
class MessageResponseDto extends createZodDto(messageResponseSchema) {}

const FORGOT_PASSWORD_MESSAGE =
  'If an account exists for this email, a 6-digit code has been sent. It expires in 15 minutes.';

@ApiTags('auth')
@Public()
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly passwordReset: PasswordResetService,
  ) {}

  @Post('register')
  @ThrottleCredentials()
  @ApiOperation({ summary: 'Create an account and open a session' })
  @ApiCreatedResponse({ type: AuthSessionDto })
  @ApiConflictResponse({ description: 'CONFLICT — email already registered' })
  @ApiBadRequestResponse({ description: 'VALIDATION_ERROR' })
  register(
    @Body() body: RegisterDto,
    @Headers('user-agent') userAgent?: string,
  ): Promise<AuthSession> {
    return this.auth.register(body, userAgent);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ThrottleCredentials()
  @ApiOperation({ summary: 'Sign in with email and password' })
  @ApiOkResponse({ type: AuthSessionDto })
  @ApiUnauthorizedResponse({ description: 'AUTH_REQUIRED — incorrect email or password' })
  @ApiTooManyRequestsResponse({ description: 'RATE_LIMITED' })
  login(@Body() body: LoginDto, @Headers('user-agent') userAgent?: string): Promise<AuthSession> {
    return this.auth.login(body, userAgent);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Rotate the refresh token and get a new access token',
    description:
      'The presented refresh token is invalidated. Reusing an old token revokes the whole session.',
  })
  @ApiOkResponse({ type: RefreshResponseDto })
  @ApiUnauthorizedResponse({ description: 'AUTH_REQUIRED — session expired or revoked' })
  refresh(
    @Body() body: RefreshTokenDto,
    @Headers('user-agent') userAgent?: string,
  ): Promise<{ tokens: AuthTokens }> {
    return this.auth.refresh(body.refreshToken, userAgent);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'End the session that owns this refresh token (idempotent)' })
  @ApiNoContentResponse()
  async logout(@Body() body: RefreshTokenDto): Promise<void> {
    await this.auth.logout(body.refreshToken);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.ACCEPTED)
  @ThrottlePasswordReset()
  @ApiOperation({
    summary: 'Send a 6-digit reset code by email',
    description: 'Always answers 202 with the same message, whether or not the account exists.',
  })
  @ApiAcceptedResponse({ type: MessageResponseDto })
  async forgotPassword(@Body() body: ForgotPasswordDto): Promise<MessageResponse> {
    await this.passwordReset.request(body.email);
    return { message: FORGOT_PASSWORD_MESSAGE };
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ThrottlePasswordReset()
  @ApiOperation({
    summary: 'Set a new password with the emailed code',
    description: 'Signs out every device. The user then signs in with the new password.',
  })
  @ApiNoContentResponse()
  @ApiBadRequestResponse({ description: 'VALIDATION_ERROR — invalid or expired code' })
  async resetPassword(@Body() body: ResetPasswordDto): Promise<void> {
    await this.passwordReset.reset(body.email, body.code, body.newPassword);
  }
}

import { Body, Controller, Delete, Get, HttpCode, HttpStatus } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { type AuthUser, authUserSchema, deleteAccountSchema } from '@vyra/shared';
import { Throttle } from '@nestjs/throttler';
import { createZodDto } from 'nestjs-zod';
import { type AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators';
import { UsersService } from './users.service';

class AuthUserDto extends createZodDto(authUserSchema) {}
class DeleteAccountDto extends createZodDto(deleteAccountSchema) {}

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'The signed-in user' })
  @ApiOkResponse({ type: AuthUserDto })
  @ApiUnauthorizedResponse({ description: 'AUTH_REQUIRED' })
  me(@CurrentUser() user: AuthenticatedUser): Promise<AuthUser> {
    return this.users.getAuthUser(user.id);
  }

  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Delete my account and all its data (confirmed with the password)',
    description: 'Closet, photos, outfits, history, subscription, usage and analytics are erased.',
  })
  @ApiNoContentResponse()
  @ApiForbiddenResponse({ description: 'FORBIDDEN — WRONG_PASSWORD' })
  async deleteMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: DeleteAccountDto,
  ): Promise<void> {
    await this.users.deleteAccount(user.id, body.password);
  }
}

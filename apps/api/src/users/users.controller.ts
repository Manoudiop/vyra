import { Controller, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { type AuthUser, authUserSchema } from '@vyra/shared';
import { createZodDto } from 'nestjs-zod';
import { type AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators';
import { UsersService } from './users.service';

class AuthUserDto extends createZodDto(authUserSchema) {}

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
}

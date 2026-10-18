import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  type AdminSubscriptions,
  adminSubscriptionsQuerySchema,
  adminSubscriptionsSchema,
  type AdminUserDetail,
  adminUserDetailSchema,
  type AdminUsersPage,
  adminUsersPageSchema,
  adminUsersQuerySchema,
} from '@vyra/shared';
import { createZodDto } from 'nestjs-zod';
import { Roles } from '../auth/decorators';
import { AppException } from '../common/errors/app.exception';
import { AdminService } from './admin.service';

class UsersQueryDto extends createZodDto(adminUsersQuerySchema) {}
class UsersPageDto extends createZodDto(adminUsersPageSchema) {}
class UserDetailDto extends createZodDto(adminUserDetailSchema) {}
class SubscriptionsQueryDto extends createZodDto(adminSubscriptionsQuerySchema) {}
class SubscriptionsDto extends createZodDto(adminSubscriptionsSchema) {}

const uuid = new ParseUUIDPipe({
  exceptionFactory: () => new AppException('NOT_FOUND', 'User not found'),
});

/** Internal admin, read-only. ADMIN role only (checked on every route). */
@ApiTags('admin')
@ApiBearerAuth()
@ApiForbiddenResponse({ description: 'FORBIDDEN — admins only' })
@Roles('ADMIN')
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('users')
  @ApiOperation({ summary: 'Users, newest first (search by email or first name, filter by plan)' })
  @ApiOkResponse({ type: UsersPageDto })
  users(@Query() query: UsersQueryDto): Promise<AdminUsersPage> {
    return this.admin.users(query);
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'One user: plan, AI usage, closet and outfit activity' })
  @ApiOkResponse({ type: UserDetailDto })
  @ApiNotFoundResponse({ description: 'NOT_FOUND' })
  user(@Param('id', uuid) id: string): Promise<AdminUserDetail> {
    return this.admin.user(id);
  }

  @Get('subscriptions')
  @ApiOperation({ summary: 'Paid subscriptions in effect, with monthly recurring revenue' })
  @ApiOkResponse({ type: SubscriptionsDto })
  subscriptions(@Query() query: SubscriptionsQueryDto): Promise<AdminSubscriptions> {
    return this.admin.subscriptions(query);
  }
}

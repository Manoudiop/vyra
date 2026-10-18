import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { type UsageResponse, usageResponseSchema } from '@vyra/shared';
import { createZodDto } from 'nestjs-zod';
import { type AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators';
import { UsageService } from './usage.service';

class UsageResponseDto extends createZodDto(usageResponseSchema) {}

@ApiTags('usage')
@ApiBearerAuth()
@Controller('usage')
export class UsageController {
  constructor(private readonly usage: UsageService) {}

  @Get()
  @ApiOperation({
    summary: 'Plan and metered usage for the current periods (user’s timezone)',
    description: 'Outfit generations and clothing analyses: used, limit, remaining, resetsAt.',
  })
  @ApiOkResponse({ type: UsageResponseDto })
  get(@CurrentUser() user: AuthenticatedUser): Promise<UsageResponse> {
    return this.usage.summary(user.id);
  }
}

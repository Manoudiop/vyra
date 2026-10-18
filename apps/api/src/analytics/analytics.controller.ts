import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { type AdminMetrics, adminMetricsSchema, clientAnalyticsEventSchema } from '@vyra/shared';
import { createZodDto } from 'nestjs-zod';
import { type AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser, Roles } from '../auth/decorators';
import { PlansService } from '../subscriptions/plans.service';
import { AnalyticsService } from './analytics.service';
import { MetricsService } from './metrics.service';

class ClientEventDto extends createZodDto(clientAnalyticsEventSchema) {}
class AdminMetricsDto extends createZodDto(adminMetricsSchema) {}

@ApiTags('analytics')
@ApiBearerAuth()
@Controller('analytics')
export class AnalyticsController {
  constructor(
    private readonly analytics: AnalyticsService,
    private readonly plans: PlansService,
  ) {}

  @Post('events')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Report a UI event the server cannot see (paywall_viewed only)',
    description:
      'Every other product event is recorded server-side where it happens. Ignored when the ' +
      'user turned analytics off.',
  })
  @ApiAcceptedResponse()
  async track(@CurrentUser() user: AuthenticatedUser, @Body() body: ClientEventDto): Promise<void> {
    this.analytics.track(user.id, body.name, {
      ...body.properties,
      currentPlan: await this.plans.currentPlan(user.id),
    });
  }
}

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin')
export class AdminMetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get('metrics')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Basic product metrics (users, plans, events, conversion)' })
  @ApiOkResponse({ type: AdminMetricsDto })
  @ApiForbiddenResponse({ description: 'FORBIDDEN — admins only' })
  get(): Promise<AdminMetrics> {
    return this.metrics.compute();
  }
}

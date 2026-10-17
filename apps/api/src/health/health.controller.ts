import { Controller, Get, HttpStatus } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import {
  type HealthResponse,
  healthResponseSchema,
  type ReadinessResponse,
  readinessResponseSchema,
} from '@vyra/shared';
import { createZodDto } from 'nestjs-zod';
import { Public } from '../auth/decorators';
import { AppException } from '../common/errors/app.exception';
import { PrismaService } from '../prisma/prisma.service';
import { APP_VERSION } from '../version';

class HealthResponseDto extends createZodDto(healthResponseSchema) {}
class ReadinessResponseDto extends createZodDto(readinessResponseSchema) {}

@ApiTags('health')
@Public()
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Liveness probe (process is up)' })
  @ApiOkResponse({ type: HealthResponseDto })
  check(): HealthResponse {
    return {
      status: 'ok',
      service: 'vyra-api',
      version: APP_VERSION,
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe (dependencies reachable)' })
  @ApiOkResponse({ type: ReadinessResponseDto })
  @ApiServiceUnavailableResponse({ description: 'A dependency is unreachable' })
  async ready(): Promise<ReadinessResponse> {
    if (!(await this.prisma.isReachable())) {
      throw new AppException(
        'INTERNAL_ERROR',
        'Service not ready',
        { checks: { database: 'down' } },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    return { status: 'ready', checks: { database: 'up' } };
  }
}

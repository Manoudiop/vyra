import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { type HealthResponse, healthResponseSchema } from '@vyra/shared';
import { createZodDto } from 'nestjs-zod';
import { APP_VERSION } from '../version';

class HealthResponseDto extends createZodDto(healthResponseSchema) {}

@ApiTags('health')
@SkipThrottle()
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Liveness probe' })
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
}

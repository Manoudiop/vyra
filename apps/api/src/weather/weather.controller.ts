import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { type WeatherResponse, weatherQuerySchema, weatherResponseSchema } from '@vyra/shared';
import { createZodDto } from 'nestjs-zod';
import { type AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators';
import { WeatherService } from './weather.service';

class WeatherQueryDto extends createZodDto(weatherQuerySchema) {}
class WeatherResponseDto extends createZodDto(weatherResponseSchema) {}

@ApiTags('weather')
@ApiBearerAuth()
@Controller('weather')
export class WeatherController {
  constructor(private readonly weather: WeatherService) {}

  @Get()
  @ApiOperation({
    summary: 'Weather in the user’s city: now, or the forecast for a day (next 14 days)',
    description:
      '`weather` is null with a `reason` (NO_CITY, UNAVAILABLE, OUT_OF_RANGE) instead of an ' +
      'error: weather is optional everywhere in VYRA.',
  })
  @ApiOkResponse({ type: WeatherResponseDto })
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: WeatherQueryDto,
  ): Promise<WeatherResponse> {
    return this.weather.forUser(user.id, query.date);
  }
}

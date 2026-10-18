import { Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiPaymentRequiredResponse,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  type StyleAnalysisResult,
  styleAnalysisSchema,
  type StyleProfile,
  styleProfileSchema,
} from '@vyra/shared';
import { createZodDto } from 'nestjs-zod';
import { type AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators';
import { StyleProfileService } from './style-profile.service';

class StyleProfileDto extends createZodDto(styleProfileSchema) {}
class StyleAnalysisDto extends createZodDto(styleAnalysisSchema) {}

@ApiTags('style')
@ApiBearerAuth()
@Controller('style-profile')
export class StyleProfileController {
  constructor(private readonly profiles: StyleProfileService) {}

  @Get()
  @ApiOperation({
    summary: 'Declared preferences and what VYRA learned from ratings, wears and saves',
  })
  @ApiOkResponse({ type: StyleProfileDto })
  get(@CurrentUser() user: AuthenticatedUser): Promise<StyleProfile> {
    return this.profiles.get(user.id);
  }
}

/** Lives under /api/ai with the other AI features. */
@ApiTags('ai')
@ApiBearerAuth()
@Controller('ai')
export class StyleAnalysisController {
  constructor(private readonly profiles: StyleProfileService) {}

  @Post('analyze-style')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'AI analysis of the user’s style (PREMIUM)' })
  @ApiOkResponse({ type: StyleAnalysisDto })
  @ApiPaymentRequiredResponse({ description: 'LIMIT_REACHED — STYLE_ANALYSIS is PREMIUM' })
  @ApiUnprocessableEntityResponse({ description: 'VALIDATION_ERROR — NOT_ENOUGH_SIGNALS' })
  analyze(@CurrentUser() user: AuthenticatedUser): Promise<StyleAnalysisResult> {
    return this.profiles.analyze(user.id);
  }
}

import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBadGatewayResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  analyzeClothingRequestSchema,
  type AnalyzeClothingResponse,
  analyzeClothingResponseSchema,
} from '@vyra/shared';
import { createZodDto } from 'nestjs-zod';
import { type AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators';
import { AiService } from './ai.service';

class AnalyzeClothingRequestDto extends createZodDto(analyzeClothingRequestSchema) {}
class AnalyzeClothingResponseDto extends createZodDto(analyzeClothingResponseSchema) {}

@ApiTags('ai')
@ApiBearerAuth()
@Controller('ai')
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Post('analyze-clothing')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Identify a garment on an uploaded photo',
    description:
      'Suggests name, category, subcategory, color, style and season with per-field confidence. ' +
      'Suggestions only: the app lets the user edit everything before saving.',
  })
  @ApiOkResponse({ type: AnalyzeClothingResponseDto })
  @ApiForbiddenResponse({ description: 'FORBIDDEN — image outside your namespace' })
  @ApiBadGatewayResponse({ description: 'AI_ERROR — provider failure' })
  analyzeClothing(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: AnalyzeClothingRequestDto,
  ): Promise<AnalyzeClothingResponse> {
    return this.ai.analyzeClothing(user.id, body.imageKey);
  }
}

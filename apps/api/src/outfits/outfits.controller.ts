import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  generateOutfitRequestSchema,
  type GenerateOutfitResponse,
  generateOutfitResponseSchema,
  type Outfit,
  outfitSchema,
} from '@vyra/shared';
import { createZodDto } from 'nestjs-zod';
import { type AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators';
import { AppException } from '../common/errors/app.exception';
import { OutfitsService } from './outfits.service';

class GenerateOutfitRequestDto extends createZodDto(generateOutfitRequestSchema) {}
class GenerateOutfitResponseDto extends createZodDto(generateOutfitResponseSchema) {}
class OutfitDto extends createZodDto(outfitSchema) {}

const uuid = new ParseUUIDPipe({
  exceptionFactory: () => new AppException('NOT_FOUND', 'Outfit not found'),
});

/** The stylist endpoint lives under /api/ai, next to the other AI features. */
@ApiTags('ai')
@ApiBearerAuth()
@Controller('ai')
export class StylistController {
  constructor(private readonly outfits: OutfitsService) {}

  @Post('generate-outfit')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Generate an outfit from the user’s own closet',
    description:
      'The engine combines real closet pieces (occasion, style, preferences, recently worn ' +
      'items, feedback, constraints), the AIProvider picks and explains one. No generated images.',
  })
  @ApiOkResponse({ type: GenerateOutfitResponseDto })
  @ApiUnprocessableEntityResponse({
    description:
      'VALIDATION_ERROR — INCOMPLETE_CLOSET (with missing pieces), NO_MATCH or REQUIRED_ITEM_UNAVAILABLE',
  })
  generate(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: GenerateOutfitRequestDto,
  ): Promise<GenerateOutfitResponse> {
    return this.outfits.generate(user.id, body);
  }
}

@ApiTags('outfits')
@ApiBearerAuth()
@Controller('outfits')
export class OutfitsController {
  constructor(private readonly outfits: OutfitsService) {}

  @Get(':id')
  @ApiOperation({ summary: 'Outfit with its pieces and explanation' })
  @ApiOkResponse({ type: OutfitDto })
  @ApiNotFoundResponse({ description: 'NOT_FOUND — missing or not yours' })
  get(@CurrentUser() user: AuthenticatedUser, @Param('id', uuid) id: string): Promise<Outfit> {
    return this.outfits.get(user.id, id);
  }
}

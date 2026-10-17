import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
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
  outfitFeedbackInputSchema,
  type OutfitPage,
  outfitPageSchema,
  outfitSchema,
  outfitsQuerySchema,
  updateOutfitSchema,
} from '@vyra/shared';
import { createZodDto } from 'nestjs-zod';
import { type AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators';
import { AppException } from '../common/errors/app.exception';
import { OutfitsService } from './outfits.service';

class GenerateOutfitRequestDto extends createZodDto(generateOutfitRequestSchema) {}
class GenerateOutfitResponseDto extends createZodDto(generateOutfitResponseSchema) {}
class OutfitDto extends createZodDto(outfitSchema) {}
class OutfitPageDto extends createZodDto(outfitPageSchema) {}
class OutfitsQueryDto extends createZodDto(outfitsQuerySchema) {}
class UpdateOutfitDto extends createZodDto(updateOutfitSchema) {}
class OutfitFeedbackDto extends createZodDto(outfitFeedbackInputSchema) {}

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

  @Get()
  @ApiOperation({ summary: 'The user’s outfits, newest first (saved=true for kept looks)' })
  @ApiOkResponse({ type: OutfitPageDto })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: OutfitsQueryDto,
  ): Promise<OutfitPage> {
    return this.outfits.list(user.id, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Outfit with its pieces, explanation, rating and wear status' })
  @ApiOkResponse({ type: OutfitDto })
  @ApiNotFoundResponse({ description: 'NOT_FOUND — missing or not yours' })
  get(@CurrentUser() user: AuthenticatedUser, @Param('id', uuid) id: string): Promise<Outfit> {
    return this.outfits.get(user.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Save or unsave a look' })
  @ApiOkResponse({ type: OutfitDto })
  @ApiNotFoundResponse({ description: 'NOT_FOUND — missing or not yours' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuid) id: string,
    @Body() body: UpdateOutfitDto,
  ): Promise<Outfit> {
    return this.outfits.update(user.id, id, body);
  }

  @Post(':id/wear')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Wear this look today',
    description: 'One wear per local day (idempotent). Feeds the anti-repetition of the engine.',
  })
  @ApiOkResponse({ type: OutfitDto })
  @ApiNotFoundResponse({ description: 'NOT_FOUND — missing or not yours' })
  wear(@CurrentUser() user: AuthenticatedUser, @Param('id', uuid) id: string): Promise<Outfit> {
    return this.outfits.wear(user.id, id);
  }

  @Delete(':id/wear')
  @ApiOperation({ summary: 'Undo today’s wear (earlier days are kept)' })
  @ApiOkResponse({ type: OutfitDto })
  @ApiNotFoundResponse({ description: 'NOT_FOUND — missing or not yours' })
  unwear(@CurrentUser() user: AuthenticatedUser, @Param('id', uuid) id: string): Promise<Outfit> {
    return this.outfits.unwear(user.id, id);
  }

  @Put(':id/feedback')
  @ApiOperation({
    summary: 'Rate a look: LOVE or DISLIKE (optional reason)',
    description: 'Loved pieces are favored; the main pieces of a disliked look are avoided.',
  })
  @ApiOkResponse({ type: OutfitDto })
  @ApiNotFoundResponse({ description: 'NOT_FOUND — missing or not yours' })
  rate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuid) id: string,
    @Body() body: OutfitFeedbackDto,
  ): Promise<Outfit> {
    return this.outfits.rate(user.id, id, body);
  }

  @Delete(':id/feedback')
  @ApiOperation({ summary: 'Remove the rating' })
  @ApiOkResponse({ type: OutfitDto })
  @ApiNotFoundResponse({ description: 'NOT_FOUND — missing or not yours' })
  clearRating(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuid) id: string,
  ): Promise<Outfit> {
    return this.outfits.clearRating(user.id, id);
  }
}

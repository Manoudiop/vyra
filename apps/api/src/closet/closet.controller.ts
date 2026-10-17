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
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiPaymentRequiredResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  type ClosetPage,
  closetPageSchema,
  closetQuerySchema,
  type ClosetSummary,
  closetSummarySchema,
  type ClothingItem,
  type ClothingItemDetail,
  clothingItemDetailSchema,
  clothingItemSchema,
  createClothingItemSchema,
  updateClothingItemSchema,
} from '@vyra/shared';
import { createZodDto } from 'nestjs-zod';
import { type AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators';
import { AppException } from '../common/errors/app.exception';
import { ClosetService } from './closet.service';

class ClosetQueryDto extends createZodDto(closetQuerySchema) {}
class CreateClothingItemDto extends createZodDto(createClothingItemSchema) {}
class UpdateClothingItemDto extends createZodDto(updateClothingItemSchema) {}
class ClothingItemDto extends createZodDto(clothingItemSchema) {}
class ClothingItemDetailDto extends createZodDto(clothingItemDetailSchema) {}
class ClosetPageDto extends createZodDto(closetPageSchema) {}
class ClosetSummaryDto extends createZodDto(closetSummarySchema) {}

// A malformed id is just "not found" for the client.
const uuid = new ParseUUIDPipe({
  exceptionFactory: () => new AppException('NOT_FOUND', 'Item not found'),
});

@ApiTags('closet')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'AUTH_REQUIRED' })
@Controller('closet')
export class ClosetController {
  constructor(private readonly closet: ClosetService) {}

  @Get()
  @ApiOperation({ summary: 'List closet items (search, category, favorites, cursor pagination)' })
  @ApiOkResponse({ type: ClosetPageDto })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ClosetQueryDto,
  ): Promise<ClosetPage> {
    // Already parsed and transformed by the global ZodValidationPipe.
    return this.closet.list(user.id, query);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Item counts per category and the plan limit' })
  @ApiOkResponse({ type: ClosetSummaryDto })
  summary(@CurrentUser() user: AuthenticatedUser): Promise<ClosetSummary> {
    return this.closet.summary(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Item detail with usage statistics' })
  @ApiOkResponse({ type: ClothingItemDetailDto })
  @ApiNotFoundResponse({ description: 'NOT_FOUND — missing, archived or not yours' })
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuid) id: string,
  ): Promise<ClothingItemDetail> {
    return this.closet.get(user.id, id);
  }

  @Post()
  @ApiOperation({ summary: 'Add an item (image keys come from the upload endpoint)' })
  @ApiCreatedResponse({ type: ClothingItemDto })
  @ApiForbiddenResponse({ description: 'FORBIDDEN — image key outside your namespace' })
  @ApiPaymentRequiredResponse({ description: 'LIMIT_REACHED — closet size limit of the plan' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateClothingItemDto,
  ): Promise<ClothingItem> {
    return this.closet.create(user.id, body);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Edit any subset of an item' })
  @ApiOkResponse({ type: ClothingItemDto })
  @ApiNotFoundResponse({ description: 'NOT_FOUND' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuid) id: string,
    @Body() body: UpdateClothingItemDto,
  ): Promise<ClothingItem> {
    return this.closet.update(user.id, id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Remove an item from the closet',
    description: 'Soft delete: past outfits keep showing the piece.',
  })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: 'NOT_FOUND' })
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuid) id: string,
  ): Promise<void> {
    await this.closet.archive(user.id, id);
  }
}

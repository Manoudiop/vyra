import { randomUUID } from 'node:crypto';
import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOperation,
  ApiPayloadTooLargeResponse,
  ApiTags,
  ApiUnsupportedMediaTypeResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  deleteUploadedImageSchema,
  IMAGE_UPLOAD,
  type UploadedImage,
  uploadedImageSchema,
} from '@vyra/shared';
import { createZodDto } from 'nestjs-zod';
import { type AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators';
import { AppException } from '../common/errors/app.exception';
import { PrismaService } from '../prisma/prisma.service';
import { ImagePipeline } from './image-pipeline';
import { StorageService, userKeyPrefix } from './storage.service';

class UploadedImageDto extends createZodDto(uploadedImageSchema) {}
class DeleteUploadedImageDto extends createZodDto(deleteUploadedImageSchema) {}

@ApiTags('storage')
@ApiBearerAuth()
@Controller('storage/images')
export class ImagesController {
  constructor(
    private readonly pipeline: ImagePipeline,
    private readonly storage: StorageService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @UseInterceptors(
    FileInterceptor('file', {
      // Memory storage: the buffer is validated and re-encoded, never written as-is.
      limits: { fileSize: IMAGE_UPLOAD.maxBytes, files: 1, fields: 0, parts: 2 },
    }),
  )
  @ApiOperation({
    summary: 'Upload a clothing photo',
    description:
      'Multipart field "file". Format is detected from content (JPEG, PNG, WebP, HEIF), ' +
      'EXIF orientation applied, all metadata (incl. GPS) removed, re-encoded as WebP + thumbnail. ' +
      'Returns storage keys to pass to POST /api/closet.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } },
  })
  @ApiCreatedResponse({ type: UploadedImageDto })
  @ApiPayloadTooLargeResponse({ description: 'VALIDATION_ERROR — larger than 10 MB' })
  @ApiUnsupportedMediaTypeResponse({ description: 'VALIDATION_ERROR — not a supported image' })
  async upload(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<UploadedImage> {
    if (!file?.buffer?.length) {
      throw new AppException('VALIDATION_ERROR', 'Missing image file (multipart field "file")');
    }

    const processed = await this.pipeline.process(file.buffer);
    const base = `${userKeyPrefix(user.id)}clothing/${randomUUID()}`;
    const imageKey = `${base}.webp`;
    const thumbnailKey = `${base}_thumb.webp`;

    await Promise.all([
      this.storage.upload(imageKey, processed.image, 'image/webp'),
      this.storage.upload(thumbnailKey, processed.thumbnail, 'image/webp'),
    ]);

    const [imageUrl, thumbnailUrl] = await Promise.all([
      this.storage.getSignedUrl(imageKey),
      this.storage.getSignedUrl(thumbnailKey),
    ]);
    return {
      imageKey,
      thumbnailKey,
      imageUrl,
      thumbnailUrl,
      width: processed.width,
      height: processed.height,
      dominantColorHex: processed.dominantColorHex,
    };
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Discard an uploaded photo that was never saved to the closet',
    description: 'Refused for images used by a closet item (archive the item instead).',
  })
  @ApiNoContentResponse()
  async discard(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: DeleteUploadedImageDto,
  ): Promise<void> {
    const keys = [body.imageKey, body.thumbnailKey].filter((key): key is string => Boolean(key));
    if (keys.some((key) => !key.startsWith(userKeyPrefix(user.id)))) {
      throw new AppException('FORBIDDEN', 'Image does not belong to this account');
    }
    const used = await this.prisma.clothingItem.count({
      where: { OR: [{ imageKey: { in: keys } }, { thumbnailKey: { in: keys } }] },
    });
    if (used > 0) throw new AppException('CONFLICT', 'This image is used by a closet item');

    await Promise.all(keys.map((key) => this.storage.delete(key)));
  }
}

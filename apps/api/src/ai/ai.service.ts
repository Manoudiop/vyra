import { Injectable, Logger } from '@nestjs/common';
import { type AnalyzeClothingResponse, clothingAnalysisSchema } from '@vyra/shared';
import { AppException } from '../common/errors/app.exception';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService, userKeyPrefix } from '../storage/storage.service';
import { AIProvider } from './ai.provider';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly provider: AIProvider,
    private readonly storage: StorageService,
    private readonly prisma: PrismaService,
  ) {}

  async analyzeClothing(userId: string, imageKey: string): Promise<AnalyzeClothingResponse> {
    if (!imageKey.startsWith(userKeyPrefix(userId))) {
      throw new AppException('FORBIDDEN', 'Image does not belong to this account');
    }
    if (!(await this.storage.exists(imageKey))) {
      throw new AppException('VALIDATION_ERROR', 'Image not found. Upload the photo again.', {
        reason: 'IMAGE_NOT_FOUND',
      });
    }

    const [image, profile] = await Promise.all([
      this.storage.download(imageKey),
      this.prisma.profile.findUnique({ where: { userId }, select: { locale: true } }),
    ]);

    let raw: unknown;
    try {
      raw = await this.provider.analyzeClothing({ image, locale: profile?.locale ?? 'fr' });
    } catch (error) {
      if (error instanceof AppException) throw error;
      this.logger.error(
        `analyzeClothing failed (${this.provider.name})`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new AppException(
        'AI_ERROR',
        'The stylist could not analyze this photo. Please try again.',
      );
    }

    // Never trust provider output blindly: it must fit the shared contract.
    const parsed = clothingAnalysisSchema.safeParse(raw);
    if (!parsed.success) {
      this.logger.error(`Invalid analysis from ${this.provider.name}: ${parsed.error.message}`);
      throw new AppException(
        'AI_ERROR',
        'The stylist could not analyze this photo. Please try again.',
      );
    }
    return { analysis: parsed.data, provider: this.provider.name };
  }
}

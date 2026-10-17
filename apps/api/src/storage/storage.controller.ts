import { existsSync } from 'node:fs';
import { extname } from 'node:path';
import { Controller, Get, NotFoundException, Param, Query, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { type Response } from 'express';
import { Public } from '../auth/decorators';
import { AppException } from '../common/errors/app.exception';
import { LOCAL_FILES_ROUTE, LocalStorageAdapter } from './local-storage.adapter';
import { StorageService } from './storage.service';

const CONTENT_TYPES: Record<string, string> = {
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
};

/**
 * Serves local-disk objects behind signed URLs (development driver only).
 * Public on purpose: the signature *is* the authorization, like S3 presigned URLs.
 * Not throttled — a closet screen legitimately loads dozens of thumbnails.
 */
@ApiExcludeController()
@Public()
@SkipThrottle()
@Controller(LOCAL_FILES_ROUTE)
export class StorageController {
  constructor(private readonly storage: StorageService) {}

  @Get('*key')
  serve(
    @Param('key') key: string | string[],
    @Query('exp') exp: string | undefined,
    @Query('sig') sig: string | undefined,
    @Res() res: Response,
  ): void {
    if (!(this.storage instanceof LocalStorageAdapter)) throw new NotFoundException();

    const objectKey = Array.isArray(key) ? key.join('/') : key;
    const path = this.storage.resolveSignedPath(objectKey, exp, sig);
    if (!path) throw new AppException('FORBIDDEN', 'Invalid or expired link');
    if (!existsSync(path)) throw new NotFoundException();

    res.setHeader(
      'Content-Type',
      CONTENT_TYPES[extname(path).toLowerCase()] ?? 'application/octet-stream',
    );
    res.setHeader('Cache-Control', 'private, max-age=3600, immutable');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // helmet defaults to same-origin; images are embedded by the apps from other origins.
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.sendFile(path);
  }
}

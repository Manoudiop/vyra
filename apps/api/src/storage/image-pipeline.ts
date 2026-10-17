import { HttpStatus, Injectable } from '@nestjs/common';
import { IMAGE_UPLOAD } from '@vyra/shared';
import sharp from 'sharp';
import { AppException } from '../common/errors/app.exception';

export interface ProcessedImage {
  image: Buffer;
  thumbnail: Buffer;
  width: number;
  height: number;
  dominantColorHex: string;
}

/** Decompression-bomb guard: ~40 megapixels is more than any phone camera. */
const MAX_INPUT_PIXELS = 40_000_000;

const unsupported = (detected: string | undefined) =>
  new AppException(
    'VALIDATION_ERROR',
    'Unsupported image. Use a JPEG, PNG, WebP or HEIF photo.',
    { reason: 'UNSUPPORTED_FORMAT', detected: detected ?? 'unknown' },
    HttpStatus.UNSUPPORTED_MEDIA_TYPE,
  );

/**
 * Turns an untrusted upload into safe, normalized images:
 * - the format is detected from the bytes (magic numbers via libvips), never
 *   from the file name or the client-declared MIME type;
 * - SVG, GIF, TIFF, PDF… are refused, as are tiny and gigantic images;
 * - EXIF orientation is applied, then all metadata (EXIF, GPS, ICC) is dropped;
 * - output is a WebP (max 1600×2000) plus a 480×600 thumbnail.
 */
@Injectable()
export class ImagePipeline {
  async process(input: Buffer): Promise<ProcessedImage> {
    let metadata: sharp.Metadata;
    try {
      metadata = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS }).metadata();
    } catch {
      throw unsupported(undefined);
    }

    const accepted: readonly string[] = IMAGE_UPLOAD.acceptedFormats;
    if (!metadata.format || !accepted.includes(metadata.format)) throw unsupported(metadata.format);

    const { width = 0, height = 0 } = metadata;
    // Orientation 5–8 means the stored image is rotated a quarter turn.
    const [displayWidth, displayHeight] =
      (metadata.orientation ?? 1) >= 5 ? [height, width] : [width, height];
    if (Math.min(displayWidth, displayHeight) < IMAGE_UPLOAD.minDimension) {
      throw new AppException('VALIDATION_ERROR', 'Image is too small. Take a closer photo.', {
        reason: 'TOO_SMALL',
        minDimension: IMAGE_UPLOAD.minDimension,
      });
    }

    try {
      const base = () =>
        sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOn: 'error' }).rotate();

      const [full, thumbnail, stats] = await Promise.all([
        base()
          .resize({ width: 1600, height: 2000, fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 82 })
          .toBuffer({ resolveWithObject: true }),
        base()
          .resize({ width: 480, height: 600, fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 76 })
          .toBuffer(),
        // Color of the garment, not the backdrop: users are told to shoot on a plain
        // background, so sample the central region where the piece sits.
        // (stats() reads its *input*, so the crop is materialized first.)
        base()
          .resize(100, 100, { fit: 'fill' })
          .extract({ left: 25, top: 20, width: 50, height: 60 })
          .png()
          .toBuffer()
          .then((center) => sharp(center).stats()),
      ]);

      const { r, g, b } = stats.dominant;
      return {
        image: full.data,
        thumbnail,
        width: full.info.width,
        height: full.info.height,
        dominantColorHex:
          `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`.toUpperCase(),
      };
    } catch {
      // Truncated or corrupted files pass the header check but fail to decode.
      throw unsupported(metadata.format);
    }
  }
}

import { z } from 'zod';

/** Upload limits, shared so the app can refuse early with the same rules. */
export const IMAGE_UPLOAD = {
  maxBytes: 10 * 1024 * 1024,
  minDimension: 200,
  /** Formats detected from file content (never trusted from the name or MIME header). */
  acceptedFormats: ['jpeg', 'png', 'webp', 'heif'] as const,
  /** Client-side downscale before upload: saves mobile data, server re-encodes anyway. */
  clientMaxDimension: 1600,
} as const;

export const uploadedImageSchema = z.object({
  imageKey: z.string(),
  thumbnailKey: z.string(),
  imageUrl: z.string(),
  thumbnailUrl: z.string(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  /** Dominant color of the photo (#RRGGBB), a hint for color detection. */
  dominantColorHex: z.string().regex(/^#[0-9A-F]{6}$/),
});
export type UploadedImage = z.infer<typeof uploadedImageSchema>;

export const deleteUploadedImageSchema = z.object({
  imageKey: z.string().min(1).max(300),
  thumbnailKey: z.string().min(1).max(300).optional(),
});
export type DeleteUploadedImageInput = z.infer<typeof deleteUploadedImageSchema>;

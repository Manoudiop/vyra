import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Logger } from '@nestjs/common';
import { AppException } from '../common/errors/app.exception';
import {
  isSafeKey,
  SIGNED_URL_MIN_TTL_SECONDS,
  signingWindowStart,
  StorageService,
} from './storage.service';

export interface S3Settings {
  bucket: string;
  region: string;
  endpoint?: string;
  forcePathStyle: boolean;
  accessKeyId: string;
  secretAccessKey: string;
}

const logger = new Logger('S3Storage');

/** Logs the provider error server-side; the client only gets a stable code. */
function storageError(cause: unknown): AppException {
  logger.error(
    cause instanceof Error ? cause.message : 'S3 error',
    cause instanceof Error ? cause.stack : undefined,
  );
  return new AppException('STORAGE_ERROR', 'The file storage is unavailable. Please try again.');
}

/** Any S3-compatible service: AWS S3, Cloudflare R2, DigitalOcean Spaces, MinIO… */
export class S3StorageAdapter extends StorageService {
  private readonly client: S3Client;

  constructor(private readonly settings: S3Settings) {
    super();
    this.client = new S3Client({
      region: settings.region,
      endpoint: settings.endpoint,
      forcePathStyle: settings.forcePathStyle,
      credentials: {
        accessKeyId: settings.accessKeyId,
        secretAccessKey: settings.secretAccessKey,
      },
    });
  }

  async upload(key: string, body: Buffer, contentType: string): Promise<void> {
    this.assertKey(key);
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.settings.bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
          // Objects are immutable (new key per upload): cache aggressively.
          CacheControl: 'private, max-age=31536000, immutable',
        }),
      );
    } catch (error) {
      throw storageError(error);
    }
  }

  async delete(key: string): Promise<void> {
    this.assertKey(key);
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.settings.bucket, Key: key }));
    } catch (error) {
      throw storageError(error);
    }
  }

  async exists(key: string): Promise<boolean> {
    this.assertKey(key);
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.settings.bucket, Key: key }));
      return true;
    } catch (error) {
      if (error instanceof S3ServiceException && error.$metadata.httpStatusCode === 404)
        return false;
      throw storageError(error);
    }
  }

  getSignedUrl(key: string): Promise<string> {
    this.assertKey(key);
    // Signing at the start of the hour window yields identical URLs for an hour
    // (cache-friendly); two windows of validity keep at least one hour left.
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.settings.bucket, Key: key }),
      {
        expiresIn: 2 * SIGNED_URL_MIN_TTL_SECONDS,
        signingDate: new Date(signingWindowStart() * 1000),
      },
    );
  }

  /** Development convenience: create the bucket if it does not exist (MinIO). */
  async ensureBucket(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.settings.bucket }));
    } catch {
      await this.client.send(new CreateBucketCommand({ Bucket: this.settings.bucket }));
    }
  }

  private assertKey(key: string): void {
    if (!isSafeKey(key)) throw new Error(`Unsafe storage key: ${key}`);
  }
}

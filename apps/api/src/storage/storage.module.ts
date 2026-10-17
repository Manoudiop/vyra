import { Global, Logger, Module } from '@nestjs/common';
import { hmacSha256 } from '../common/security/tokens';
import { AppConfigService } from '../config/app-config.service';
import { ImagePipeline } from './image-pipeline';
import { ImagesController } from './images.controller';
import { LocalStorageAdapter } from './local-storage.adapter';
import { S3StorageAdapter } from './s3-storage.adapter';
import { StorageController } from './storage.controller';
import { StorageService } from './storage.service';

@Global()
@Module({
  controllers: [StorageController, ImagesController],
  providers: [
    ImagePipeline,
    {
      provide: StorageService,
      inject: [AppConfigService],
      useFactory: async (config: AppConfigService): Promise<StorageService> => {
        if (config.get('STORAGE_DRIVER') === 's3') {
          const adapter = new S3StorageAdapter({
            // Presence of these is enforced by the env schema when the driver is s3.
            bucket: config.get('S3_BUCKET')!,
            region: config.get('S3_REGION')!,
            endpoint: config.get('S3_ENDPOINT'),
            forcePathStyle: config.get('S3_FORCE_PATH_STYLE'),
            accessKeyId: config.get('S3_ACCESS_KEY_ID')!,
            secretAccessKey: config.get('S3_SECRET_ACCESS_KEY')!,
          });
          if (!config.isProduction) {
            // MinIO convenience; in production the bucket is provisioned explicitly.
            await adapter
              .ensureBucket()
              .catch((error: unknown) =>
                new Logger('Storage').warn(`Could not ensure bucket: ${String(error)}`),
              );
          }
          return adapter;
        }
        return new LocalStorageAdapter(
          config.get('STORAGE_LOCAL_DIR'),
          config.get('PUBLIC_API_URL'),
          // Dedicated key derived from the access secret (domain-separated).
          hmacSha256(config.get('JWT_ACCESS_SECRET'), 'vyra:storage-url-signing:v1'),
        );
      },
    },
  ],
  exports: [StorageService, ImagePipeline],
})
export class StorageModule {}

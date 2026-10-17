import { Global, Module } from '@nestjs/common';
import { hmacSha256 } from '../common/security/tokens';
import { AppConfigService } from '../config/app-config.service';
import { LocalStorageAdapter } from './local-storage.adapter';
import { StorageController } from './storage.controller';
import { StorageService } from './storage.service';

@Global()
@Module({
  controllers: [StorageController],
  providers: [
    {
      provide: StorageService,
      inject: [AppConfigService],
      useFactory: (config: AppConfigService): StorageService => {
        // Only the local driver exists until phase 7 adds the S3 adapter;
        // production config validation already refuses STORAGE_DRIVER=local.
        return new LocalStorageAdapter(
          config.get('STORAGE_LOCAL_DIR'),
          config.get('PUBLIC_API_URL'),
          // Dedicated key derived from the access secret (domain-separated).
          hmacSha256(config.get('JWT_ACCESS_SECRET'), 'vyra:storage-url-signing:v1'),
        );
      },
    },
  ],
  exports: [StorageService],
})
export class StorageModule {}

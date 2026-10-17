import { Global, Module } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { MAIL_PROVIDER } from './mail.provider';
import { MockMailProvider } from './mock-mail.provider';

@Global()
@Module({
  providers: [
    {
      provide: MAIL_PROVIDER,
      inject: [AppConfigService],
      // Only "mock" exists in the MVP; switch on MAIL_PROVIDER when a real one lands.
      useFactory: (config: AppConfigService) => new MockMailProvider(!config.isProduction),
    },
  ],
  exports: [MAIL_PROVIDER],
})
export class MailModule {}

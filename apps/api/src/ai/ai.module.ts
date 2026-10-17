import { Module } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { AiController } from './ai.controller';
import { AIProvider } from './ai.provider';
import { AiService } from './ai.service';
import { MockAIProvider } from './mock/mock-ai.provider';

@Module({
  controllers: [AiController],
  providers: [
    AiService,
    {
      provide: AIProvider,
      inject: [AppConfigService],
      // Only "mock" exists in the MVP (product decision); real providers plug in here.
      useFactory: (config: AppConfigService): AIProvider => {
        switch (config.get('AI_PROVIDER')) {
          case 'mock':
            return new MockAIProvider();
        }
      },
    },
  ],
  exports: [AiService, AIProvider],
})
export class AiModule {}

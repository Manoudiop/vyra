import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { ClosetModule } from '../closet/closet.module';
import { StyleAnalysisController, StyleProfileController } from './style.controller';
import { StyleLearningService } from './style-learning.service';
import { StyleProfileService } from './style-profile.service';

@Module({
  imports: [AiModule, ClosetModule],
  controllers: [StyleProfileController, StyleAnalysisController],
  providers: [StyleLearningService, StyleProfileService],
  exports: [StyleLearningService],
})
export class StyleModule {}

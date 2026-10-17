import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { ClosetModule } from '../closet/closet.module';
import { OutfitsController, StylistController } from './outfits.controller';
import { OutfitsService } from './outfits.service';

@Module({
  imports: [AiModule, ClosetModule],
  controllers: [StylistController, OutfitsController],
  providers: [OutfitsService],
  exports: [OutfitsService],
})
export class OutfitsModule {}

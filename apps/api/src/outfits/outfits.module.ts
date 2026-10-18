import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { ClosetModule } from '../closet/closet.module';
import { StyleModule } from '../style/style.module';
import { OutfitsController, StylistController } from './outfits.controller';
import { OutfitsService } from './outfits.service';

@Module({
  imports: [AiModule, ClosetModule, StyleModule],
  controllers: [StylistController, OutfitsController],
  providers: [OutfitsService],
  exports: [OutfitsService],
})
export class OutfitsModule {}

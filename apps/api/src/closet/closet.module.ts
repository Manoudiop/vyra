import { Module } from '@nestjs/common';
import { ClosetController } from './closet.controller';
import { ClosetService } from './closet.service';

@Module({
  controllers: [ClosetController],
  providers: [ClosetService],
  exports: [ClosetService],
})
export class ClosetModule {}

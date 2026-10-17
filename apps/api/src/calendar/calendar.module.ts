import { Module } from '@nestjs/common';
import { CalendarController, WearHistoryController } from './calendar.controller';
import { CalendarService } from './calendar.service';

@Module({
  controllers: [CalendarController, WearHistoryController],
  providers: [CalendarService],
})
export class CalendarModule {}

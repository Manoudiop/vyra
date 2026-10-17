import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  PipeTransform,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiPaymentRequiredResponse,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import {
  calendarDateSchema,
  type CalendarEvent,
  calendarEventSchema,
  type CalendarMonth,
  calendarMonthQuerySchema,
  calendarMonthResponseSchema,
  planDayInputSchema,
  type WearHistoryPage,
  wearHistoryPageSchema,
  wearHistoryQuerySchema,
} from '@vyra/shared';
import { createZodDto } from 'nestjs-zod';
import { type AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators';
import { AppException } from '../common/errors/app.exception';
import { CalendarService } from './calendar.service';

class CalendarMonthQueryDto extends createZodDto(calendarMonthQuerySchema) {}
class CalendarMonthDto extends createZodDto(calendarMonthResponseSchema) {}
class CalendarEventDto extends createZodDto(calendarEventSchema) {}
class PlanDayDto extends createZodDto(planDayInputSchema) {}
class WearHistoryQueryDto extends createZodDto(wearHistoryQuerySchema) {}
class WearHistoryPageDto extends createZodDto(wearHistoryPageSchema) {}

/** Validates a ":date" route segment as a real "YYYY-MM-DD" day. */
class CalendarDatePipe implements PipeTransform<string, string> {
  transform(value: string): string {
    const parsed = calendarDateSchema.safeParse(value);
    if (!parsed.success) {
      throw new AppException('VALIDATION_ERROR', 'Expected a date as YYYY-MM-DD', {
        date: value,
      });
    }
    return parsed.data;
  }
}

const GATED = 'LIMIT_REACHED — FREE plans see and plan the current week only (CALENDAR_FULL)';

@ApiTags('calendar')
@ApiBearerAuth()
@Controller('calendar')
export class CalendarController {
  constructor(private readonly calendar: CalendarService) {}

  @Get()
  @ApiOperation({
    summary: 'Planned and worn looks of a month (days in the user’s timezone)',
    description: 'FREE: only the current week is returned; `access` gives the visible range.',
  })
  @ApiOkResponse({ type: CalendarMonthDto })
  month(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: CalendarMonthQueryDto,
  ): Promise<CalendarMonth> {
    return this.calendar.month(user.id, query.month);
  }

  @Put(':date')
  @ApiOperation({ summary: 'Plan a look for a day (replaces the day’s look)' })
  @ApiOkResponse({ type: CalendarEventDto })
  @ApiNotFoundResponse({ description: 'NOT_FOUND — outfit missing or not yours' })
  @ApiUnprocessableEntityResponse({ description: 'VALIDATION_ERROR — DATE_OUT_OF_RANGE' })
  @ApiPaymentRequiredResponse({ description: GATED })
  plan(
    @CurrentUser() user: AuthenticatedUser,
    @Param('date', new CalendarDatePipe()) date: string,
    @Body() body: PlanDayDto,
  ): Promise<CalendarEvent> {
    return this.calendar.plan(user.id, date, body);
  }

  @Delete(':date')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove the planned look of a day' })
  @ApiNoContentResponse()
  @ApiPaymentRequiredResponse({ description: GATED })
  unplan(
    @CurrentUser() user: AuthenticatedUser,
    @Param('date', new CalendarDatePipe()) date: string,
  ): Promise<void> {
    return this.calendar.unplan(user.id, date);
  }
}

@ApiTags('calendar')
@ApiBearerAuth()
@Controller('wear-history')
export class WearHistoryController {
  constructor(private readonly calendar: CalendarService) {}

  @Get()
  @ApiOperation({
    summary: 'Worn looks, newest first',
    description: 'FREE: the last 7 days (`visibleFrom`); the full history is PRO.',
  })
  @ApiOkResponse({ type: WearHistoryPageDto })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: WearHistoryQueryDto,
  ): Promise<WearHistoryPage> {
    return this.calendar.wearHistory(user.id, query);
  }
}

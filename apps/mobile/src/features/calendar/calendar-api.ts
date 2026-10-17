import {
  type CalendarEvent,
  type CalendarMonth,
  type PlanDayInput,
  type WearHistoryPage,
} from '@vyra/shared';
import { authorizedRequest } from '@/lib/authorized-request';

export const calendarKeys = {
  all: ['calendar'] as const,
  month: (month: string) => [...calendarKeys.all, 'month', month] as const,
  history: () => [...calendarKeys.all, 'history'] as const,
};

export const calendarApi = {
  month: (month: string) => authorizedRequest<CalendarMonth>(`/calendar?month=${month}`),
  plan: (date: string, body: PlanDayInput) =>
    authorizedRequest<CalendarEvent>(`/calendar/${date}`, { method: 'PUT', body }),
  unplan: (date: string) => authorizedRequest<void>(`/calendar/${date}`, { method: 'DELETE' }),
  wearHistory: (cursor: string | null) =>
    authorizedRequest<WearHistoryPage>(`/wear-history${cursor ? `?cursor=${cursor}` : ''}`),
};

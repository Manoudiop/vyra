import { CalendarDays } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { EmptyState, Screen, ScreenHeader } from '@/ui';

// Phase 11 replaces this with the monthly calendar and planning sheet.
export default function CalendarScreen() {
  const { t } = useTranslation();
  return (
    <Screen testID="calendar-screen">
      <ScreenHeader title={t('calendar.title')} />
      <EmptyState
        icon={CalendarDays}
        title={t('calendar.emptyTitle')}
        body={t('calendar.emptyBody')}
      />
    </Screen>
  );
}

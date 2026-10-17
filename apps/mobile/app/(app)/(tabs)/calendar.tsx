import {
  addDays,
  type CalendarDay,
  type CalendarEvent,
  type CalendarMonth,
  daysBetween,
  monthGrid,
  shiftMonth,
} from '@vyra/shared';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import {
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  History,
  Lock,
  Sparkles,
} from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { FormBanner } from '@/features/auth/components';
import { useCalendarMonth, useDayFormat, useUnplanDay } from '@/features/calendar/hooks';
import { OutfitRow } from '@/features/calendar/OutfitRow';
import { errorMessage } from '@/lib/errors';
import {
  Button,
  Card,
  colors,
  colorsAlpha,
  ErrorState,
  haptics,
  IconButton,
  PressableScale,
  radii,
  Screen,
  ScreenHeader,
  Skeleton,
  spacing,
  Text,
} from '@/ui';

/** Today on the device, only until the API tells us the user's own "today". */
const deviceToday = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

export default function CalendarScreen() {
  const { t } = useTranslation();
  // Coming back from planning a day: show that day.
  const { date: focus } = useLocalSearchParams<{ date?: string }>();
  const [month, setMonth] = useState(() => (focus ?? deviceToday()).slice(0, 7));
  const [selected, setSelected] = useState<string | null>(focus ?? null);
  const [shownFocus, setShownFocus] = useState(focus);
  if (focus !== shownFocus) {
    setShownFocus(focus);
    if (focus) {
      setMonth(focus.slice(0, 7));
      setSelected(focus);
    }
  }
  const calendar = useCalendarMonth(month);
  const data = calendar.data?.month === month ? calendar.data : undefined;
  const today = calendar.data?.today ?? deviceToday();
  const day = selected ?? today;

  const goTo = (delta: number) => {
    haptics.selection();
    setMonth((current) => shiftMonth(current, delta));
  };

  return (
    <Screen testID="calendar-screen">
      <ScreenHeader
        title={t('calendar.title')}
        right={
          <IconButton
            testID="calendar-history"
            icon={History}
            accessibilityLabel={t('wearHistory.title')}
            onPress={() => router.push('/wear-history')}
          />
        }
      />

      <Card padded={false} style={styles.calendar}>
        <MonthHeader
          month={month}
          onPrevious={() => goTo(-1)}
          onNext={() => goTo(1)}
          onToday={
            month === today.slice(0, 7)
              ? undefined
              : () => {
                  setMonth(today.slice(0, 7));
                  setSelected(today);
                }
          }
        />
        {calendar.isError && !data ? (
          <ErrorState
            message={errorMessage(calendar.error, t)}
            onRetry={() => void calendar.refetch()}
          />
        ) : (
          <MonthGrid
            month={month}
            data={data}
            today={today}
            selected={day}
            onSelect={(value) => {
              haptics.selection();
              setSelected(value);
            }}
          />
        )}
      </Card>

      {data || calendar.data ? (
        <DayPanel
          key={day}
          date={day}
          today={today}
          entry={data?.days.find((entry) => entry.date === day)}
          access={(data ?? calendar.data)!.access}
          loading={!data}
        />
      ) : (
        <View style={styles.panelLoading}>
          <Skeleton height={28} width="55%" />
          <Skeleton height={120} radius={radii.lg} />
        </View>
      )}
    </Screen>
  );
}

function MonthHeader({
  month,
  onPrevious,
  onNext,
  onToday,
}: {
  month: string;
  onPrevious: () => void;
  onNext: () => void;
  onToday?: () => void;
}) {
  const { t } = useTranslation();
  const format = useDayFormat();
  const label = format(`${month}-01`, { month: 'long', year: 'numeric' });
  return (
    <View style={styles.monthHeader}>
      <Text variant="title3" testID="calendar-month" style={styles.monthLabel}>
        {label.charAt(0).toUpperCase() + label.slice(1)}
      </Text>
      {onToday && (
        <PressableScale
          testID="calendar-today"
          accessibilityRole="button"
          onPress={onToday}
          style={styles.todayPill}
        >
          <Text variant="caption">{t('calendar.today')}</Text>
        </PressableScale>
      )}
      <IconButton
        testID="calendar-previous"
        icon={ChevronLeft}
        variant="plain"
        accessibilityLabel={t('calendar.previousMonth')}
        onPress={onPrevious}
      />
      <IconButton
        testID="calendar-next"
        icon={ChevronRight}
        variant="plain"
        accessibilityLabel={t('calendar.nextMonth')}
        onPress={onNext}
      />
    </View>
  );
}

function MonthGrid({
  month,
  data,
  today,
  selected,
  onSelect,
}: {
  month: string;
  data: CalendarMonth | undefined;
  today: string;
  selected: string;
  onSelect: (day: string) => void;
}) {
  const format = useDayFormat();
  const weeks = monthGrid(month);
  // 2026-10-12 is a Monday: label the columns from a known week.
  const weekdays = Array.from({ length: 7 }, (_, index) =>
    format(addDays('2026-10-12', index), { weekday: 'narrow' }),
  );
  const byDay = new Map(data?.days.map((entry) => [entry.date, entry]));
  const access = data?.access;

  return (
    <View style={styles.grid}>
      <View style={styles.week}>
        {weekdays.map((label, index) => (
          <Text key={index} variant="caption" color="secondary" style={styles.weekday}>
            {label}
          </Text>
        ))}
      </View>
      {weeks.map((week, row) => (
        <View key={row} style={styles.week}>
          {week.map((day, column) =>
            day ? (
              <DayCell
                key={day}
                day={day}
                entry={byDay.get(day)}
                isToday={day === today}
                isSelected={day === selected}
                locked={!!access && (day < access.from || day > access.to)}
                onPress={() => onSelect(day)}
              />
            ) : (
              <View key={`pad-${column}`} style={styles.cell} />
            ),
          )}
        </View>
      ))}
    </View>
  );
}

function DayCell({
  day,
  entry,
  isToday,
  isSelected,
  locked,
  onPress,
}: {
  day: string;
  entry: CalendarDay | undefined;
  isToday: boolean;
  isSelected: boolean;
  locked: boolean;
  onPress: () => void;
}) {
  const format = useDayFormat();
  const thumbnail = entry?.planned?.outfit.thumbnails[0];
  const worn = (entry?.worn.length ?? 0) > 0;
  const label = format(day, { weekday: 'long', day: 'numeric', month: 'long' });
  return (
    <PressableScale
      testID={`day-${day}`}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: isSelected }}
      pressedScale={0.92}
      onPress={onPress}
      style={styles.cell}
    >
      <View
        style={[
          styles.dayNumber,
          isToday && styles.dayToday,
          isSelected && styles.daySelected,
          locked && styles.dayLocked,
        ]}
      >
        <Text variant="callout" style={{ color: isSelected ? colors.onPrimary : colors.primary }}>
          {Number(day.slice(8))}
        </Text>
      </View>
      <View style={styles.marks}>
        {thumbnail ? (
          <Animated.View entering={FadeIn.duration(200)}>
            <Image
              testID={`day-${day}-planned`}
              source={{ uri: thumbnail }}
              contentFit="cover"
              style={[styles.markThumb, worn && styles.markThumbWorn]}
            />
          </Animated.View>
        ) : worn ? (
          <View testID={`day-${day}-worn`} style={styles.markDot} />
        ) : null}
      </View>
    </PressableScale>
  );
}

function DayPanel({
  date,
  today,
  entry,
  access,
  loading,
}: {
  date: string;
  today: string;
  entry: CalendarDay | undefined;
  access: CalendarMonth['access'];
  loading: boolean;
}) {
  const { t } = useTranslation();
  const format = useDayFormat();
  const unplan = useUnplanDay();
  const offset = daysBetween(today, date);
  const locked = !!access && (date < access.from || date > access.to);
  const title = format(date, { weekday: 'long', day: 'numeric', month: 'long' });
  const relative =
    offset === 0
      ? t('calendar.todayLabel')
      : offset === 1
        ? t('calendar.tomorrow')
        : offset < 0
          ? t('calendar.past')
          : null;

  return (
    <Animated.View entering={FadeIn.duration(220)} style={styles.panel} testID="day-panel">
      <View style={styles.panelTitle}>
        <Text variant="title3" testID="day-title">
          {title.charAt(0).toUpperCase() + title.slice(1)}
        </Text>
        {relative && (
          <Text variant="caption" color="secondary">
            {relative}
          </Text>
        )}
      </View>

      {unplan.isError && <FormBanner tone="error" message={errorMessage(unplan.error, t)} />}

      {locked ? (
        <Card style={styles.locked} testID="day-locked">
          <View style={styles.lockedIcon}>
            <Lock size={18} color={colors.accent} />
          </View>
          <View style={styles.flex}>
            <Text variant="bodyStrong">{t('calendar.lockedTitle')}</Text>
            <Text variant="footnote" color="secondary">
              {t('calendar.lockedBody')}
            </Text>
          </View>
        </Card>
      ) : loading ? (
        <Skeleton height={110} radius={radii.lg} />
      ) : (
        <>
          {entry?.planned && (
            <PlannedCard
              event={entry.planned}
              canChange={offset >= 0}
              removing={unplan.isPending}
              onRemove={() => unplan.mutate(date)}
            />
          )}
          {!!entry?.worn.length && (
            <View style={styles.wornBlock} testID="day-worn">
              <Text variant="overline" color="secondary">
                {t('calendar.wornThatDay')}
              </Text>
              {entry.worn.map((outfit) => (
                <OutfitRow key={outfit.id} outfit={outfit} worn />
              ))}
            </View>
          )}
          {!entry?.planned && offset >= 0 && (
            <Card style={styles.empty} testID="day-empty">
              <Text variant="body" color="secondary">
                {offset === 0 ? t('calendar.emptyToday') : t('calendar.emptyDay')}
              </Text>
              <Button
                testID="day-choose"
                label={t('calendar.chooseLook')}
                icon={CalendarPlus}
                onPress={() => router.push({ pathname: '/plan-day/[date]', params: { date } })}
              />
              <Button
                testID="day-create"
                label={t('calendar.createLook')}
                icon={Sparkles}
                variant="secondary"
                onPress={() => router.navigate({ pathname: '/stylist', params: { date } })}
              />
            </Card>
          )}
          {!entry && offset < 0 && (
            <Text variant="footnote" color="secondary" testID="day-nothing">
              {t('calendar.nothingThatDay')}
            </Text>
          )}
        </>
      )}
    </Animated.View>
  );
}

function PlannedCard({
  event,
  canChange,
  removing,
  onRemove,
}: {
  event: CalendarEvent;
  canChange: boolean;
  removing: boolean;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Card style={styles.planned} testID="day-planned">
      <OutfitRow outfit={event.outfit} />
      {(event.notes || event.occasion) && (
        <Text variant="footnote" color="secondary">
          {[event.occasion ? t(`occasions.${event.occasion}`) : null, event.notes]
            .filter(Boolean)
            .join(' · ')}
        </Text>
      )}
      <View style={styles.plannedActions}>
        {canChange && (
          <Button
            testID="day-change"
            label={t('calendar.change')}
            variant="secondary"
            size="md"
            fullWidth={false}
            onPress={() =>
              router.push({ pathname: '/plan-day/[date]', params: { date: event.date } })
            }
          />
        )}
        <Button
          testID="day-remove"
          label={t('calendar.remove')}
          variant="ghost"
          size="md"
          fullWidth={false}
          loading={removing}
          onPress={onRemove}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  calendar: { paddingBottom: spacing.sm },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: spacing.lg,
    paddingRight: spacing.xs,
    paddingTop: spacing.sm,
    gap: spacing.xs,
  },
  monthLabel: { flex: 1 },
  todayPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: colorsAlpha.accentSoft,
  },
  grid: { paddingHorizontal: spacing.sm },
  week: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', paddingVertical: spacing.sm },
  cell: { flex: 1, alignItems: 'center', paddingVertical: 4, minHeight: 58 },
  dayNumber: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayToday: { borderWidth: 1.5, borderColor: colors.accent },
  daySelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  dayLocked: { opacity: 0.3 },
  marks: { height: 20, alignItems: 'center', justifyContent: 'center' },
  markThumb: { width: 18, height: 18, borderRadius: 9, backgroundColor: colors.muted },
  markThumbWorn: { borderWidth: 1.5, borderColor: colors.success },
  markDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success },
  panel: { marginTop: spacing.xl, gap: spacing.md },
  panelLoading: { marginTop: spacing.xl, gap: spacing.md },
  panelTitle: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  locked: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  lockedIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colorsAlpha.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1, gap: 2 },
  planned: { gap: spacing.md },
  plannedActions: { flexDirection: 'row', gap: spacing.sm },
  wornBlock: { gap: spacing.sm },
  empty: { gap: spacing.md },
});

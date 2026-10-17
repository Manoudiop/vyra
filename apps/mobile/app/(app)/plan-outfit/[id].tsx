import { useQuery } from '@tanstack/react-query';
import { addDays, type CalendarDay } from '@vyra/shared';
import { useLocalSearchParams } from 'expo-router';
import { CalendarCheck, Lock, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FormBanner } from '@/features/auth/components';
import { summaryOf, useCalendarMonth, useDayFormat, usePlanDay } from '@/features/calendar/hooks';
import { OutfitRow } from '@/features/calendar/OutfitRow';
import { outfitKeys, stylistApi } from '@/features/stylist/stylist-api';
import { errorMessage } from '@/lib/errors';
import { goBackOr } from '@/lib/navigation';
import {
  Button,
  colors,
  haptics,
  IconButton,
  PressableScale,
  radii,
  Skeleton,
  spacing,
  Text,
  TextField,
} from '@/ui';

/** The next two weeks: enough for "plan my week"; further days go through the calendar. */
const STRIP_DAYS = 14;

const deviceToday = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

/** Sheet: choose the day to wear this look. */
export default function PlanOutfitScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const format = useDayFormat();
  const outfit = useQuery({
    queryKey: outfitKeys.detail(id),
    queryFn: () => stylistApi.getOutfit(id),
  });
  const firstMonth = useCalendarMonth(deviceToday().slice(0, 7));
  const today = firstMonth.data?.today ?? deviceToday();
  const lastMonth = useCalendarMonth(addDays(today, STRIP_DAYS - 1).slice(0, 7));
  const access = firstMonth.data?.access ?? null;
  const known = new Map<string, CalendarDay>(
    [...(firstMonth.data?.days ?? []), ...(lastMonth.data?.days ?? [])].map((day) => [
      day.date,
      day,
    ]),
  );
  const days = Array.from({ length: STRIP_DAYS }, (_, index) => addDays(today, index));
  const [selected, setSelected] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const plan = usePlanDay();

  const day = selected ?? today;
  const replaces = known.get(day)?.planned;
  const isLocked = (value: string) => !!access && (value < access.from || value > access.to);
  const dayLabel = format(day, { weekday: 'long', day: 'numeric', month: 'long' });

  const confirm = () => {
    plan.mutate(
      { date: day, outfitId: id, ...(notes.trim() ? { notes: notes.trim() } : {}) },
      { onSuccess: () => goBackOr('/calendar') },
    );
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.screen} testID="plan-outfit-screen">
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.topRow}>
          <Text variant="title2" accessibilityRole="header" style={styles.title}>
            {t('calendar.planThisLook')}
          </Text>
          <IconButton
            icon={X}
            accessibilityLabel={t('common.close')}
            onPress={() => goBackOr(`/outfit/${id}`)}
          />
        </View>

        {outfit.data ? (
          <OutfitRow outfit={summaryOf(outfit.data)} onPress={() => undefined} />
        ) : (
          <Skeleton height={64} radius={radii.md} />
        )}

        <Text variant="title3">{t('calendar.whichDay')}</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.stripScroll}
          contentContainerStyle={styles.strip}
        >
          {days.map((value) => {
            const locked = isLocked(value);
            const active = value === day;
            const taken = !!known.get(value)?.planned;
            const fg = active ? colors.onPrimary : colors.primary;
            return (
              <PressableScale
                key={value}
                testID={`plan-day-${value}`}
                accessibilityRole="button"
                accessibilityLabel={format(value, {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                })}
                accessibilityState={{ selected: active, disabled: locked }}
                disabled={locked}
                onPress={() => {
                  haptics.selection();
                  setSelected(value);
                }}
                style={[styles.dayChip, active && styles.dayChipActive, locked && styles.dayLocked]}
              >
                <Text
                  variant="caption"
                  style={{ color: active ? colors.onPrimary : colors.secondary }}
                >
                  {format(value, { weekday: 'short' })}
                </Text>
                <Text variant="title3" style={{ color: fg }}>
                  {Number(value.slice(8))}
                </Text>
                {locked ? (
                  <Lock size={12} color={colors.secondary} />
                ) : (
                  <View
                    style={[
                      styles.takenDot,
                      taken && { backgroundColor: active ? colors.onPrimary : colors.accent },
                    ]}
                  />
                )}
              </PressableScale>
            );
          })}
        </ScrollView>
        {access && (
          <Text variant="footnote" color="secondary" testID="plan-free-note">
            {t('calendar.freeWeekNote')}
          </Text>
        )}
        {replaces && replaces.outfit.id !== id && (
          <Text variant="footnote" color="secondary" testID="plan-replaces">
            {t('calendar.replaces', { name: replaces.outfit.name })}
          </Text>
        )}

        <TextField
          testID="plan-notes"
          label={t('calendar.notesLabel')}
          placeholder={t('calendar.notesPlaceholder')}
          value={notes}
          onChangeText={setNotes}
          maxLength={120}
        />
        {plan.isError && (
          <FormBanner
            tone="error"
            message={errorMessage(plan.error, t, { LIMIT_REACHED: t('calendar.lockedBody') })}
          />
        )}
      </ScrollView>
      <View style={styles.footer}>
        <Button
          testID="plan-confirm"
          label={t('calendar.planFor', { date: dayLabel })}
          icon={CalendarCheck}
          onPress={confirm}
          loading={plan.isPending}
          disabled={isLocked(day)}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, gap: spacing.lg },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  title: { flex: 1 },
  stripScroll: { marginHorizontal: -spacing.xl },
  strip: { gap: spacing.sm, paddingHorizontal: spacing.xl },
  dayChip: {
    width: 56,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    gap: 2,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  dayChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  dayLocked: { opacity: 0.4 },
  takenDot: { width: 6, height: 6, borderRadius: 3, marginTop: 4 },
  footer: { paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
});

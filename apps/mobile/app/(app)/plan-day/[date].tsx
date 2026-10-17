import { FlashList } from '@shopify/flash-list';
import { useInfiniteQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Bookmark, Sparkles, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FormBanner } from '@/features/auth/components';
import { summaryOf, useDayFormat, usePlanDay } from '@/features/calendar/hooks';
import { OutfitRow } from '@/features/calendar/OutfitRow';
import { outfitKeys, stylistApi } from '@/features/stylist/stylist-api';
import { errorMessage } from '@/lib/errors';
import { goBackOr } from '@/lib/navigation';
import {
  Button,
  colors,
  EmptyState,
  ErrorState,
  IconButton,
  radii,
  Skeleton,
  spacing,
  Text,
  TextField,
} from '@/ui';

/** Sheet: pick one of your looks for a calendar day. */
export default function PlanDayScreen() {
  const { t } = useTranslation();
  const { date } = useLocalSearchParams<{ date: string }>();
  const format = useDayFormat();
  const [notes, setNotes] = useState('');
  const [choosing, setChoosing] = useState<string | null>(null);
  const plan = usePlanDay();
  const looks = useInfiniteQuery({
    queryKey: outfitKeys.recent(),
    queryFn: ({ pageParam }) => stylistApi.list(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
  });
  // Saved looks first: they are the ones the user meant to wear again.
  const outfits = (looks.data?.pages.flatMap((page) => page.items) ?? []).sort(
    (a, b) => Number(b.isSaved) - Number(a.isSaved),
  );
  const title = format(date, { weekday: 'long', day: 'numeric', month: 'long' });

  const choose = (outfitId: string) => {
    setChoosing(outfitId);
    plan.mutate(
      { date, outfitId, ...(notes.trim() ? { notes: notes.trim() } : {}) },
      {
        onSuccess: () => goBackOr('/calendar'),
        onSettled: () => setChoosing(null),
      },
    );
  };

  const createLook = () => {
    router.back();
    router.navigate({ pathname: '/stylist', params: { date } });
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.screen} testID="plan-day-screen">
      <FlashList
        data={outfits}
        keyExtractor={(outfit) => outfit.id}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <OutfitRow
              testID={`plan-pick-${item.id}`}
              outfit={summaryOf(item)}
              onPress={() => choose(item.id)}
              right={
                choosing === item.id ? (
                  <ActivityIndicator color={colors.accent} />
                ) : item.isSaved ? (
                  <Bookmark size={16} color={colors.primary} fill={colors.primary} />
                ) : null
              }
            />
          </View>
        )}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.topRow}>
              <View style={styles.titles}>
                <Text variant="overline" color="secondary">
                  {title}
                </Text>
                <Text variant="title2" accessibilityRole="header">
                  {t('calendar.chooseLook')}
                </Text>
              </View>
              <IconButton
                icon={X}
                accessibilityLabel={t('common.close')}
                onPress={() => goBackOr('/calendar')}
              />
            </View>
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
            <Button
              testID="plan-create"
              label={t('calendar.createLook')}
              icon={Sparkles}
              variant="secondary"
              onPress={createLook}
            />
            {outfits.length > 0 && (
              <Text variant="title3" style={styles.listTitle}>
                {t('calendar.yourLooks')}
              </Text>
            )}
          </View>
        }
        ListEmptyComponent={
          looks.isPending ? (
            <View style={styles.loading}>
              {[0, 1, 2].map((index) => (
                <Skeleton key={index} height={64} radius={radii.md} />
              ))}
            </View>
          ) : looks.isError ? (
            <ErrorState
              message={errorMessage(looks.error, t)}
              onRetry={() => void looks.refetch()}
            />
          ) : (
            <EmptyState
              testID="plan-empty"
              icon={Sparkles}
              title={t('calendar.noLooksTitle')}
              body={t('calendar.noLooksBody')}
            />
          )
        }
        onEndReached={() => {
          if (looks.hasNextPage && !looks.isFetchingNextPage) void looks.fetchNextPage();
        }}
        onEndReachedThreshold={0.6}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl },
  header: { gap: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  titles: { flex: 1, gap: spacing.xs },
  listTitle: { marginTop: spacing.sm },
  item: { paddingVertical: spacing.sm },
  loading: { gap: spacing.md },
});
